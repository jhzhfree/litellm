"""Detects Anthropic API keys."""

import re

from detect_secrets.plugins.base import RegexBasedDetector


class AnthropicApiKeyDetector(RegexBasedDetector):
    """Scans for Anthropic API keys (sk-ant-...)."""

    @property
    def secret_type(self) -> str:
        return "Anthropic API Key"

    @property
    def denylist(self) -> list[re.Pattern[str]]:
        return [re.compile(r"\bsk-ant-[A-Za-z0-9_-]{24,}\b")]
