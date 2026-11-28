import httpx
import pytest
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, StreamingResponse
from starlette.routing import Route

from litellm.proxy.middleware.product_contract_middleware import ProductContractMiddleware


@pytest.mark.asyncio
async def test_product_provider_values_reach_internal_handlers():
    async def provider(request: Request):
        body = await request.json()
        assert request.query_params["provider"] == "LITELLM_PROXY"
        assert body["litellm_provider"] == "litellm_proxy"
        assert body["litellm_params"]["guardrail"] == "litellm_content_filter"
        return JSONResponse(body)

    app = ProductContractMiddleware(Starlette(routes=[Route("/provider", provider, methods=["POST"])]))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.post(
            "/provider?provider=AI_GATEWAY",
            json={
                "gateway_provider": "ai_gateway",
                "gateway_params": {"guardrail": "gateway_content_filter"},
                "metadata": {"provider": "litellm_proxy"},
            },
        )
        assert response.json() == {
            "gateway_provider": "ai_gateway",
            "gateway_params": {"guardrail": "gateway_content_filter"},
            "metadata": {"provider": "litellm_proxy"},
        }


@pytest.mark.asyncio
async def test_audit_table_aliases_round_trip_in_query_body_and_schema():
    async def audit(request: Request):
        body = await request.json()
        assert request.query_params["table_name"] == "LiteLLM_VerificationToken"
        assert body["table_name"] == "LiteLLM_VerificationToken"
        return JSONResponse(body)

    async def schema(request: Request):
        return JSONResponse({"properties": {"table_name": {"enum": ["LiteLLM_VerificationToken"]}}})

    app = ProductContractMiddleware(
        Starlette(
            routes=[
                Route("/audit", audit, methods=["POST"]),
                Route("/openapi.json", schema),
            ]
        )
    )
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        for table in ("Gateway_VerificationToken", "LiteLLM_VerificationToken"):
            response = await client.post(
                "/audit",
                params={"table_name": table},
                json={"table_name": table, "metadata": {"table_name": "LiteLLM_VerificationToken"}},
            )
            assert response.json() == {
                "table_name": "Gateway_VerificationToken",
                "metadata": {"table_name": "LiteLLM_VerificationToken"},
            }
        spec = (await client.get("/openapi.json")).json()
        assert spec["properties"]["table_name"]["enum"] == ["Gateway_VerificationToken"]


@pytest.mark.asyncio
async def test_provider_labels_are_branded_without_rewriting_user_metadata():
    async def providers(request: Request):
        return JSONResponse(
            {
                "provider_display_name": "LiteLLM Gateway",
                "ui_friendly_name": "LiteLLM Content Filter",
                "metadata": {"ui_friendly_name": "LiteLLM Content Filter"},
            }
        )

    app = ProductContractMiddleware(Starlette(routes=[Route("/providers", providers)]))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.get("/providers")
        assert response.json() == {
            "provider_display_name": "AI-GovernanceGw Gateway",
            "ui_friendly_name": "AI-GovernanceGw Content Filter",
            "metadata": {"ui_friendly_name": "LiteLLM Content Filter"},
        }


async def echo(request: Request):
    data = await request.json()
    return JSONResponse(
        {
            "litellm_params": data.get("litellm_params"),
            "metadata": data.get("metadata"),
            "messages": data.get("messages"),
            "trace": request.headers.get("x-litellm-trace-id"),
        },
        headers={"x-litellm-call-id": "request-1", "access-control-expose-headers": "x-litellm-call-id"},
    )


