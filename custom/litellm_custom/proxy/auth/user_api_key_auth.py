from collections.abc import Awaitable, Callable

from fastapi import Request

from litellm._logging import verbose_proxy_logger
from litellm.proxy._types import ProxyException


async def enterprise_custom_auth(
    request: Request,
    api_key: str,
    user_custom_auth: Callable[[Request, str], Awaitable[object]] | None,
) -> object:
    """
    Wraps the user-provided custom auth callable according to the configured
    `custom_auth_settings.mode`:
    - "on": always call the custom auth
    - "off": never call the custom auth
    - "auto": call the custom auth and fall back to the default auth flow when
      it fails with anything other than a ProxyException
    """
    from litellm_custom.proxy.proxy_server import custom_auth_settings

    if user_custom_auth is None:
        return None

    if custom_auth_settings is None:
        return await user_custom_auth(request, api_key)

    mode = custom_auth_settings["mode"]
    if mode == "on":
        return await user_custom_auth(request, api_key)
    if mode == "off":
        return None
    if mode == "auto":
        try:
            return await user_custom_auth(request, api_key)
        except ProxyException:
            raise
        except Exception as e:
            verbose_proxy_logger.debug("Error in custom auth, checking litellm auth: %s", e)
            return None
    raise ValueError(f"Invalid mode: {mode}")
