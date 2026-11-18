from dataclasses import replace

import pytest

from litellm.proxy.auth.external_identity import (
    ExternalIdentityDenied,
    ExternalIdentityPolicy,
    ExternalIdentitySubject,
    classify_verified_external_claims,
)

POLICY = ExternalIdentityPolicy(
    issuer="https://identity.example/realms/test",
    audience="gateway",
    client_id="agent-client",
    subject="agent-subject",
    required_scopes=frozenset({"gateway.invoke"}),
)
CLAIMS = {
    "iss": POLICY.issuer,
    "aud": "gateway",
    "azp": "agent-client",
    "sub": "agent-subject",
    "identity_kind": "workload",
    "scope": "gateway.invoke",
}


def test_workload_matches_registered_subject():
    assert classify_verified_external_claims(CLAIMS, POLICY) == ExternalIdentitySubject(
        "agent-subject", "agent-client", "autonomous"
    )


@pytest.mark.parametrize("field,value", [
    ("iss", "https://attacker.example"),
    ("aud", "another-product"),
    ("azp", "another-client"),
    ("sub", "another-agent"),
    ("scope", "profile"),
    ("scope", ["gateway.invoke"]),
    ("identity_kind", "human"),
])
def test_invalid_identity_is_denied(field, value):
    assert isinstance(classify_verified_external_claims({**CLAIMS, field: value}, POLICY), ExternalIdentityDenied)


def test_delegation_preserves_user_and_checks_actor():
    claims = {**CLAIMS, "sub": "human-subject", "identity_kind": "delegated", "act": {"sub": "agent-subject"}}
    policy = replace(POLICY, mode="delegated")
    assert classify_verified_external_claims(claims, policy) == ExternalIdentitySubject(
        "human-subject", "agent-client", "delegated"
    )
    assert isinstance(classify_verified_external_claims(claims, POLICY), ExternalIdentityDenied)
    assert isinstance(classify_verified_external_claims({**claims, "act": {}}, policy), ExternalIdentityDenied)


def test_missing_binding_does_not_admit_workload():
    assert isinstance(classify_verified_external_claims(CLAIMS, replace(POLICY, subject=None)), ExternalIdentityDenied)
