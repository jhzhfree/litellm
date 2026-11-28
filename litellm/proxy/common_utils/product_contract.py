import re
from collections.abc import Mapping
from types import MappingProxyType
from typing import Final

from pydantic import JsonValue

PRODUCT_NAME: Final = "AI-GovernanceGw"
FIELD_NAMES: Final[Mapping[str, str]] = MappingProxyType(
    {
        "litellm_params": "gateway_params",
        "litellm_cache_params": "gateway_cache_params",
        "litellm_changed_by": "gateway_changed_by",
        "litellm_count_model": "gateway_count_model",
        "litellm_count_source": "gateway_count_source",
        "litellm_credential_name": "gateway_credential_name",
        "litellm_logging_obj": "gateway_logging_context",
        "litellm_model": "gateway_model",
        "litellm_model_table": "gateway_model_table",
        "litellm_request_id": "gateway_request_id",
        "tier_litellm_params": "tier_gateway_params",
        "use_litellm_proxy": "use_ai_gateway",
        "litellm_params_to_remove": "gateway_params_to_remove",
        "litellm_metadata": "gateway_metadata",
        "litellm_settings": "gateway_settings",
        "litellm_provider": "gateway_provider",
        "litellm_version": "gateway_version",
        "litellm_call_id": "gateway_call_id",
        "litellm_trace_id": "gateway_trace_id",
        "litellm_session_id": "gateway_session_id",
        "litellm_prompt_id": "gateway_prompt_id",
        "litellm_budget_table": "gateway_budget",
        "litellm_params_template": "gateway_params_template",
        "include_in_litellm_params": "include_in_gateway_params",
        "litellm_disabled_callbacks": "gateway_disabled_callbacks",
    }
)
TABLE_NAMES: Final[Mapping[str, str]] = MappingProxyType(
    {
        "LiteLLM_TeamTable": "Gateway_TeamTable",
        "LiteLLM_UserTable": "Gateway_UserTable",
        "LiteLLM_VerificationToken": "Gateway_VerificationToken",
        "LiteLLM_ProxyModelTable": "Gateway_ProxyModelTable",
        "LiteLLM_ManagedFileTable": "Gateway_ManagedFileTable",
        "LiteLLM_ToolTable": "Gateway_ToolTable",
        "LiteLLM_CacheConfig": "Gateway_CacheConfig",
        "LiteLLM_ConfigOverrides": "Gateway_ConfigOverrides",
        "LiteLLM_Config": "Gateway_Config",
        "LiteLLM_SSOConfig": "Gateway_SSOConfig",
        "LiteLLM_UISettings": "Gateway_UISettings",
        "LiteLLM_AgentsTable": "Gateway_AgentsTable",
        "LiteLLM_OrganizationTable": "Gateway_OrganizationTable",
    }
)
INTERNAL_TABLE_NAMES: Final[Mapping[str, str]] = MappingProxyType({v: k for k, v in TABLE_NAMES.items()})
PROVIDER_NAMES: Final[Mapping[str, str]] = MappingProxyType(
    {"litellm_proxy": "ai_gateway", "LITELLM_PROXY": "AI_GATEWAY", "litellm_content_filter": "gateway_content_filter"}
)
INTERNAL_PROVIDER_NAMES: Final[Mapping[str, str]] = MappingProxyType({v: k for k, v in PROVIDER_NAMES.items()})
ENUM_FIELDS: Final = frozenset(
    {"table_name", "provider", "litellm_provider", "gateway_provider", "custom_llm_provider", "guardrail"}
)
INTERNAL_FIELDS: Final[Mapping[str, str]] = MappingProxyType({v: k for k, v in FIELD_NAMES.items()})
OPAQUE_FIELDS: Final = frozenset(
    {
        "metadata",
        "gateway_metadata",
        "litellm_metadata",
        "messages",
        "content",
        "input",
        "output",
        "choices",
        "tools",
        "tool_calls",
        "arguments",
        "parameters",
        "json_schema",
        "response_format",
        "usage",
        "model_info",
        "environment_variables",
    }
)
PATH_NAMES: Final[Mapping[str, str]] = MappingProxyType(
    {
        "/litellm-asset-prefix": "/ai-gateway-assets",
        "/ui/litellm-runtime-config.json": "/ui/ai-gateway-runtime-config.json",
        "/litellm/.well-known/litellm-ui-config": "/ai-gateway/.well-known/ui-config",
        "/.well-known/litellm-ui-config": "/.well-known/ai-gateway-ui-config",
        "/.well-known/litellm-cli-auth": "/.well-known/ai-gateway-cli-auth",
        "/public/litellm_blog_posts": "/public/gateway_updates",
        "/public/litellm_model_cost_map": "/public/gateway_model_cost_map",
    }
)


