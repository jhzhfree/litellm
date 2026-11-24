"""Pre-approve an existing Keycloak employee for gateway login."""

import os
from dataclasses import dataclass
from typing import Annotated, Final
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from litellm.llms.custom_httpx.http_handler import get_async_httpx_client, httpxSpecialProvider
from litellm.models.employee_enrollment import EmployeeEnrollmentStore
from litellm.proxy.management_endpoints.sso.unified_oidc import binding_key, trusted_endpoint


class EmployeeEnrollment(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    subject: Annotated[str, Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9_:-]+$")]


def employee_enrollment_enabled() -> bool:
    return all(
        os.getenv(key, "").strip()
        for key in (
            "LITELLM_UNIFIED_OIDC_ISSUER",
            "LITELLM_UNIFIED_OIDC_JWKS_URL",
            "LITELLM_IDENTITY_DIRECTORY_CLIENT_ID",
            "LITELLM_IDENTITY_DIRECTORY_CLIENT_SECRET",
        )
    )


@dataclass(frozen=True, slots=True)
class DirectoryClient:
    client: httpx.AsyncClient
    users_url: str
    access_token: str

    def headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}


async def directory_client(issuer: str, client_id: str, client_secret: str) -> DirectoryClient:
    base, separator, realm = issuer.rpartition("/realms/")
    if not separator or not base or not realm or "/" in realm:
        raise HTTPException(503, "Enrollment requires a configured Keycloak realm")
    client: Final = get_async_httpx_client(llm_provider=httpxSpecialProvider.SSO_HANDLER).client
    try:
        token_response: Final = await client.post(
            issuer + "/protocol/openid-connect/token",
            data={"grant_type": "client_credentials", "client_id": client_id, "client_secret": client_secret},
            follow_redirects=False,
            timeout=10,
        )
        token_response.raise_for_status()
        token_data: Final = token_response.json()
        access_token: Final = token_data.get("access_token") if isinstance(token_data, dict) else None
        if not isinstance(access_token, str) or not access_token:
            raise ValueError("Identity directory did not return an access token")
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Identity directory is unavailable") from exc
    return DirectoryClient(client, f"{base}/admin/realms/{quote(realm, safe='')}/users", access_token)


async def verify_employee(issuer: str, subject: str) -> None:
    directory: Final = await directory_client(
        issuer,
        os.environ["LITELLM_IDENTITY_DIRECTORY_CLIENT_ID"],
        os.environ["LITELLM_IDENTITY_DIRECTORY_CLIENT_SECRET"],
    )
    try:
        user_response: Final = await directory.client.get(
            f"{directory.users_url}/{quote(subject, safe='')}",
            headers=directory.headers(),
            follow_redirects=False,
            timeout=10,
        )
        if user_response.status_code == 404:
            raise HTTPException(404, "Employee identity was not found")
        user_response.raise_for_status()
        user: Final = user_response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Identity directory could not verify this employee") from exc

    if (
        not isinstance(user, dict)
        or user.get("id") != subject
        or user.get("enabled") is not True
        or user.get("serviceAccountClientId")
        or not isinstance(user.get("username"), str)
        or user["username"].startswith("service-account-")
    ):
        raise HTTPException(409, "Identity is not an enabled employee account")


async def enroll_employee(users: EmployeeEnrollmentStore, issuer: str, subject: str) -> str:
    try:
        trusted_endpoint(issuer)
    except ValueError as exc:
        raise HTTPException(503, "Employee enrollment requires a trusted Keycloak issuer") from exc
    await verify_employee(issuer, subject)
    account: Final = await users.ensure_employee_account(binding_key(issuer, subject))
    if account is None:
        raise HTTPException(409, "Employee identity conflicts with an existing gateway account")
    if not account.enabled:
        raise HTTPException(409, "The gateway account is disabled")
    return account.user_id
