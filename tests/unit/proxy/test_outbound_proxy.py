import os
from typing import Final

import pytest
from pydantic import ValidationError

import litellm
from litellm.proxy import outbound_proxy
from litellm.proxy._types import ConfigGeneralSettings

_PROXY_ENV_KEYS: Final = ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")
_NO_PROXY_ENV_KEYS: Final = ("NO_PROXY", "no_proxy")


def _clear_proxy_env(monkeypatch: pytest.MonkeyPatch) -> None:
    for key in (*_PROXY_ENV_KEYS, *_NO_PROXY_ENV_KEYS):
        monkeypatch.delenv(key, raising=False)


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:7890",
        "https://proxy.example.com:443",
        "socks5://127.0.0.1:1080",
        "socks5h://127.0.0.1:1080",
    ],
)
def test_validate_outbound_proxy_url_accepts_supported_schemes(url: str) -> None:
    assert outbound_proxy.validate_outbound_proxy_url(url) == url


@pytest.mark.parametrize("value", ["not-a-url", "ftp://127.0.0.1", "http://"])
def test_validate_outbound_proxy_url_rejects_invalid_values(value: object) -> None:
    with pytest.raises(ValueError):
        outbound_proxy.validate_outbound_proxy_url(value)


def test_validate_outbound_proxy_url_rejects_non_strings() -> None:
    with pytest.raises(TypeError):
        outbound_proxy.validate_outbound_proxy_url(123)


def test_validate_outbound_proxy_url_allows_empty() -> None:
    assert outbound_proxy.validate_outbound_proxy_url(None) is None
    assert outbound_proxy.validate_outbound_proxy_url("") is None


def test_apply_outbound_proxy_sets_environment_and_evicts_cached_clients(monkeypatch: pytest.MonkeyPatch) -> None:
    _clear_proxy_env(monkeypatch)
    cache_key: Final = "outbound-proxy-test-client"
    litellm.in_memory_llm_clients_cache.set_cache(  # pyright: ignore[reportUnknownMemberType]  # untyped legacy client cache
        cache_key, object(), loop_bound=False
    )
    assert litellm.in_memory_llm_clients_cache.get_cache(  # pyright: ignore[reportUnknownMemberType]  # untyped legacy client cache
        cache_key, loop_bound=False
    ) is not None

    outbound_proxy.apply_outbound_proxy("http://127.0.0.1:7890")

    for key in _PROXY_ENV_KEYS:
        assert os.environ[key] == "http://127.0.0.1:7890"
    for key in _NO_PROXY_ENV_KEYS:
        assert "localhost" in os.environ[key]
        assert "127.0.0.1" in os.environ[key]
    assert (
        litellm.in_memory_llm_clients_cache.get_cache(  # pyright: ignore[reportUnknownMemberType]  # untyped legacy client cache
            cache_key, loop_bound=False
        )
        is None
    )


def test_apply_outbound_proxy_restores_environment_when_disabled(monkeypatch: pytest.MonkeyPatch) -> None:
    original: Final = {key: os.environ.get(key) for key in (*_PROXY_ENV_KEYS, *_NO_PROXY_ENV_KEYS)}
    _clear_proxy_env(monkeypatch)
    outbound_proxy.apply_outbound_proxy("socks5://127.0.0.1:1080")
    outbound_proxy.apply_outbound_proxy(None)

    for key, value in original.items():
        assert os.environ.get(key) == value


def test_general_settings_validates_proxy_url() -> None:
    url: Final = "socks5://127.0.0.1:1080"
    assert ConfigGeneralSettings.model_validate({"proxy_url": url}).proxy_url == url
    with pytest.raises(ValidationError):
        ConfigGeneralSettings.model_validate({"proxy_url": "ftp://127.0.0.1"})
