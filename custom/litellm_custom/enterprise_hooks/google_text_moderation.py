from typing import Final

from fastapi import HTTPException
from pydantic import TypeAdapter

import litellm
from litellm._logging import verbose_proxy_logger
from litellm.integrations.custom_logger import CustomLogger
from litellm.proxy._types import UserAPIKeyAuth
from litellm.proxy.guardrails._content_utils import (
    is_non_conversational_request,
    iter_message_text,
)
from litellm.types.utils import CallTypesLiteral

_THRESHOLD_VALUE: Final = TypeAdapter(object)


class EnterpriseGoogleTextModeration(CustomLogger):
    """
    Moderates request content through the Google Cloud Natural Language
    Moderating Text API. Per-category confidence thresholds default to
    litellm.google_moderation_confidence_threshold (0.8).
    """

    # https://cloud.google.com/natural-language/docs/moderating-text#safety_attribute_confidence_scores
    confidence_categories = [
        "toxic",
        "insult",
        "profanity",
        "derogatory",
        "sexual",
        "death_harm_and_tragedy",
        "violent",
        "firearms_and_weapons",
        "public_safety",
        "health",
        "religion_and_belief",
        "illicit_drugs",
        "war_and_conflict",
        "politics",
        "finance",
        "legal",
    ]

    def __init__(self):
        try:
            from google.cloud import language_v1
        except Exception:
            raise Exception("Missing google.cloud package. Run `pip install --upgrade google-cloud-language`")

        self.client = language_v1.LanguageServiceClient()
        self.moderate_text_request = language_v1.ModerateTextRequest
        self.language_document = language_v1.types.Document
        self.document_type = language_v1.types.Document.Type.PLAIN_TEXT

        default_confidence_threshold = litellm.google_moderation_confidence_threshold or 0.8

        for category in self.confidence_categories:
            if hasattr(litellm, f"{category}_confidence_threshold"):
                threshold = getattr(litellm, f"{category}_confidence_threshold")
            else:
                threshold = default_confidence_threshold
            setattr(self, f"{category}_confidence_threshold", threshold)
            set_confidence_value = _THRESHOLD_VALUE.validate_python(threshold)
            verbose_proxy_logger.info(f"Google Text Moderation: {category}_confidence_threshold: {set_confidence_value}")

    async def async_moderation_hook(
        self,
        data: dict[str, object],
        user_api_key_dict: UserAPIKeyAuth,
        call_type: CallTypesLiteral,
    ):
        """
        Calls the Google Text Moderation API and rejects the request when a
        category confidence exceeds the configured threshold.
        """
        if is_non_conversational_request(call_type, data):
            verbose_proxy_logger.debug("Google text moderation: skipping non-conversational call type %s", call_type)
            return

        text = "".join(iter_message_text(data))
        if text:
            document = self.language_document(content=text, type_=self.document_type)
            request = self.moderate_text_request(document=document)

            response = self.client.moderate_text(request=request)
            for category in response.moderation_categories:
                category_name = category.name.lower().replace("&", "and").replace(",", "").replace(" ", "_")
                if category.confidence > getattr(self, f"{category_name}_confidence_threshold"):
                    raise HTTPException(
                        status_code=400,
                        detail={"error": f"Violated content safety policy. Category={category}"},
                    )
            return data


_ENTERPRISE_GoogleTextModeration = EnterpriseGoogleTextModeration
