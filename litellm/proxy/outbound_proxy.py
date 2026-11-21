from __future__ import annotations

import os
from collections.abc import Mapping
from types import MappingProxyType
from typing import Final
from urllib.parse import urlparse

_PROXY_ENV_KEYS: Final = ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")
_NO_PROXY_ENV_KEYS: Final = ("NO_PROXY", "no_proxy")
_ALLOWED_PROXY_SCHEMES: Final = frozenset({"http", "https", "socks5", "socks5h"})
_DEFAULT_NO_PROXY: Final = "localhost,127.0.0.1,::1"
_ORIGINAL_PROXY_ENV: Final[Mapping[str, str | None]] = MappingProxyType(
    {key: os.environ.get(key) for key in (*_PROXY_ENV_KEYS, *_NO_PROXY_ENV_KEYS)}
)


def validate_outbound_proxy_url(value: object) -> str | None:
    if value is None or value == "":
        return None
    if not isinstance(value, str):
        raise TypeError("proxy_url must be a string")
    parsed: Final = urlparse(value)
    if parsed.scheme not in _ALLOWED_PROXY_SCHEMES or not parsed.hostname:
        raise ValueError("proxy_url must be an http, https or socks5 URL with a host")
    return value


def _restore_env(key: str) -> None:
    original: Final = _ORIGINAL_PROXY_ENV.get(key)
    if original is None:
        os.environ.pop(key, None)
    else:
        os.environ[key] = original


def apply_outbound_proxy(proxy_url: object) -> None:
    validated: Final = validate_outbound_proxy_url(proxy_url)
    for key in _PROXY_ENV_KEYS:
        if validated is None:
            _restore_env(key)
        else:
            os.environ[key] = validated
    for key in _NO_PROXY_ENV_KEYS:
        if validated is None:
            _restore_env(key)
        elif not os.environ.get(key):
            os.environ[key] = _DEFAULT_NO_PROXY

    import litellm

    litellm.in_memory_llm_clients_cache.evict_all_clients()
