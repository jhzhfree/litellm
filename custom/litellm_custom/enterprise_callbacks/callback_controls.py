
import litellm
from litellm._logging import verbose_logger
from litellm.constants import X_LITELLM_DISABLE_CALLBACKS
from litellm.integrations.custom_logger import CustomLogger
from litellm.litellm_core_utils.llm_request_utils import get_proxy_server_request_headers
from litellm.types.utils import StandardCallbackDynamicParams


class EnterpriseCallbackControls:
    """
    Allows disabling individual callbacks per request through the
    `x-litellm-disable-callbacks` header or the `litellm_disabled_callbacks`
    body field, gated by `litellm.allow_dynamic_callback_disabling`.
    """

    @staticmethod
    def is_callback_disabled_dynamically(
        callback: litellm.CALLBACK_TYPES,
        litellm_params: dict,
        standard_callback_dynamic_params: StandardCallbackDynamicParams,
    ) -> bool:
        from litellm.litellm_core_utils.custom_logger_registry import CustomLoggerRegistry

        try:
            disabled_callbacks = EnterpriseCallbackControls.get_disabled_callbacks(
                litellm_params, standard_callback_dynamic_params
            )
            if disabled_callbacks is not None:
                if not EnterpriseCallbackControls._should_allow_dynamic_callback_disabling():
                    return False
                if isinstance(callback, str):
                    if callback.lower() in disabled_callbacks:
                        verbose_logger.debug(f"Not logging to {callback} because it is disabled via {X_LITELLM_DISABLE_CALLBACKS}")
                        return True
                elif isinstance(callback, CustomLogger):
                    callback_str = CustomLoggerRegistry.get_callback_str_from_class_type(callback.__class__)
                    if callback_str is not None and callback_str.lower() in disabled_callbacks:
                        verbose_logger.debug(f"Not logging to {callback_str} because it is disabled via {X_LITELLM_DISABLE_CALLBACKS}")
                        return True
            return False
        except Exception as e:
            verbose_logger.debug("Error checking disabled callbacks header: %s", str(e))
            return False

    @staticmethod
    def get_disabled_callbacks(
        litellm_params: dict, standard_callback_dynamic_params: StandardCallbackDynamicParams
    ) -> list[str] | None:
        request_headers = get_proxy_server_request_headers(litellm_params)
        disabled_callbacks = request_headers.get(X_LITELLM_DISABLE_CALLBACKS, None)
        if disabled_callbacks is not None:
            return list({cb.strip().lower() for cb in disabled_callbacks.split(",")})

        body_value = standard_callback_dynamic_params.get("litellm_disabled_callbacks", None)
        if body_value is not None:
            return body_value
        return None

    @staticmethod
    def _should_allow_dynamic_callback_disabling() -> bool:
        import litellm
        from litellm.proxy._types import CommonProxyErrors
        from litellm.proxy.proxy_server import premium_user

        if litellm.allow_dynamic_callback_disabling is not True:
            verbose_logger.debug(
                "Dynamic callback disabling is disabled by admin via litellm.allow_dynamic_callback_disabling"
            )
            return False

        if premium_user:
            return True
        verbose_logger.warning(
            f"Disabling callbacks using request headers is an enterprise feature. {CommonProxyErrors.not_premium_user.value}"
        )
        return False
