from fastapi import HTTPException

import litellm
from litellm._logging import verbose_proxy_logger
from litellm.constants import DEFAULT_OPENAI_MODERATIONS_MODEL
from litellm.integrations.custom_logger import CustomLogger
from litellm.proxy._types import UserAPIKeyAuth
from litellm.proxy.guardrails._content_utils import iter_message_text
from litellm.types.utils import CallTypesLiteral


class EnterpriseOpenAIModeration(CustomLogger):
    """Moderates request content through the OpenAI /moderations endpoint."""

    @property
    def model_name(self) -> str:
        return litellm.openai_moderations_model_name or DEFAULT_OPENAI_MODERATIONS_MODEL

    async def async_moderation_hook(
        self,
        data: dict,
        user_api_key_dict: UserAPIKeyAuth,
        call_type: CallTypesLiteral,
    ):
        # covers multimodal list content plus Responses-API input
        text = "".join(iter_message_text(data))

        from litellm.proxy.proxy_server import llm_router

        if llm_router is None:
            return

        moderation_response = await llm_router.amoderation(model=self.model_name, input=text)

        verbose_proxy_logger.debug("Moderation response: %s", moderation_response)
        if moderation_response and moderation_response.results[0].flagged is True:
            raise HTTPException(status_code=403, detail={"error": "Violated content safety policy"})


_ENTERPRISE_OpenAI_Moderation = EnterpriseOpenAIModeration

ENTERPRISE_OpenAI_Moderation = _ENTERPRISE_OpenAI_Moderation
