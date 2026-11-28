"""Secret detection guardrail ("hide_secrets").

Scans request text for API keys, tokens and credential assignments and replaces
every hit with ``[REDACTED]`` before the request reaches the provider. Detection
is delegated to detect-secrets with a curated plugin set; the small custom
plugins live in ``secrets_plugins`` and are loaded by file path.
"""

import configparser
import contextlib
import hashlib
import itertools
import json
import os
import re
import tempfile
from collections import OrderedDict
from collections.abc import Generator, Iterator, Sequence
from contextvars import ContextVar
from functools import partial
from typing import TYPE_CHECKING, ClassVar, Final, Literal

from pydantic import JsonValue, TypeAdapter

from litellm._logging import verbose_proxy_logger
from litellm.caching.caching import DualCache
from litellm.integrations.custom_guardrail import CustomGuardrail, log_guardrail_information
from litellm.llms.base_llm.guardrail_translation.utils import effective_skip_tool_message_for_guardrail
from litellm.proxy._types import UserAPIKeyAuth
from litellm.proxy.guardrails._content_utils import iter_tool_json_fields, map_tool_json_text, walk_user_text
from litellm.types.guardrails import GuardrailEventHooks
from litellm.types.utils import GenericGuardrailAPIInputs

if TYPE_CHECKING:
    from litellm.litellm_core_utils.litellm_logging import Logging as LiteLLMLoggingObj

GUARDRAIL_NAME: Final = "hide_secrets"
GUARDRAIL_PROVIDER: Final = "hide-secrets"

# Per-invocation tally of redacted secrets by detect-secrets plugin type. None
# means the guardrail did not run, so _process_response records nothing.
_masked_entity_count: ContextVar[dict[str, int] | None] = ContextVar(
    "hide_secrets_masked_entity_count", default=None
)

_custom_plugins_path: Final = "file://" + os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "secrets_plugins"
)

def _plugin(filename: str) -> dict[str, str]:
    return {"path": _custom_plugins_path + "/" + filename}

_default_detect_secrets_config: Final = {
    "plugins_used": [
        {"name": "SoftlayerDetector"},
        {"name": "StripeDetector"},
        {"name": "NpmDetector"},
        {"name": "IbmCosHmacDetector"},
        {"name": "DiscordBotTokenDetector"},
        {"name": "BasicAuthDetector"},
        {"name": "AzureStorageKeyDetector"},
        {"name": "ArtifactoryDetector"},
        {"name": "AWSKeyDetector"},
        {"name": "CloudantDetector"},
        {"name": "IbmCloudIamDetector"},
        {"name": "JwtTokenDetector"},
        {"name": "MailchimpDetector"},
        {"name": "SquareOAuthDetector"},
        {"name": "PrivateKeyDetector"},
        {"name": "TwilioKeyDetector"},
        {**_plugin("anthropic_api_key.py"), "name": "AnthropicApiKeyDetector"},
        {**_plugin("openai_api_key.py"), "name": "OpenAIApiKeyDetector"},
        {**_plugin("github_token.py"), "name": "GitHubTokenCustomDetector"},
        {**_plugin("gitlab.py"), "name": "GitLabDetector"},
        {**_plugin("gcp_api_key.py"), "name": "GCPApiKeyDetector"},
        {**_plugin("jwt.py"), "name": "JWTBase64Detector"},
        {**_plugin("slack.py"), "name": "SlackTokenDetector"},
        {**_plugin("sendgrid_api_token.py"), "name": "SendGridApiTokenDetector"},
        {**_plugin("twilio_api_key.py"), "name": "TwilioApiKeyDetector"},
        {**_plugin("mailgun.py"), "name": "MailgunDetector"},
        {**_plugin("new_relic.py"), "name": "NewRelicDetector"},
        {**_plugin("discord.py"), "name": "DiscordWebhookDetector"},
        {**_plugin("telegram_bot_api_token.py"), "name": "TelegramBotApiTokenDetector"},
        {**_plugin("shopify.py"), "name": "ShopifyDetector"},
        {**_plugin("database_url.py"), "name": "DatabaseConnectionStringDetector"},
        {**_plugin("digitalocean.py"), "name": "DigitalOceanTokenDetector"},
        {**_plugin("doppler_api_token.py"), "name": "DopplerApiTokenDetector"},
        {**_plugin("dropbox.py"), "name": "DropboxTokenDetector"},
        {**_plugin("hubspot_api_key.py"), "name": "HubSpotApiTokenDetector"},
        {**_plugin("launchdarkly_access_token.py"), "name": "LaunchdarklyAccessTokenDetector"},
        {**_plugin("linear.py"), "name": "LinearApiKeyDetector"},
        {**_plugin("mapbox_api_token.py"), "name": "MapBoxApiTokenDetector"},
        {**_plugin("netlify_access_token.py"), "name": "NetlifyAccessTokenDetector"},
        {**_plugin("planetscale.py"), "name": "PlanetScaleTokenDetector"},
        {**_plugin("postman_api_token.py"), "name": "PostmanApiTokenDetector"},
        {**_plugin("pulumi_api_token.py"), "name": "PulumiApiTokenDetector"},
        {**_plugin("sentry_access_token.py"), "name": "SentryAccessTokenDetector"},
        {**_plugin("credential_keyword.py"), "name": "CredentialKeywordDetector"},
        {"name": "Base64HighEntropyString", "limit": 4.5},
        {"name": "HexHighEntropyString", "limit": 3.0},
    ],
}

