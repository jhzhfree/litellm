"""Mount-point contract between the OSS proxy server and litellm_custom.

The proxy server wires the package through guarded imports; a missing symbol
there silently no-ops the whole enterprise feature surface (empty router, no
hooks). These tests pin every symbol the trunk imports so a rename inside the
package cannot ship unnoticed again.
"""

from __future__ import annotations

from litellm_custom.proxy.proxy_server import EnterpriseProxyConfig
from litellm_custom.proxy.proxy_server import custom_auth_settings


def test_proxy_server_exports_enterprise_proxy_config() -> None:
    config = EnterpriseProxyConfig()
    assert hasattr(config, "load_enterprise_config")
    assert hasattr(config, "get_custom_docs_description")


def test_load_enterprise_config_stores_custom_auth_settings() -> None:
    import asyncio

    config = EnterpriseProxyConfig()
    asyncio.run(
        config.load_enterprise_config({"custom_auth_settings": {"mode": "auto"}})
    )
    assert custom_auth_settings is not None
    assert custom_auth_settings["mode"] == "auto"
