"""Detects Discord webhooks and client tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class DiscordWebhookDetector(RegexBasedDetector):
    """Scans for Discord incoming webhook URLs."""

    @property
    def secret_type(self) -> str:
        return "Discord Webhook"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [
            re.compile(
                r"https://discord(?:app)?\.com/api/webhooks/[0-9]{17,19}/[A-Za-z0-9_-]{60,}"
            )
        ]
