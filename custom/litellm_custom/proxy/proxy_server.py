import os

from litellm_custom.types.proxy.proxy_server import CustomAuthSettings

custom_auth_settings: CustomAuthSettings | None = None


class CustomProxyConfig:
    """
    Loads the configuration knobs this package contributes to the proxy. Mirrors
    the `EnterpriseProxyConfig` mount point the OSS proxy server expects.
    """

    async def load_custom_auth_settings(
        self, general_settings: dict
    ) -> CustomAuthSettings | None:
        raw_settings = general_settings.get("custom_auth_settings", None)
        if raw_settings is None:
            return None
        return CustomAuthSettings(mode=raw_settings.get("mode"))

    async def load_enterprise_config(self, general_settings: dict) -> None:
        global custom_auth_settings
        custom_auth_settings = await self.load_custom_auth_settings(general_settings)

    @staticmethod
    def get_custom_docs_description() -> str | None:
        from litellm.proxy.proxy_server import premium_user

        if not premium_user:
            return None
        return os.getenv("DOCS_DESCRIPTION")
