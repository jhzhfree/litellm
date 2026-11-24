"""Exercise the gateway's generic SSO adapter against the local identity platform."""

import argparse
import asyncio
import logging
import os
import secrets
import sys
from contextlib import ExitStack
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from uuid import uuid4

from playwright.async_api import async_playwright
from smoke import BASE, request
from starlette.requests import Request

CALLBACK = "http://127.0.0.1:4001/sso/callback"
ISSUER = BASE + "/realms/company"


def callback_request(location, cookie):
    parsed = urlparse(location)
    assert (parsed.scheme, parsed.netloc, parsed.path) == ("http", "127.0.0.1:4001", "/sso/callback")
    return Request(
        {
            "type": "http",
            "method": "GET",
            "scheme": "http",
            "path": parsed.path,
            "query_string": parsed.query.encode(),
            "headers": [(b"cookie", cookie.encode())],
            "server": ("127.0.0.1", 4001),
        }
    )


async def verify_login(client_id, secret, username, password, subject, *, unified_oidc=False):
    from fastapi_sso.sso.generic import create_provider

    from litellm.proxy import proxy_server
    from litellm.proxy._types import LiteLLM_JWTAuth, ProxyException
    from litellm.proxy.management_endpoints.ui_sso import SSOAuthenticationHandler, get_generic_sso_response

    proxy_server.jwt_handler.update_environment(
        prisma_client=None,
        user_api_key_cache=proxy_server.user_api_key_cache,
        litellm_jwtauth=LiteLLM_JWTAuth(),
    )
    settings = {
        "GENERIC_CLIENT_ID": client_id,
        "GENERIC_CLIENT_SECRET": secret,
        "GENERIC_CLIENT_USE_PKCE": "true",
        "PKCE_STRICT_CACHE_MISS": "true",
        "GENERIC_SCOPE": "openid profile email",
        "GENERIC_USER_ID_ATTRIBUTE": "sub",
        "GENERIC_USER_EMAIL_ATTRIBUTE": "email",
        "GENERIC_USER_DISPLAY_NAME_ATTRIBUTE": "name",
        "GENERIC_INCLUDE_TOKEN_CLAIMS": "false",
        "GENERIC_AUTHORIZATION_ENDPOINT": ISSUER + "/protocol/openid-connect/auth",
        "GENERIC_TOKEN_ENDPOINT": ISSUER + "/protocol/openid-connect/token",
        "GENERIC_USERINFO_ENDPOINT": ISSUER + "/protocol/openid-connect/userinfo",
    }
    if unified_oidc:
        settings["LITELLM_UNIFIED_OIDC_ISSUER"] = ISSUER
        settings["LITELLM_UNIFIED_OIDC_JWKS_URL"] = ISSUER + "/protocol/openid-connect/certs"
    os.environ.update(settings)
    provider = create_provider(
        name="oidc",
        discovery_document={
            "authorization_endpoint": settings["GENERIC_AUTHORIZATION_ENDPOINT"],
            "token_endpoint": settings["GENERIC_TOKEN_ENDPOINT"],
            "userinfo_endpoint": settings["GENERIC_USERINFO_ENDPOINT"],
        },
    )
    sso = provider(
        client_id=client_id,
        client_secret=secret,
        redirect_uri=CALLBACK,
        allow_insecure_http=True,
        scope=["openid", "profile", "email"],
    )
    redirect = await SSOAuthenticationHandler.get_generic_sso_redirect_response(
        generic_sso=sso,
        request=callback_request(CALLBACK, ""),
    )
    assert redirect is not None
    location = redirect.headers["location"]
    query = parse_qs(urlparse(location).query)
    assert query["code_challenge_method"] == ["S256"]
    cookies = SimpleCookie()
    for header in redirect.headers.getlist("set-cookie"):
        cookies.load(header)
    state = cookies["litellm_oauth_state"].value
    assert query["state"] == [state] and cookies["litellm_oauth_state"]["httponly"]
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=os.getenv("IDENTITY_TEST_CHROMIUM", "/usr/bin/chromium"), headless=True
        )
        try:
            page = await browser.new_page()
            await page.route(CALLBACK + "?**", lambda route: route.fulfill(status=200, body="SSO callback received"))
            await page.goto(location)
            await page.locator('input[name="username"]').fill(username)
            await page.locator('input[name="password"]').fill(password)
            await page.locator('[type="submit"]').click()
            await page.wait_for_url(CALLBACK + "?**")
            callback = page.url
        finally:
            await browser.close()
    assert "code" in parse_qs(urlparse(callback).query)

    async def exchange(cookie, callback_url=callback):
        return await get_generic_sso_response(
            request=callback_request(callback_url, cookie),
            jwt_handler=proxy_server.jwt_handler,
            sso_jwt_handler=None,
            generic_client_id=client_id,
            redirect_url=CALLBACK,
        )

    missing_state_url = CALLBACK + "?" + urlencode({"code": parse_qs(urlparse(callback).query)["code"][0]})
    try:
        await exchange("litellm_oauth_state=" + state, missing_state_url)
    except ProxyException as exc:
        assert str(exc.code) == ("403" if unified_oidc else "400")
        if not unified_oidc:
            assert exc.param == "state"
    else:
        raise AssertionError("PKCE callback without state was accepted")
    try:
        await exchange("litellm_oauth_state=incorrect")
    except ProxyException as exc:
        assert str(exc.code) == ("403" if unified_oidc else "400")
    else:
        raise AssertionError("Mismatched browser state was accepted")
    result, _, _, _ = await exchange("litellm_oauth_state=" + state)
    if unified_oidc:
        from litellm.proxy.management_endpoints.sso.unified_oidc import UnifiedOIDCUser, binding_key

        assert isinstance(result, UnifiedOIDCUser)
        assert result.identity_subject == subject
        assert result.id == binding_key(ISSUER, subject)
    else:
        assert result.id == subject and result.email == username + "@example.com"
    sys.stdout.write(
        "PASS real authorization-code login through gateway generic SSO with PKCE and stable subject mapping\n"
    )
    try:
        await exchange("litellm_oauth_state=" + state)
    except ProxyException as exc:
        assert str(exc.code) == ("403" if unified_oidc else "401")
        sys.stdout.write("PASS missing state, mismatched browser state and callback replay are rejected\n")
    else:
        raise AssertionError("Callback replay was accepted")


