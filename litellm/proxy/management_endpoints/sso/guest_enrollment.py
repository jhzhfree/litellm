"""Prepare a managed Keycloak guest and request activation after gateway binding."""

import os
from typing import Annotated, Final, Literal
from urllib.parse import quote

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field

from litellm.models.employee_enrollment import EmployeeEnrollmentStore
from litellm.proxy.management_endpoints.sso.employee_enrollment import DirectoryClient, directory_client
from litellm.proxy.management_endpoints.sso.unified_oidc import binding_key, trusted_endpoint

_MARKER: Final = "litellm_guest_operation"
_ACTIONS: Final = ("VERIFY_EMAIL", "UPDATE_PASSWORD")


class GuestEnrollment(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")

    email: Annotated[str, Field(max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    action: Literal["prepare", "status", "send"]


def guest_enrollment_enabled() -> bool:
    return all(
        os.getenv(key, "").strip()
        for key in (
            "LITELLM_UNIFIED_OIDC_ISSUER",
            "LITELLM_UNIFIED_OIDC_JWKS_URL",
            "LITELLM_IDENTITY_GUEST_CLIENT_ID",
            "LITELLM_IDENTITY_GUEST_CLIENT_SECRET",
        )
    )


async def _find_guest(directory: DirectoryClient, username: str) -> dict | None:
    response: Final = await directory.client.get(
        directory.users_url,
        params={"username": username, "exact": "true", "max": "2", "briefRepresentation": "false"},
        headers=directory.headers(),
        follow_redirects=False,
        timeout=10,
    )
    response.raise_for_status()
    records: Final = response.json()
    if not isinstance(records, list) or len(records) > 1 or (records and not isinstance(records[0], dict)):
        raise HTTPException(502, "Identity directory returned an ambiguous guest")
    return records[0] if records else None


async def enroll_guest(users: EmployeeEnrollmentStore, issuer: str, data: GuestEnrollment) -> dict[str, str]:
    try:
        trusted_endpoint(issuer)
    except ValueError as exc:
        raise HTTPException(503, "Guest enrollment requires a trusted Keycloak issuer") from exc
    email: Final = str(data.email).lower()
    operation_id: Final = binding_key(issuer, email).removeprefix("oidc:v1:")
    username: Final = f"litellm-guest-{operation_id}"
    directory: Final = await directory_client(
        issuer, os.environ["LITELLM_IDENTITY_GUEST_CLIENT_ID"], os.environ["LITELLM_IDENTITY_GUEST_CLIENT_SECRET"]
    )
    try:
        existing: Final = await _find_guest(directory, username)
        if existing is None and data.action == "prepare":
            created: Final = await directory.client.post(
                directory.users_url,
                json={
                    "username": username,
                    "email": email,
                    "enabled": True,
                    "emailVerified": False,
                    "requiredActions": list(_ACTIONS),
                    "attributes": {_MARKER: [operation_id]},
                },
                headers=directory.headers(),
                follow_redirects=False,
                timeout=10,
            )
            if created.status_code not in (201, 409):
                created.raise_for_status()
            guest: Final = await _find_guest(directory, username)
            if guest is None:
                raise HTTPException(409, "Guest identity conflicts with an existing realm account")
        else:
            guest = existing
        if guest is None:
            return {"operation_id": operation_id, "state": "not_started"}
        attributes: Final = guest.get("attributes")
        subject: Final = guest.get("id")
        if (
            guest.get("username") != username
            or guest.get("email") != email
            or guest.get("enabled") is not True
            or guest.get("federationLink")
            or not isinstance(subject, str)
            or not subject
            or not isinstance(attributes, dict)
            or attributes.get(_MARKER) != [operation_id]
        ):
            raise HTTPException(409, "Realm account is not a matching managed guest")

        binding: Final = binding_key(issuer, subject)
        account: Final = (
            await users.ensure_employee_account(binding)
            if data.action == "prepare"
            else await users.find_enrolled_account(binding)
        )
        if account is None:
            if data.action == "prepare":
                raise HTTPException(409, "Guest identity conflicts with an existing gateway account")
            return {"operation_id": operation_id, "state": "identity_created"}
        if not account.enabled:
            raise HTTPException(409, "The gateway account is disabled")

        result: Final = {"operation_id": operation_id, "user_id": account.user_id}
        required: Final = guest.get("requiredActions")
        if guest.get("emailVerified") is True and required == []:
            return {**result, "state": "active"}
        if data.action != "send":
            return {**result, "state": "awaiting_activation"}

        sent: Final = await directory.client.put(
            f"{directory.users_url}/{quote(subject, safe='')}/execute-actions-email",
            params={"lifespan": "3600"},
            json=list(_ACTIONS),
            headers=directory.headers(),
            follow_redirects=False,
            timeout=10,
        )
        sent.raise_for_status()
        return {**result, "state": "activation_requested"}
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(502, "Guest operation could not be confirmed; check status before retrying") from exc
