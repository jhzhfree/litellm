"""Verify agentctl, independent Keycloak and LiteLLM against an isolated deployment."""

import argparse
import json
import os
import stat
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import httpx
from agentctl import trusted_url


def verify_preflight(gateway: str, issuer: str) -> None:
    admin = {"Authorization": "Bearer " + os.environ["OCTOP_E2E_GATEWAY_ADMIN_KEY"]}
    with httpx.Client(timeout=15, follow_redirects=False) as client:
        readiness = client.get(gateway + "/health/readiness")
        if readiness.status_code != 200 or readiness.json().get("db") != "connected":
            raise ValueError("Gateway readiness must report a connected database")
        providers = client.get(gateway + "/v1/agents/identity/providers", headers=admin)
        providers.raise_for_status()
        issuers = providers.json()
        if not isinstance(issuers, list) or issuer not in issuers:
            raise ValueError("Gateway does not advertise the expected trusted issuer")
        discovery = client.get(issuer + "/.well-known/openid-configuration")
        discovery.raise_for_status()
        if discovery.json().get("issuer") != issuer:
            raise ValueError("Keycloak discovery does not match the expected issuer")


def verify(platform: str, gateway: str, issuer: str) -> None:
    operation = str(uuid4())
    cli = Path(__file__).with_name("agentctl.py")

    def run(command: str, *args: str) -> str:
        completed = subprocess.run(
            [sys.executable, str(cli), "--platform", platform, command, operation, *args],
            capture_output=True,
            text=True,
            timeout=130,
            check=False,
            env={key: value for key, value in os.environ.items() if key != "OCTOP_E2E_GATEWAY_ADMIN_KEY"},
        )
        if completed.returncode:
            raise ValueError(f"agentctl {command} failed")
        return completed.stdout

    sys.stdout.write(f"Test operation {operation}\n")
    sys.stdout.flush()
    name = f"octop-smoke-{operation}"
    with TemporaryDirectory() as temporary, httpx.Client(timeout=15, follow_redirects=False) as client:
        active = json.loads(run("register", "--name", name))
        if active["state"] != "active":
            raise ValueError("Registration did not reach active")
        try:
            if active["issuer"] != issuer:
                raise ValueError("Registration API used an unexpected issuer")
            if active != json.loads(run("register", "--name", name)):
                raise ValueError("Registration changed on retry")
            secret_file = Path(temporary) / "credential.json"
            run("credential", "--secret-file", str(secret_file))
            if stat.S_IMODE(secret_file.stat().st_mode) != 0o600:
                raise ValueError("Unexpected credential file permissions")
            credential = json.loads(secret_file.read_text(encoding="utf-8"))
            if any(credential[field] != active[field] for field in ("issuer", "client_id", "subject")):
                raise ValueError("Credential and registration identity differ")
            if not json.loads(run("status"))["credential_claimed"]:
                raise ValueError("Credential delivery was not recorded")
            duplicate_claim = client.post(
                f"{platform}/v1/agent-registrations/{operation}/credential",
                headers={"Authorization": "Bearer " + os.environ["AGENTCTL_OPERATOR_TOKEN"]},
            )
            if duplicate_claim.status_code != 409:
                raise ValueError("Registration API must reject a second credential claim")
            endpoint = trusted_url(credential["issuer"]).rstrip("/") + "/protocol/openid-connect/token"
            grant = {
                "grant_type": "client_credentials",
                "client_id": credential["client_id"],
                "client_secret": credential["client_secret"],
            }
            issued = client.post(endpoint, data=grant)
            issued.raise_for_status()
            headers = {"Authorization": "Bearer " + issued.json()["access_token"]}
            discovery = client.get(gateway + "/v1/agents", headers=headers)
            discovery.raise_for_status()
            if not isinstance(discovery.json(), list):
                raise ValueError("Expected an Agent discovery list")
            identity = client.get(
                f"{gateway}/v1/agents/{active['gateway_agent_id']}/identity",
                headers={"Authorization": "Bearer " + os.environ["OCTOP_E2E_GATEWAY_ADMIN_KEY"]},
            )
            identity.raise_for_status()
            binding = identity.json()
            if binding["identity"]["service_principal_id"] != active["subject"] or not binding["last_authenticated_at"]:
                raise ValueError("Gateway did not record the expected workload authentication")
        finally:
            disabled = json.loads(run("disable"))
            if disabled["state"] != "disabled":
                raise ValueError("Registration did not reach disabled")

        if client.get(gateway + "/v1/agents", headers=headers).status_code != 403:
            raise ValueError("Gateway must reject the same JWT after disabling the binding")
        if client.post(endpoint, data=grant).status_code not in (400, 401):
            raise ValueError("Keycloak must reject new grants for the disabled client")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--platform", help="Isolated registration API")
    parser.add_argument("--gateway", required=True, help="Isolated LiteLLM gateway")
    parser.add_argument("--issuer", required=True, help="Expected Keycloak realm issuer")
    parser.add_argument(
        "--preflight-only", action="store_true", help="Check gateway and issuer without creating an Agent"
    )
    args = parser.parse_args()
    if not os.environ.get("OCTOP_E2E_GATEWAY_ADMIN_KEY"):
        parser.error("Set OCTOP_E2E_GATEWAY_ADMIN_KEY")
    if not args.preflight_only and (not args.platform or not os.environ.get("AGENTCTL_OPERATOR_TOKEN")):
        parser.error("Set --platform and AGENTCTL_OPERATOR_TOKEN for the registration test")
    try:
        gateway = trusted_url(args.gateway).rstrip("/")
        issuer = trusted_url(args.issuer).rstrip("/")
        verify_preflight(gateway, issuer)
        sys.stdout.write("PASS gateway database readiness, trusted issuer, and Keycloak discovery\n")
        if args.preflight_only:
            return
        verify(trusted_url(args.platform).rstrip("/"), gateway, issuer)
    except httpx.HTTPStatusError as exc:
        raise SystemExit(f"Unexpected HTTP {exc.response.status_code} during acceptance test") from None
    except (httpx.RequestError, subprocess.TimeoutExpired, OSError, AttributeError, KeyError, TypeError) as exc:
        raise SystemExit(f"Acceptance test failed ({type(exc).__name__})") from None
    except ValueError as exc:
        raise SystemExit(str(exc) if type(exc) is ValueError else "Unexpected response format") from None
    sys.stdout.write(
        "PASS agentctl registration, workload authentication, and revocation across Keycloak and LiteLLM\n"
    )


if __name__ == "__main__":
    main()