_CONFIG_SECTION: Final = "litellm-prompt"
_JSON_STRING: Final = TypeAdapter(str)
_KEY_CONTEXT: Final = 64

# Longest JSON line scanned for a multi-line tool string. Escaping puts the whole string on one line, and
# detect-secrets regexes backtrack across it, so a longer multi-line string is cut into runs of whole lines,
# each scanned as its own JSON line beside the key. Every run holds at least two lines, so the high-entropy
# detectors, which match only a quoted string made wholly of their charset, never judge a lone line.
_JSON_LINE_LIMIT: Final = 4096

# A detector can stop a match inside an escape of a JSON-escaped line, as at the backslash of \".
_CUT_ESCAPE: Final = re.compile(r"(?<=.)\\(?:u[0-9A-Fa-f]{0,3})?\Z", re.DOTALL)

_ASSIGNMENT_LINE: Final = re.compile(r"[^\s\[#;:=][^:=]*[:=]")

_SHELL_ASSIGNMENT: Final = re.compile(r"(?P<key>[^\s\[#;:=](?:[^:=]*[^\s:=])?)=(?P<value>\S+)")

_SHELL_OPERATORS: Final = ";&|"

_SHELL_TRAILER: Final = re.compile(r"\\|#.*|-*\w[\w.-]*=\S*")

_SCAN_SUFFIX: Final = ".py"

# Digests of scan inputs that held no secret, so the history an agent resends every turn is scanned once.
# 65536 digests take about 10 MB and hold a few hundred interleaved agent sessions per worker.
_CLEAN_SCAN_CACHE_SIZE: Final = 65536


@contextlib.contextmanager
def _temp_file(text: str) -> Generator[str, None, None]:
    temp_file: Final = tempfile.NamedTemporaryFile(suffix=_SCAN_SUFFIX, delete=False)
    try:
        temp_file.write(text.encode("utf-8"))
        temp_file.close()
        yield temp_file.name
    finally:
        temp_file.close()
        os.remove(temp_file.name)


def _scan_lines(lines: Sequence[str]) -> frozenset[tuple[str, str]]:
    from detect_secrets import SecretsCollection

    secrets: Final = SecretsCollection()
    with _temp_file("\n".join(lines)) as path:
        secrets.scan_file(path)

    return frozenset(
        (found_secret.secret_value, found_secret.type)
        for file in secrets.files
        for found_secret in secrets[file]
        if found_secret.secret_value is not None
    )


