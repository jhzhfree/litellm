
from litellm.types.guardrails import GuardrailEventHooks, Mode


class EnterpriseCustomGuardrailHelper:
    """
    Tag based guardrail modes: a `Mode` guardrail can carry per-tag overrides
    (`tags: {tag_name: mode}`) plus a `default` mode. The request tags decide
    which mode applies; when no request tag matches a configured tag the
    default applies.
    """

    @staticmethod
    def _should_run_if_mode_by_tag(
        data: dict,
        event_hook: GuardrailEventHooks | list[GuardrailEventHooks] | Mode | None,
        event_type: GuardrailEventHooks | None = None,
    ) -> bool | None:
        from litellm.litellm_core_utils.core_helpers import get_metadata_variable_name_from_kwargs
        from litellm.litellm_core_utils.litellm_logging import StandardLoggingPayloadSetup
        from litellm.proxy._types import CommonProxyErrors
        from litellm.proxy.proxy_server import premium_user
        from litellm.router_strategy.tag_based_routing import without_baggage_mapped_tags

        if not premium_user:
            raise Exception(
                f"Setting tag based guardrail modes is only available in litellm-enterprise. {CommonProxyErrors.not_premium_user.value}."
            )

        if event_hook is None or not isinstance(event_hook, Mode):
            return None

        proxy_server_request = data.get("proxy_server_request", {})

        request_tags = without_baggage_mapped_tags(
            StandardLoggingPayloadSetup.get_request_tags(
                litellm_params=data,
                proxy_server_request=proxy_server_request,
            ),
            data.get(get_metadata_variable_name_from_kwargs(data)),
            keep_serving_deployment_tags=True,
        )

        matched_mode = None
        if request_tags:
            for tag in request_tags:
                if tag in event_hook.tags:
                    matched_mode = event_hook.tags[tag]
                    break

        if matched_mode is not None:
            if event_type is not None:
                if isinstance(matched_mode, list):
                    return event_type.value in matched_mode
                return event_type.value == matched_mode
            return True

        if event_hook.default is not None:
            if event_type is not None:
                default_list = event_hook.default if isinstance(event_hook.default, list) else [event_hook.default]
                return event_type.value in default_list
            return False

        return False
