"""Detects LaunchDarkly access tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class LaunchdarklyAccessTokenDetector(RegexBasedDetector):
    """Scans for LaunchDarkly SDK, mobile and project tokens."""

    @property
    def secret_type(self) -> str:
        return "LaunchDarkly Access Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(r"\bsdk-[a-f0-9]{40}\b"),
            re.compile(r"\bmcp-[a-f0-9]{40}\b"),
            re.compile(r"\bmob-[a-f0-9]{40}\b"),
            re.compile(r"\bproj-[a-f0-9]{40}:[a-f0-9]{40}\b"),
        ]