def _classify_line(state: tuple[bool, str | None], numbered: tuple[int, str]) -> tuple[bool, str | None]:
    open_option: Final = state[0]
    number, line = numbered
    stripped: Final = line.strip()
    if not stripped or stripped[0] in "#;":
        return open_option, None
    shell_assignment: Final = _SHELL_ASSIGNMENT.match(stripped)
    if shell_assignment is not None:
        return True, f"{shell_assignment['key']}_{number}={shell_assignment['value']}"
    assignment: Final = _ASSIGNMENT_LINE.match(stripped)
    if assignment is not None:
        return True, f"{assignment.group()[:-1].strip()}_{number}{stripped[assignment.end() - 1 :]}"
    if line[0].isspace() and open_option:
        return True, line
    return False, None


def _parseable_lines(text: str) -> Iterator[str]:
    states: Final = itertools.accumulate(enumerate(text.splitlines()), _classify_line, initial=(False, None))
    return (line for _, line in states if line is not None)


def _lone_value(line: str) -> str | None:
    tokens: Final = line.split()
    if not tokens or '"' in tokens[0]:
        return None
    value: Final = tokens[0].rstrip(_SHELL_OPERATORS)
    if len(tokens) == 1 or value != tokens[0] or _SHELL_TRAILER.fullmatch(tokens[1]) is not None:
        return value
    return None


def _quoted_assignments(text: str) -> tuple[str, ...]:
    parser: Final = configparser.ConfigParser(interpolation=None)
    parser.optionxform = str  # pyright: ignore[reportAttributeAccessIssue]  # configparser types optionxform as a method
    parser.read_string(f"[{_CONFIG_SECTION}]\n" + "\n".join(_parseable_lines(text)))
    return tuple(
        f'{key} = "{value}"'
        for section in parser
        for key, values in parser.items(section)
        for line in values.splitlines()
        if (value := _lone_value(line)) is not None
    )


def _json_unescaped(value: str) -> str:
    for candidate in (value, _CUT_ESCAPE.sub("", value)):
        try:
            return _JSON_STRING.validate_json(f'"{candidate}"')
        except ValueError:
            continue
    return value


def _key_context(key: str) -> str:
    return json.dumps(" ".join(key.split()), ensure_ascii=False)[1:-1][-_KEY_CONTEXT:]


def _json_line(context: str | None, text: str) -> str:
    value: Final = json.dumps(text, ensure_ascii=False)
    return value if context is None else f'"{context}": {value}'


def _json_lines(context: str | None, text: str) -> Iterator[str]:
    """Yield ``text`` as one JSON line, or a long multi-line ``text`` as JSON lines of two or more whole lines."""
    line: Final = _json_line(context, text)
    lines: Final = text.splitlines(keepends=True)
    if len(line) <= _JSON_LINE_LIMIT or len(lines) < 2:
        yield line
        return
    budget: Final = _JSON_LINE_LIMIT - len(_json_line(context, ""))
    sizes: Final = (len(json.dumps(part, ensure_ascii=False)) - 2 for part in lines)
    states: Final = itertools.accumulate(sizes, partial(_next_run_state, budget), initial=(0, 0, 0))
    run_ids: Final = (state[0] for state in itertools.islice(states, 1, None))
    runs: Final = tuple(
        tuple(part for part, _ in run) for _, run in itertools.groupby(zip(lines, run_ids), key=lambda pair: pair[1])
    )
    whole_runs: Final = (*runs[:-2], runs[-2] + runs[-1]) if len(runs[-1]) < 2 else runs
    for run in whole_runs:
        yield _json_line(context, "".join(run[:-1]) + run[-1].splitlines()[0])


def _next_run_state(budget: int, state: tuple[int, int, int], size: int) -> tuple[int, int, int]:
    """Advance ``(run id, lines in run, escaped size of run)`` by one line of escaped ``size``."""
    run_id, count, total = state
    if count >= 2 and total + size > budget:
        return run_id + 1, 1, size
    return run_id, count + 1, total + size


def _value_in_texts(value: str, texts: Sequence[str]) -> str | None:
    """Return the detected value as it appears in ``texts``, decoding it when it came from a JSON-escaped key line."""
    candidates: Final = (value, _json_unescaped(value))
    return next((candidate for candidate in candidates if any(candidate in text for text in texts)), None)


