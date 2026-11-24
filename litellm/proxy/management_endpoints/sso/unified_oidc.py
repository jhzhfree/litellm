"""Verified, pre-provisioned identities for the opt-in unified OIDC login."""

import base64
import hashlib
import json
from collections.abc import Mapping
from typing import Final
from urllib.parse import urlsplit

import jwt

from litellm.proxy.management_endpoints.types import CustomOpenID


class UnifiedOIDCUser(CustomOpenID):
    """Constructed only after validating the browser transaction and ID token."""

    identity_issuer: str
    identity_subject: str


def trusted_endpoint(value: str) -> str:
    url: Final = urlsplit(value)
    if (
        not url.hostname
        or url.username is not None
        or url.query
        or url.fragment
        or (url.scheme != "https" and not (url.scheme == "http" and url.hostname in {"127.0.0.1", "localhost", "::1"}))
    ):
        raise ValueError("Use a trusted HTTPS endpoint or loopback HTTP")
    return value


def binding_key(issuer: str, subject: str) -> str:
    identity: Final = json.dumps([issuer, subject], ensure_ascii=True, separators=(",", ":"))
    return "oidc:v1:" + hashlib.sha256(identity.encode("ascii")).hexdigest()


def login_nonce(verifier: str) -> str:
    digest: Final = hashlib.sha256(b"litellm.unified-oidc.nonce:" + verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


def verify_identity(token: object, keys: object, *, issuer: str, client_id: str, verifier: str) -> UnifiedOIDCUser:
    if not isinstance(token, str) or not isinstance(keys, Mapping) or not isinstance(keys.get("keys"), list):
        raise jwt.InvalidTokenError("Missing ID token or verification keys")
    header: Final = jwt.get_unverified_header(token)
    kid: Final = header.get("kid")
    alg: Final = header.get("alg")
    if not isinstance(kid, str) or not kid or alg not in ("RS256", "ES256"):
        raise jwt.InvalidTokenError("Unsupported ID token header")
    matches: Final = tuple(
        key
        for key in keys["keys"]
        if isinstance(key, dict) and key.get("kid") == kid and key.get("use", "sig") == "sig"
    )
    if len(matches) != 1:
        raise jwt.InvalidTokenError("ID token signing key is unavailable or ambiguous")
    jwk: Final = jwt.PyJWK.from_dict(matches[0], algorithm=alg)
    claims: Final = jwt.decode(
        token,
        jwk,
        algorithms=[alg],
        issuer=issuer,
        audience=client_id,
        options={"require": ["exp", "iat", "iss", "aud", "sub", "nonce"]},
    )
    subject: Final = claims["sub"]
    audience: Final = claims["aud"]
    if (
        not isinstance(subject, str)
        or not subject.strip()
        or len(subject) > 255
        or claims["nonce"] != login_nonce(verifier)
        or (("azp" in claims or (isinstance(audience, list) and len(audience) > 1)) and claims.get("azp") != client_id)
    ):
        raise jwt.InvalidTokenError("Invalid ID token subject, nonce or authorized party")
    return UnifiedOIDCUser(
        id=binding_key(issuer, subject),
        provider="oidc",
        team_ids=[],
        identity_issuer=issuer,
        identity_subject=subject,
    )
