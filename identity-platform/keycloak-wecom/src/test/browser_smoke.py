import logging
import os
import secrets
from typing import Final
from urllib.parse import parse_qs, urlencode, urlparse

import httpx
from playwright.sync_api import Route, sync_playwright

logger: Final = logging.getLogger(__name__)


def intercept_wecom(route: Route) -> None:
    route.fulfill(status=200, body="Enterprise login boundary intercepted by isolated smoke test")


def check_login(base: str, realm: str) -> None:
    params: Final = {
        "client_id": "smoke",
        "redirect_uri": "http://127.0.0.1:18083/callback",
        "response_type": "code",
        "scope": "openid",
        "state": secrets.token_urlsafe(24),
        "nonce": secrets.token_urlsafe(24),
    }
    with sync_playwright() as pw:
        browser: Final = pw.chromium.launch(
            executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"),
            headless=True,
            args=["--no-sandbox"],
        )
        try:
            page: Final = browser.new_page()
            page.route("https://open.work.weixin.qq.com/**", intercept_wecom)
            page.goto(f"{base}/realms/{realm}/protocol/openid-connect/auth?{urlencode(params)}")
            page.locator("#social-wecom").click()
            page.wait_for_url("https://open.work.weixin.qq.com/**")
            query: Final = parse_qs(urlparse(page.url).query)
            assert query["appid"] == ["test-corp"]
            assert query["agentid"] == ["1000001"]
            assert "dummy-not-real" not in page.url
            callback: Final = query["redirect_uri"][0]
            assert callback == f"{base}/realms/{realm}/broker/wecom/endpoint"
            cancelled: Final = page.goto(callback + "?" + urlencode({"state": query["state"][0]}))
            assert cancelled is not None and cancelled.status == 400
            replay: Final = page.goto(callback + "?" + urlencode({"state": query["state"][0], "code": "unused"}))
            assert replay is not None and replay.status == 400
            missing: Final = page.goto(callback)
            assert missing is not None and missing.status == 400
        finally:
            browser.close()


def main() -> None:
    base: Final = os.environ.get("WECOM_SMOKE_KEYCLOAK_URL", "http://127.0.0.1:18082").rstrip("/")
    assert urlparse(base).hostname in {"localhost", "127.0.0.1", "::1"}, "Use an isolated local Keycloak"
    with httpx.Client(base_url=base, trust_env=False, timeout=20) as client:
        token_response: Final = client.post(
            "/realms/master/protocol/openid-connect/token",
            data={
                "client_id": "admin-cli",
                "grant_type": "password",
                "username": os.environ["KC_BOOTSTRAP_ADMIN_USERNAME"],
                "password": os.environ["KC_BOOTSTRAP_ADMIN_PASSWORD"],
            },
        )
        token_response.raise_for_status()
        token: Final[object] = token_response.json().get("access_token")
        assert isinstance(token, str) and token
        headers: Final = {"Authorization": "Bearer " + token}
        realm: Final = "wecom-smoke-" + secrets.token_hex(8)
        root: Final = "/admin/realms/" + realm
        client.post(
            "/admin/realms",
            headers=headers,
            json={
                "realm": realm,
                "enabled": True,
                "sslRequired": "none",
            },
        ).raise_for_status()
        try:
            client.post(
                root + "/clients",
                headers=headers,
                json={
                    "clientId": "smoke",
                    "publicClient": True,
                    "standardFlowEnabled": True,
                    "redirectUris": ["http://127.0.0.1:18083/callback"],
                },
            ).raise_for_status()
            client.post(
                root + "/identity-provider/instances",
                headers=headers,
                json={
                    "alias": "wecom",
                    "providerId": "wecom",
                    "displayName": "企业微信",
                    "enabled": True,
                    "trustEmail": False,
                    "storeToken": False,
                    "firstBrokerLoginFlowAlias": "first broker login",
                    "config": {"clientId": "test-corp", "clientSecret": "dummy-not-real", "agentId": "1000001"},
                },
            ).raise_for_status()
            check_login(base, realm)
        finally:
            client.delete(root, headers=headers).raise_for_status()
    logger.info("PASS provider configuration, browser login redirect, cancelled/replayed/missing state HTTP 400")
    logger.info("No real WeCom login or gateway session was tested")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