def public_path(path: str) -> str:
    for old, new in PATH_NAMES.items():
        if path == old or path.startswith(old + "/"):
            return new + path[len(old) :]
    return path


def internal_path(path: str) -> str:
    for old, new in PATH_NAMES.items():
        if path == new or path.startswith(new + "/"):
            return old + path[len(new) :]
    return path


def public_header(name: str) -> str:
    return "x-ai-gateway-" + name[10:] if name.lower().startswith("x-litellm-") else name


def internal_header(name: str) -> str:
    return "x-litellm-" + name[13:] if name.lower().startswith("x-ai-gateway-") else name


def translate_fields(value: JsonValue, *, incoming: bool = False) -> JsonValue:
    names: Final = INTERNAL_FIELDS if incoming else FIELD_NAMES
    if isinstance(value, list):
        return [translate_fields(item, incoming=incoming) for item in value]
    if not isinstance(value, dict):
        return value
    return {
        names.get(key, _environment_field(key, incoming)): item
        if key in OPAQUE_FIELDS
        else _translate_field_value(key, item, incoming)
        for key, item in value.items()
        if not (incoming and key in FIELD_NAMES and FIELD_NAMES[key] in value)
    }


def _translate_field_value(key: str, value: JsonValue, incoming: bool) -> JsonValue:
    if key in ENUM_FIELDS and isinstance(value, str):
        return translate_enum_value(key, value, incoming=incoming)
    if not incoming and key in {"ui_friendly_name", "provider_display_name"} and isinstance(value, str):
        return product_description(value)
    return translate_fields(value, incoming=incoming)


def translate_enum_value(key: str, value: str, *, incoming: bool = False) -> str:
    if key == "table_name":
        tables: Final = INTERNAL_TABLE_NAMES if incoming else TABLE_NAMES
        return tables.get(value, value)
    if key in ENUM_FIELDS:
        providers: Final = INTERNAL_PROVIDER_NAMES if incoming else PROVIDER_NAMES
        return providers.get(value, value)
    return value


def _environment_field(key: str, incoming: bool) -> str:
    source: Final = "AI_GATEWAY_" if incoming else "LITELLM_"
    target: Final = "LITELLM_" if incoming else "AI_GATEWAY_"
    return target + key[len(source) :] if key.startswith(source) else key


def product_description(value: str) -> str:
    without_links: Final = re.sub(r"https?://(?:docs\.|www\.|models\.)?litellm\.ai[^\s\)\]\"<>]*", "/docs", value)
    with_tokens: Final = re.sub(
        r"\b(?:litellm_db|litellm-executed)\b",
        lambda match: {"litellm_db": "gateway_db", "litellm-executed": "gateway-executed"}[match[0]],
        without_links,
    )
    fields: Final = re.sub(
        r"\b(?:" + "|".join(FIELD_NAMES) + r")\b", lambda match: FIELD_NAMES[match[0]], with_tokens
    )
    environment: Final = fields.replace("LITELLM_", "AI_GATEWAY_")
    return re.sub(r"litellm", PRODUCT_NAME, environment, flags=re.IGNORECASE)


def public_schema(value: JsonValue) -> JsonValue:
    if isinstance(value, list):
        return [public_schema(item) for item in value]
    if isinstance(value, dict):
        return {str(public_schema(key)): public_schema(item) for key, item in value.items()}
    if not isinstance(value, str):
        return value
    if value in PROVIDER_NAMES:
        return PROVIDER_NAMES[value]
    if value in TABLE_NAMES:
        return TABLE_NAMES[value]
    if value in FIELD_NAMES:
        return FIELD_NAMES[value]
    return product_description(public_path(value).replace("x-litellm-", "x-ai-gateway-"))