@pytest.mark.asyncio
async def test_new_and_legacy_inputs_use_product_outputs_without_touching_user_data():
    app = ProductContractMiddleware(Starlette(routes=[Route("/model/new", echo, methods=["POST"])]))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        for name in ("gateway_params", "litellm_params"):
            response = await client.post(
                "/model/new",
                json={
                    name: {"model": "test"},
                    "metadata": {"litellm_params": "user data"},
                    "messages": [{"role": "user", "content": "Explain litellm"}],
                },
                headers={"x-ai-gateway-trace-id": "trace-1"},
            )
            assert response.json() == {
                "gateway_params": {"model": "test"},
                "metadata": {"litellm_params": "user data"},
                "messages": [{"role": "user", "content": "Explain litellm"}],
                "trace": "trace-1",
            }
            assert response.headers["x-ai-gateway-call-id"] == "request-1"
            assert "x-litellm-call-id" not in response.headers
            assert response.headers["access-control-expose-headers"] == "x-ai-gateway-call-id"
            assert int(response.headers["content-length"]) == len(response.content)


@pytest.mark.asyncio
async def test_product_input_wins_when_both_names_are_supplied():
    app = ProductContractMiddleware(Starlette(routes=[Route("/model/new", echo, methods=["POST"])]))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.post(
            "/model/new", json={"gateway_params": {"model": "new"}, "litellm_params": {"model": "old"}}
        )
        assert response.json()["gateway_params"] == {"model": "new"}


@pytest.mark.asyncio
async def test_discovery_alias_and_schema_references_are_consistent():
    async def schema(request):
        return JSONResponse(
            {
                "components": {"schemas": {"LiteLLMModel": {"properties": {"litellm_params": {"type": "object"}}}}},
                "schema": {"$ref": "#/components/schemas/LiteLLMModel"},
            }
        )

    async def discovery(request):
        return JSONResponse({"litellm_version": "1"})

    app = ProductContractMiddleware(
        Starlette(routes=[Route("/openapi.json", schema), Route("/litellm/.well-known/litellm-ui-config", discovery)])
    )
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.get("/ai-gateway/.well-known/ui-config", headers={"content-type": "application/json"})
        assert response.json() == {"gateway_version": "1"}
        spec = (await client.get("/openapi.json")).json()
        name = spec["schema"]["$ref"].split("/")[-1]
        assert spec["components"]["schemas"][name]["properties"] == {"gateway_params": {"type": "object"}}


@pytest.mark.asyncio
async def test_streamed_model_output_is_not_rewritten():
    async def stream(request):
        async def chunks():
            yield b'data: {"choices":[{"delta":{"content":"litellm"}}]}\n\n'
            yield b"data: [DONE]\n\n"

        return StreamingResponse(chunks(), media_type="text/event-stream", headers={"x-litellm-call-id": "stream-1"})

    app = ProductContractMiddleware(Starlette(routes=[Route("/v1/chat/completions", stream)]))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.get("/v1/chat/completions")
        assert response.content == b'data: {"choices":[{"delta":{"content":"litellm"}}]}\n\ndata: [DONE]\n\n'
        assert response.headers["x-ai-gateway-call-id"] == "stream-1"


@pytest.mark.asyncio
async def test_stream_error_branding_handles_split_events():
    async def stream(request):
        async def chunks():
            yield b'data: {"error":{"message":"Lite'
            yield b'LLM internal failure"},"litellm_call_id":"request-1"}\n\n'
            yield b"data: [DONE]\n\n"

        return StreamingResponse(chunks(), media_type="text/event-stream")

    app = ProductContractMiddleware(Starlette(routes=[Route("/v1/chat/completions", stream)]))
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as client:
        response = await client.get("/v1/chat/completions")
        assert '"gateway_call_id":"request-1"' in response.text
        assert "AI-GovernanceGw internal failure" in response.text
        assert "LiteLLM internal failure" not in response.text
        assert response.text.endswith("data: [DONE]\n\n")


def test_product_environment_takes_precedence(monkeypatch):
    import os

    from litellm._process_defaults import apply_product_environment

    monkeypatch.setenv("LITELLM_OFFLINE_MODE", "false")
    monkeypatch.setenv("AI_GATEWAY_OFFLINE_MODE", "true")
    apply_product_environment()
    assert os.environ["LITELLM_OFFLINE_MODE"] == "true"
