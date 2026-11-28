"""Detects Base64-encoded JSON Web Tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class JWTBase64Detector(RegexBasedDetector):
    """Scans for three-segment JWTs whose header starts with the base64 of {" (eyJ)."""

    @property
    def secret_type(self) -> str:
        return "Base64-encoded JSON Web Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(
                r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}={0,2}\b"
            )
        ]
