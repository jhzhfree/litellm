from typing import Final

import httpx
import pytest

import litellm
from litellm.llms.openai.common_utils import BaseOpenAILLM
from litellm.llms.openai.openai import OpenAIChatCompletion


def test_async_openai_client_uses_explicit_proxy(monkeypatch: pytest.MonkeyPatch) -> None:
    real_client: Final = httpx.AsyncClient
    captured: dict[str, object] = {}

    def capture_proxy(*args: object, **kwargs: object) -> httpx.AsyncClient:
        captured.update(kwargs)
        return real_client(*args, **kwargs)  # pyright: ignore[reportArgumentType]  # forwarded to the real client

    monkeypatch.setattr("litellm.llms.openai.common_utils.httpx.AsyncClient", capture_proxy)

    client: Final = BaseOpenAILLM.get_async_http_client(proxy_url="http://127.0.0.1:7890")

    assert captured.get("proxy") == "http://127.0.0.1:7890"
    assert isinstance(client, real_client)


def test_completion_passes_model_proxy_url_to_openai_client(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: list[object] = []

    def stop_before_network(self: object, *args: object, **kwargs: object) -> object:
        params = kwargs.get("litellm_params")
        captured.append(
            params.get("proxy_url")  # pyright: ignore[reportUnknownMemberType, reportUnknownArgumentType]  # litellm_params is untyped at this boundary
            if isinstance(params, dict)
            else None
        )
        raise KeyboardInterrupt

    monkeypatch.setattr(OpenAIChatCompletion, "_get_openai_client", stop_before_network)

    with pytest.raises(KeyboardInterrupt):
        litellm.completion(
            model="openai/gpt-4o-mini",
            api_key="sk-placeholder",
            proxy_url="http://127.0.0.1:7890",
            messages=[{"role": "user", "content": "hi"}],
        )

    assert captured == ["http://127.0.0.1:7890"]
