"""Provision a pre-approved gateway account from a verified Keycloak realm record."""

import argparse
import os
import sys
from urllib.parse import quote

import httpx

from litellm.proxy.management_endpoints.sso.unified_oidc import binding_key, trusted_endpoint


def link_user(client: httpx.Client, issuer: str, subject: str, gateway: str, headers: dict[str, str]) -> str:
    identity = binding_key(issuer, subject)
    payload = {
        "user_id": identity,
        "sso_user_id": identity,
        "user_role": "internal_user_viewer",
        "models": ["no-default-models"],
        "auto_create_key": False,
        "send_invite_email": False,
    }
    lookup_url = gateway + "/user/info"
    query = {"user_id": identity}
    existing = client.get(lookup_url, params=query, headers=headers, timeout=15)
    if existing.status_code == 404:
        created = client.post(gateway + "/user/new", json=payload, headers=headers, timeout=15)
        # A simultaneous retry may have inserted the same unique binding.
        existing = client.get(lookup_url, params=query, headers=headers, timeout=15)
        if not existing.is_success:
            created.raise_for_status()
    existing.raise_for_status()
    row = existing.json().get("user_info")
    if not isinstance(row, dict) or row.get("sso_user_id") != identity:
        raise ValueError("Existing gateway account does not have the expected identity binding")
    return identity


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--issuer", required=True)
    parser.add_argument("--gateway", required=True)
    parser.add_argument("subject", help="Existing Keycloak realm user ID, obtained by an authorized operator")
    args = parser.parse_args()
    try:
        issuer = trusted_endpoint(args.issuer)
        gateway = trusted_endpoint(args.gateway).rstrip("/")
        base, separator, realm = issuer.rpartition("/realms/")
        if not separator or not base or not realm or "/" in realm:
            raise ValueError("The issuer must identify one Keycloak realm")
        admin = {"Authorization": "Bearer " + os.environ["IDENTITY_USER_MANAGER_TOKEN"]}
        gateway_auth = {"Authorization": "Bearer " + os.environ["IDENTITY_GATEWAY_PROVISIONING_TOKEN"]}
        user_url = base + "/admin/realms/" + quote(realm, safe="") + "/users/" + quote(args.subject, safe="")
        with httpx.Client(follow_redirects=False, timeout=15) as client:
            result = client.get(user_url, headers=admin)
            result.raise_for_status()
            user = result.json()
            if user.get("id") != args.subject or user.get("enabled") is not True:
                raise ValueError("The subject does not identify an enabled realm user")
            if user.get("serviceAccountClientId") or "service-account-client" in user or (
                isinstance(user.get("username"), str) and user["username"].startswith("service-account-")
            ):
                raise ValueError("Service accounts cannot be enrolled as gateway users")
            user_id = link_user(client, issuer, user["id"], gateway, gateway_auth)
        sys.stdout.write(f"Gateway user ID {user_id}\n")
    except httpx.HTTPStatusError as exc:
        raise SystemExit(f"Provisioning endpoint returned HTTP {exc.response.status_code}") from None
    except (httpx.RequestError, KeyError, TypeError, ValueError):
        raise SystemExit(
            "Provisioning failed. Check the endpoints, credentials and existing subject binding."
        ) from None


if __name__ == "__main__":
    main()