def main():
    logging.disable(logging.CRITICAL)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--env-file", type=Path, default=Path(__file__).with_name(".env"))
    parser.add_argument("--unified-oidc", action="store_true")
    args = parser.parse_args()
    env = dict(line.split("=", 1) for line in args.env_file.read_text().splitlines() if "=" in line)
    token = request(
        "/realms/master/protocol/openid-connect/token",
        {
            "grant_type": "password",
            "client_id": "admin-cli",
            "username": "admin",
            "password": env["IDENTITY_ADMIN_PASSWORD"],
        },
        form=True,
    )["access_token"]
    root = "/admin/realms/company"
    name = "sso-test-" + uuid4().hex
    password = secrets.token_urlsafe(32)
    with ExitStack() as cleanup:
        request(
            root + "/users",
            {
                "username": name,
                "enabled": True,
                "emailVerified": True,
                "email": name + "@example.com",
                "firstName": "Test",
                "lastName": "User",
                "credentials": [{"type": "password", "value": password, "temporary": False}],
            },
            token,
        )
        user = request(root + "/users?username=" + name + "&exact=true", token=token)[0]
        cleanup.callback(request, root + "/users/" + user["id"], token=token, method="DELETE")
        request(
            root + "/clients",
            {
                "clientId": name,
                "enabled": True,
                "protocol": "openid-connect",
                "publicClient": False,
                "standardFlowEnabled": True,
                "directAccessGrantsEnabled": False,
                "redirectUris": [CALLBACK],
                "attributes": {"pkce.code.challenge.method": "S256"},
                "defaultClientScopes": ["profile", "email"],
            },
            token,
        )
        client = request(root + "/clients?clientId=" + name, token=token)[0]
        cleanup.callback(request, root + "/clients/" + client["id"], token=token, method="DELETE")
        secret = request(root + "/clients/" + client["id"] + "/client-secret", token=token)["value"]
        asyncio.run(verify_login(name, secret, name, password, user["id"], unified_oidc=args.unified_oidc))


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stdout.write("FAIL local SSO integration " + type(error).__name__ + "\n")
        raise SystemExit(1) from None
