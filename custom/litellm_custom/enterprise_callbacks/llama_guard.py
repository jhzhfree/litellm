from collections.abc import Iterable

from fastapi import HTTPException

import litellm
from litellm._logging import verbose_proxy_logger
from litellm.integrations.custom_logger import CustomLogger
from litellm.proxy._types import UserAPIKeyAuth
from litellm.types.utils import CallTypesLiteral, Choices, ModelResponse


class EnterpriseLlamaGuard(CustomLogger):
    """
    Content moderation through a Llama Guard endpoint. The request is rejected
    with a 400 when the guard model answers `unsafe`.
    """

    def __init__(self, model_name: str | None = None):
        model = model_name or litellm.llamaguard_model_name
        if model is None:
            raise ValueError("model_name not set for LlamaGuard")
        self.model = model

        self.unsafe_content_categories: str | None = None
        file_path = litellm.llamaguard_unsafe_content_categories
        if file_path is not None:
            try:
                with open(file_path, "r") as file:
                    self.unsafe_content_categories = file.read()
            except FileNotFoundError:
                raise Exception(f"File not found. file_path={file_path}")
            except Exception as e:
                raise Exception(f"An error occurred: {e!s}, file_path={file_path}")

        verbose_proxy_logger.debug("self.unsafe_content_categories: %s", self.unsafe_content_categories)

    def set_custom_prompt_template(self, messages: list):
        if self.unsafe_content_categories is not None and self.model is not None:
            role = "Agent" if len(messages) % 2 == 0 else "User"
            litellm.register_prompt_template(
                model=self.model,
                initial_prompt_value=f"""[INST] Task: Check if there is unsafe content in '{role}' messages in conversations according our safety policy with the below categories.

                <BEGIN UNSAFE CONTENT CATEGORIES>
                {self.unsafe_content_categories}
                <END UNSAFE CONTENT CATEGORIES>

                <BEGIN CONVERSATION>

                """,
                roles={
                    "system": {"pre_message": "User: ", "post_message": "\n\n"},
                    "user": {"pre_message": "User: ", "post_message": "\n\n"},
                    "assistant": {"pre_message": "Agent: ", "post_message": "\n\n"},
                },
                final_prompt_value="""<END CONVERSATION>

        Provide your safety assessment for {role} in the above conversation:
        - First line must read 'safe' or 'unsafe'.
        - If unsafe, a second line must include a comma-separated list of violated categories. [/INST]""",
            )

    async def async_moderation_hook(
        self,
        data: dict,
        user_api_key_dict: UserAPIKeyAuth,
        call_type: CallTypesLiteral,
    ):
        """
        Calls the Llama Guard endpoint and rejects the request when the safety
        check fails. The prompt template is applied automatically in factory.py.
        """
        if "messages" in data:
            safety_check_messages = data["messages"][-1]  # guard model has a small context window
            response = await litellm.acompletion(
                model=self.model,
                messages=[safety_check_messages],
                hf_model_name="meta-llama/LlamaGuard-7b",
            )

            if (
                isinstance(response, ModelResponse)
                and isinstance(response.choices[0], Choices)
                and response.choices[0].message.content is not None
                and isinstance(response.choices[0].message.content, Iterable)
                and "unsafe" in response.choices[0].message.content
            ):
                raise HTTPException(status_code=400, detail={"error": "Violated content safety policy"})

        return data


_ENTERPRISE_LlamaGuard = EnterpriseLlamaGuard