class _ENTERPRISE_SecretDetection(CustomGuardrail):
    # Keeps proxied traffic on async_pre_call_hook (the unified apply_guardrail
    # path skips should_run_check and never sees data["prompt"]).
    use_native_lifecycle_hooks: ClassVar[bool] = True

    def __init__(self, detect_secrets_config: dict | None = None, **kwargs: object) -> None:
        self.user_defined_detect_secrets_config = detect_secrets_config
        self._clean_scans: OrderedDict[bytes, None] = OrderedDict()
        super().__init__(**kwargs)  # pyright: ignore[reportArgumentType]  # CustomGuardrail accepts arbitrary config kwargs

    def scan_message_for_secrets(self, message_content: str) -> list[dict[str, str]]:
        from detect_secrets.settings import transient_settings

        digest: Final = hashlib.sha256(message_content.encode()).digest()
        if digest in self._clean_scans:
            self._clean_scans.move_to_end(digest)
            return []
        detect_secrets_config = self.user_defined_detect_secrets_config or _default_detect_secrets_config
        with transient_settings(detect_secrets_config):
            found: Final = _scan_lines(
                (*message_content.splitlines(), *_quoted_assignments(message_content))
            )

        if not found:
            self._clean_scans[digest] = None
            if len(self._clean_scans) > _CLEAN_SCAN_CACHE_SIZE:
                self._clean_scans.popitem(last=False)
        return [
            {"type": secret_type, "value": value}
            for value, secret_type in sorted(found, key=lambda pair: (-len(pair[0]), pair[1], pair[0]))
        ]

    def redact_text(self, text: str, source: str = "message") -> str:
        """Replace every detected secret in ``text`` with ``[REDACTED]`` and
        tally the detected types into the per-invocation masked-entity count."""
        detected_secrets = self.scan_message_for_secrets(text)
        if not detected_secrets:
            return text
        counts = _masked_entity_count.get()
        if counts is not None:
            for secret in detected_secrets:
                counts[secret["type"]] = counts.get(secret["type"], 0) + 1
        secret_types: Final = sorted(dict.fromkeys(secret["type"] for secret in detected_secrets))
        verbose_proxy_logger.warning("Detected and redacted secrets in %s: %s", source, secret_types)
        pattern: Final = re.compile("|".join(re.escape(secret["value"]) for secret in detected_secrets))
        return pattern.sub("[REDACTED]", text)

    def redact_tool_payload(self, payload: JsonValue) -> JsonValue:
        """Redact secrets in a tool payload's string values, scanning each value alone and as its JSON lines."""
        fields: Final = tuple(iter_tool_json_fields(payload))
        texts: Final = tuple(text for _, text in fields)
        contexts: Final = {key: _key_context(key) for key in {key for key, _ in fields if key is not None}}
        keyed: Final = tuple(
            itertools.chain.from_iterable(
                _json_lines(None if key is None else contexts[key], text) for key, text in fields
            )
        )
        detected: Final = tuple(
            {**secret, "value": value}
            for secret in self.scan_message_for_secrets("\n".join((*texts, *keyed)))
            if (value := _value_in_texts(secret["value"], texts)) is not None
        )
        if not detected:
            return payload
        counts: Final = _masked_entity_count.get()
        if counts is not None:
            for secret in detected:
                counts[secret["type"]] = counts.get(secret["type"], 0) + 1
        verbose_proxy_logger.warning(
            "Detected and redacted secrets in tool payload: %s",
            sorted(dict.fromkeys(secret["type"] for secret in detected)),
        )
        values: Final = sorted({secret["value"] for secret in detected}, key=len, reverse=True)
        pattern: Final = re.compile("|".join(re.escape(value) for value in values))
        return map_tool_json_text(payload, lambda text: pattern.sub("[REDACTED]", text))

    async def should_run_check(self, user_api_key_dict: UserAPIKeyAuth) -> bool:
        if user_api_key_dict.permissions is not None:
            if GUARDRAIL_NAME in user_api_key_dict.permissions:
                if user_api_key_dict.permissions[GUARDRAIL_NAME] is False:
                    return False
        return True

    @log_guardrail_information
    async def apply_guardrail(
        self,
        inputs: GenericGuardrailAPIInputs,
        request_data: dict,
        input_type: Literal["request", "response"],
        logging_obj: "LiteLLMLoggingObj | None" = None,
    ) -> GenericGuardrailAPIInputs:
        """Unified-interface entrypoint, used by /guardrails/apply_guardrail
        (the UI test playground). Proxied traffic keeps using
        ``async_pre_call_hook``, see ``use_native_lifecycle_hooks``."""
        texts = inputs.get("texts")
        if not texts or not any(texts):
            return inputs
        _masked_entity_count.set({})
        return {**inputs, "texts": [self.redact_text(text) for text in texts]}

    def _redact_prompt(self, data: dict) -> int:
        """Redact ``data["prompt"]`` (the text-completion shape, which
        ``walk_user_text`` does not cover) and return how many non-empty
        strings were inspected."""
        prompt = data.get("prompt")
        if isinstance(prompt, str):
            if not prompt:
                return 0
            data["prompt"] = self.redact_text(prompt, source="prompt")
            return 1
        if isinstance(prompt, list):
            data["prompt"] = [
                self.redact_text(item, source="prompt") if isinstance(item, str) and item else item
                for item in prompt
            ]
            return sum(1 for item in prompt if isinstance(item, str) and item)
        return 0

    @log_guardrail_information
    async def async_pre_call_hook(
        self,
        user_api_key_dict: UserAPIKeyAuth,
        cache: DualCache,
        data: dict,
        call_type: str,
    ):
        _masked_entity_count.set(None)
        if await self.should_run_check(user_api_key_dict) is False:
            return

        _masked_entity_count.set({})

        # Covers multimodal list content + Responses-API input.
        inspected = walk_user_text(
            data,
            self.redact_text,
            self.redact_tool_payload,
            skip_tool_message=effective_skip_tool_message_for_guardrail(self),
        ) + self._redact_prompt(data)

        if inspected == 0:
            # Image-only, empty-text, and unsupported payloads inspected
            # nothing, so recording "allow" would count a run that never
            # looked at any content.
            _masked_entity_count.set(None)
        return

    def _process_response(
        self,
        response: dict | None,
        request_data: dict,
        start_time: float | None = None,
        end_time: float | None = None,
        duration: float | None = None,
        event_type: GuardrailEventHooks | None = None,
        original_inputs: dict | None = None,
    ):
        """Record allow/mask plus the masked-entity tally for a completed run.

        Records nothing when the guardrail inspected nothing (opted-out key,
        empty inputs) or when the instance has no guardrail_name (legacy
        ``litellm_settings.callbacks`` deployments, which predate guardrail
        telemetry and stay without it).
        """
        counts = _masked_entity_count.get()
        _masked_entity_count.set(None)
        if counts is None or self.guardrail_name is None:
            return response
        self.add_standard_logging_guardrail_information_to_request_data(
            guardrail_json_response="mask" if counts else "allow",
            request_data=request_data,
            guardrail_status="success",
            duration=duration,
            start_time=start_time,
            end_time=end_time,
            event_type=event_type,
            guardrail_provider=GUARDRAIL_PROVIDER,
            masked_entity_count=counts,
        )
        return response

    def _process_error(
        self,
        e: Exception,
        request_data: dict,
        start_time: float | None = None,
        end_time: float | None = None,
        duration: float | None = None,
        event_type: GuardrailEventHooks | None = None,
    ):
        """Label the failed run with this guardrail's provider so error rows
        group with the successful ones in the monitor. Nameless legacy
        instances record nothing, matching ``_process_response``."""
        _masked_entity_count.set(None)
        if self.guardrail_name is None:
            raise e
        self.add_standard_logging_guardrail_information_to_request_data(
            guardrail_json_response=e,
            request_data=request_data,
            guardrail_status=(
                "guardrail_intervened" if self._is_guardrail_intervention(e) else "guardrail_failed_to_respond"
            ),
            duration=duration,
            start_time=start_time,
            end_time=end_time,
            event_type=event_type,
            guardrail_provider=GUARDRAIL_PROVIDER,
        )
        raise e
