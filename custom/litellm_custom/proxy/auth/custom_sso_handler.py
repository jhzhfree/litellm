from typing import cast

from fastapi import Request
from fastapi.responses import RedirectResponse


class EnterpriseCustomSSOHandler:
    """
    Custom UI SSO sign in for deployments that sit behind an OAuth proxy. The
    user-provided handler turns request headers into an OpenID object, and this
    class turns that into the normal UI redirect response.
    """

    @staticmethod
    async def handle_custom_ui_sso_sign_in(request: Request) -> RedirectResponse:
        from fastapi_sso.sso.base import OpenID

        from litellm.integrations.custom_sso_handler import CustomSSOLoginHandler
        from litellm.proxy.auth.trusted_proxy_utils import require_trusted_proxy_request
        from litellm.proxy.proxy_server import (
            CommonProxyErrors,
            general_settings,
            premium_user,
            user_custom_ui_sso_sign_in_handler,
        )

        if premium_user is not True:
            raise ValueError(CommonProxyErrors.not_premium_user.value)

        if user_custom_ui_sso_sign_in_handler is None:
            raise ValueError("custom_ui_sso_sign_in_handler is not configured. Please set it in general_settings.")

        require_trusted_proxy_request(
            request=request,
            general_settings=general_settings,
            feature_name="Custom UI SSO",
        )

        custom_sso_login_handler = cast(CustomSSOLoginHandler, user_custom_ui_sso_sign_in_handler)
        openid_response: OpenID = await custom_sso_login_handler.handle_custom_ui_sso_sign_in(request=request)

        from litellm.proxy.management_endpoints.ui_sso import SSOAuthenticationHandler

        return await SSOAuthenticationHandler.get_redirect_response_from_openid(
            result=openid_response,
            request=request,
            received_response=None,
            generic_client_id=None,
            ui_access_mode=None,
        )
