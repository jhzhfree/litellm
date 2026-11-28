import asyncio
from collections.abc import Mapping
from typing import Final

import aiohttp
from fastapi import HTTPException
from pydantic import TypeAdapter

import litellm
from litellm._logging import verbose_proxy_logger
from litellm.integrations.custom_logger import CustomLogger
from litellm.llms.openai.common_utils import decoded_json_object
from litellm.proxy._types import UserAPIKeyAuth
from litellm.secret_managers.main import get_secret_str
from litellm.types.utils import CallTypesLiteral

_DECODED_JSON: Final = TypeAdapter(object)

_ACCEPTED_CALL_TYPES: Final = (
    "completion",
    "acompletion",
    "text_completion",
    "atext_completion",
    "embeddings",
    "embedding",
    "aembedding",
    "image_generation",
    "aimage_generation",
)


class EnterpriseLLMGuard(CustomLogger):
    """
    Content moderation and PII redaction through an LLM Guard service
    (https://llm-guard.com/). Configured through LLM_GUARD_API_BASE and
    litellm.llm_guard_mode ("all", "key-specific", "request-specific").
    """

    def __init__(
        self,
        mock_testing: bool = False,
        mock_redacted_text: Mapping[str, object] | None = None,
    ):
        self.mock_redacted_text = mock_redacted_text
        self.llm_guard_mode = litellm.llm_guard_mode
        if mock_testing is True:
            return
        self.llm_guard_api_base = get_secret_str("LLM_GUARD_API_BASE", None)
        if self.llm_guard_api_base is None:
            raise Exception("Missing `LLM_GUARD_API_BASE` from environment")
        if not self.llm_guard_api_base.endswith("/"):
            self.llm_guard_api_base += "/"

    async def moderation_check(self, text: str) -> str:
        """
        Runs the LLM Guard moderation check on `text`. Raises an HTTPException
        when the content violates the safety policy, otherwise returns the
        sanitized prompt, falling back to the original text when the service
        does not provide one.
        """
        try:
            if self.mock_redacted_text is not None:
                redacted_text = self.mock_redacted_text
            else:
                analyze_url = f"{self.llm_guard_api_base}analyze/prompt"
                verbose_proxy_logger.debug("Making request to: %s", analyze_url)
                async with aiohttp.ClientSession() as session:
                    async with session.post(analyze_url, json={"prompt": text}) as response:
                        redacted_text = _DECODED_JSON.validate_python(await response.json())

            verbose_proxy_logger.debug("LLM Guard: Received response - %s", redacted_text)
            if redacted_text is None:
                raise HTTPException(status_code=500, detail={"error": f"Invalid content moderation response: {redacted_text}"})

            redacted_response: Final = decoded_json_object(redacted_text)
            if redacted_response.get("is_valid", None) is False:
                raise HTTPException(status_code=400, detail={"error": "Violated content safety policy"})
            sanitized_prompt: Final = redacted_response.get("sanitized_prompt")
            return sanitized_prompt if isinstance(sanitized_prompt, str) else text
        except Exception as e:
            verbose_proxy_logger.exception(
                f"litellm_custom.enterprise_callbacks.llm_guard::moderation_check - Exception occurred - {e!s}"
            )
            raise e

    def should_proceed(self, user_api_key_dict: UserAPIKeyAuth, data: dict) -> bool:
        if self.llm_guard_mode == "key-specific":
            return user_api_key_dict.permissions.get("enable_llm_guard_check", False) is True
        if self.llm_guard_mode == "all":
            return True
        if self.llm_guard_mode == "request-specific":
            metadata = data.get("metadata", {})
            permissions = metadata.get("permissions", {})
            return "enable_llm_guard_check" in permissions and permissions["enable_llm_guard_check"] is True
        return False

    async def async_moderation_hook(
        self,
        data: dict,
        user_api_key_dict: UserAPIKeyAuth,
        call_type: CallTypesLiteral,
    ):
        """
        Calls the LLM Guard service and replaces the request content with the
        sanitized prompt it returns, so PII redaction carries through to the
        provider-bound request.
        """
        verbose_proxy_logger.debug("Inside LLM Guard Pre-Call Hook - llm_guard_mode=%s", self.llm_guard_mode)

        if self.should_proceed(user_api_key_dict=user_api_key_dict, data=data) is False:
            return

        verbose_proxy_logger.debug("Makes LLM Guard Check")
        if call_type not in _ACCEPTED_CALL_TYPES:
            verbose_proxy_logger.debug("Call Type - %s, not in accepted list - %s", call_type, _ACCEPTED_CALL_TYPES)
            return data

        return await self._moderate_request(data=data)

    async def _moderate_request(self, data: dict) -> dict:
        messages = data.get("messages")
        if messages is not None:
            data["messages"] = list(await asyncio.gather(*(self._moderate_message(message) for message in messages)))

        input_ = data.get("input")
        if input_ is not None:
            data["input"] = await self._moderate_text_or_list(input_)

        prompt = data.get("prompt")
        if prompt is not None:
            data["prompt"] = await self._moderate_text_or_list(prompt)
        return data

    async def _moderate_message(self, message: dict) -> dict:
        content = message.get("content")
        if isinstance(content, str):
            return {**message, "content": await self.moderation_check(text=content)}
        if isinstance(content, list):
            return {
                **message,
                "content": list(await asyncio.gather(*(self._moderate_content_part(part) for part in content))),
            }
        return message

    async def _moderate_content_part(self, part: dict) -> dict:
        if part.get("type") == "text" and isinstance(part.get("text"), str):
            return {**part, "text": await self.moderation_check(text=part["text"])}
        return part

    async def _moderate_text_or_list(self, value: object) -> object:
        if isinstance(value, str):
            return await self.moderation_check(text=value)
        if isinstance(value, list):
            return [await self.moderation_check(text=item) if isinstance(item, str) else item for item in value]
        return value

    async def async_post_call_streaming_hook(
        self, user_api_key_dict: UserAPIKeyAuth, response: str
    ):
        if response is not None:
            await self.moderation_check(text=response)

        return response


_ENTERPRISE_LLMGuard = EnterpriseLLMGuard
