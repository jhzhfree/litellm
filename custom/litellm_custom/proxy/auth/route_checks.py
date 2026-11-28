import os

from fastapi import HTTPException, status

from litellm.proxy._types import MODEL_LIST_ROUTES


class EnterpriseRouteChecks:
    """
    Route gating driven by the DISABLE_ADMIN_ENDPOINTS / DISABLE_LLM_API_ENDPOINTS
    environment settings. Model listing routes stay reachable so the admin UI
    keeps working when inference endpoints are turned off.
    """

    LLM_API_EXEMPT_ROUTES = MODEL_LIST_ROUTES

    @staticmethod
    def is_llm_api_route_disabled() -> bool:
        from litellm.proxy._types import CommonProxyErrors
        from litellm.proxy.proxy_server import premium_user
        from litellm.secret_managers.main import get_secret_bool

        if "DISABLE_LLM_API_ENDPOINTS" in os.environ:
            if not premium_user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"DISABLING LLM API ENDPOINTS is an Enterprise feature\n{CommonProxyErrors.not_premium_user.value}",
                )
        return get_secret_bool("DISABLE_LLM_API_ENDPOINTS") is True

    @staticmethod
    def is_management_routes_disabled() -> bool:
        from litellm.proxy._types import CommonProxyErrors
        from litellm.proxy.proxy_server import premium_user
        from litellm.secret_managers.main import get_secret_bool

        if "DISABLE_ADMIN_ENDPOINTS" in os.environ:
            if not premium_user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"DISABLING ADMIN ENDPOINTS is an Enterprise feature\n{CommonProxyErrors.not_premium_user.value}",
                )
        return get_secret_bool("DISABLE_ADMIN_ENDPOINTS") is True

    @staticmethod
    def should_call_route(route: str):
        from litellm.proxy.auth.route_checks import RouteChecks

        if RouteChecks.is_management_route(route=route) and EnterpriseRouteChecks.is_management_routes_disabled():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Management routes are disabled for this instance.",
            )
        if (
            RouteChecks.is_llm_api_route(route=route)
            and route not in EnterpriseRouteChecks.LLM_API_EXEMPT_ROUTES
            and EnterpriseRouteChecks.is_llm_api_route_disabled()
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="LLM API routes are disabled for this instance.",
            )
