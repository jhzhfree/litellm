from collections.abc import Mapping
from dataclasses import dataclass
from typing import Final, Literal


@dataclass(frozen=True, slots=True)
class ExternalIdentityPolicy:
    issuer: str
    client_id: str
    subject: str | None = None
    required_scopes: frozenset[str] = frozenset()
    mode: Literal["autonomous", "delegated", "both"] = "autonomous"


@dataclass(frozen=True, slots=True)
class ExternalIdentitySubject:
    subject: str
    client_id: str
    mode: Literal["autonomous", "delegated"]


@dataclass(frozen=True, slots=True)
class ExternalIdentityDenied:
    reason: str


def classify_verified_external_claims(
    claims: Mapping[str, object], policy: ExternalIdentityPolicy
) -> ExternalIdentitySubject | ExternalIdentityDenied:
    """Apply the binding only after JWT signature, issuer and audience validation."""
    if claims.get("iss") != policy.issuer:
        return ExternalIdentityDenied("issuer_mismatch")
    client: Final = claims.get("azp")
    if client != policy.client_id:
        return ExternalIdentityDenied("client_mismatch")
    subject: Final = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        return ExternalIdentityDenied("missing_subject")
    kind: Final = claims.get("identity_kind")
    scope: Final = claims.get("scope", "")
    if not isinstance(scope, str) or not policy.required_scopes.issubset(scope.split()):
        return ExternalIdentityDenied("insufficient_scope")
    if kind == "workload":
        if policy.mode == "delegated" or policy.subject is None or subject != policy.subject:
            return ExternalIdentityDenied("workload_binding_mismatch")
        return ExternalIdentitySubject(subject, policy.client_id, "autonomous")
    if kind == "delegated":
        if policy.mode == "autonomous":
            return ExternalIdentityDenied("delegation_disabled")
        actor: Final = claims.get("act")
        if not isinstance(actor, Mapping) or actor.get("sub") != policy.subject or policy.subject is None:
            return ExternalIdentityDenied("actor_binding_mismatch")
        return ExternalIdentitySubject(subject, policy.client_id, "delegated")
    return ExternalIdentityDenied("unsupported_subject_kind")
