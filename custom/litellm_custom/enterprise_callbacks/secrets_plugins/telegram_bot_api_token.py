"""Detects Telegram bot API tokens."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class TelegramBotApiTokenDetector(RegexBasedDetector):
    """Scans for Telegram bot tokens (bot_id:secret)."""

    @property
    def secret_type(self) -> str:
        return "Telegram Bot API Token"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\b[0-9]{8,10}:AA[A-Za-z0-9_-]{33}\b")]
