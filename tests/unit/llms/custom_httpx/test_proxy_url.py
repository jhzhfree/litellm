from typing import Final

import httpx
import pytest

from litellm.llms.custom_httpx.http_handler import (
    AsyncHTTPHandler,
    HTTPHandler,
    get_async_httpx_client,  # pyright: ignore[reportUnknownVariableType]  # legacy untyped client factory
    get_httpx_client,  # pyright: ignore[reportUnknownVariableType]  # legacy untyped client factory
)
from litellm.llms.custom_httpx.llm_http_handler import http_client_params


@pytest.mark.parametrize(
    "url",
    [
        "http://127.0.0.1:7890",
        "https://proxy.example.com:443",
    ],
)
def test_explicit_proxy_mount_is_used_for_all_urls(url: str) -> None:
    transport: Final = httpx.AsyncHTTPTransport()
    mounts: Final = AsyncHTTPHandler.create_httpx_proxy_mounts(transport, verify=True, cert=None, proxy_url=url)

    assert mounts is not None
    assert list(mounts) == ["all://"]
    assert AsyncHTTPHandler(proxy_url=url).proxy_url == url


@pytest.mark.parametrize("value", ["not-a-url", "ftp://127.0.0.1", "http://"])
def test_async_handler_rejects_invalid_proxy_url(value: str) -> None:
    with pytest.raises(ValueError):
        AsyncHTTPHandler(proxy_url=value)


def test_sync_handler_accepts_proxy_url() -> None:
    assert HTTPHandler(proxy_url="http://127.0.0.1:7890").proxy_url == "http://127.0.0.1:7890"


def test_client_cache_keeps_proxies_isolated() -> None:
    first: Final = get_async_httpx_client(llm_provider="openai", params={"proxy_url": "http://127.0.0.1:7890"})
    second: Final = get_async_httpx_client(llm_provider="openai", params={"proxy_url": "http://127.0.0.1:7891"})
    direct: Final = get_async_httpx_client(llm_provider="openai", params={})

    assert first.proxy_url == "http://127.0.0.1:7890"
    assert second.proxy_url == "http://127.0.0.1:7891"
    assert direct.proxy_url is None
    assert first is not second
    assert first is not direct

    sync_first: Final = get_httpx_client(params={"proxy_url": "http://127.0.0.1:1080"})
    sync_second: Final = get_httpx_client(params={})
    assert sync_first.proxy_url == "http://127.0.0.1:1080"
    assert sync_second.proxy_url is None
    assert sync_first is not sync_second


def test_http_client_params_extracts_per_model_values() -> None:
    assert http_client_params({"ssl_verify": False, "proxy_url": "http://127.0.0.1:7890"}) == {
        "ssl_verify": False,
        "proxy_url": "http://127.0.0.1:7890",
    }
    assert http_client_params({"ssl_verify": "/tmp/ca.pem"}) == {"ssl_verify": "/tmp/ca.pem"}
    assert http_client_params({"proxy_url": None}) == {"ssl_verify": None}
