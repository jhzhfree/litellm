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


@pytest.mark.parametrize(
    "field,value",
    [
        ("iss", "https://attacker.example"),
        ("azp", "another-client"),
        ("sub", "another-agent"),
        ("scope", "profile"),
        ("scope", ["gateway.invoke"]),
        ("identity_kind", "human"),
    ],
)
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


def test_external_binding_uses_existing_agent_classifier():
    from litellm.proxy.agent_endpoints.managed_identity import classify_agent_subject
    from litellm.types.proxy.agent_identity import AgentIdentityBinding, AgentIdentityFailure

    binding = AgentIdentityBinding(
        agent_id="agent",
        provider="external_oidc",
        tenant_id=POLICY.issuer,
        issuer=POLICY.issuer,
        client_id=POLICY.client_id,
        service_principal_id=POLICY.subject,
        revision="one",
        required_scopes=("gateway.invoke",),
    )
    assert classify_agent_subject(binding, CLAIMS, "autonomous").oid == POLICY.subject
    assert isinstance(classify_agent_subject(binding, {**CLAIMS, "sub": "other"}, "autonomous"), AgentIdentityFailure)
    assert isinstance(classify_agent_subject(binding, CLAIMS, "delegated"), AgentIdentityFailure)
