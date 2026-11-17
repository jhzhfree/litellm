import { afterEach, describe, expect, it, vi } from "vitest";
import { productFetch, productUrl, translateProductFields } from "./productContract";

afterEach(() => vi.unstubAllGlobals());

describe("product API contract", () => {
  it("translates provider enum values without rewriting custom data", () => {
    const internal = {
      litellm_provider: "litellm_proxy",
      litellm_params: { guardrail: "litellm_content_filter" },
      metadata: { provider: "litellm_proxy" },
    };
    const external = {
      gateway_provider: "ai_gateway",
      gateway_params: { guardrail: "gateway_content_filter" },
      metadata: { provider: "litellm_proxy" },
    };
    expect(translateProductFields(internal)).toEqual(external);
    expect(translateProductFields(external, true)).toEqual(internal);
    expect(productUrl("/provider/info?provider=LITELLM_PROXY")).toBe("/provider/info?provider=AI_GATEWAY");
  });

  it("uses public audit table values while preserving user metadata and unrelated query values", () => {
    const internal = {
      table_name: "LiteLLM_VerificationToken",
      metadata: { table_name: "LiteLLM_VerificationToken" },
    };
    const external = {
      table_name: "Gateway_VerificationToken",
      metadata: { table_name: "LiteLLM_VerificationToken" },
    };
    expect(translateProductFields(internal)).toEqual(external);
    expect(translateProductFields(external, true)).toEqual(internal);
    const query = new URL(productUrl("http://localhost/audit?table_name=LiteLLM_VerificationToken&query=LiteLLM_VerificationToken"));
    expect(query.searchParams.get("table_name")).toBe("Gateway_VerificationToken");
    expect(query.searchParams.get("query")).toBe("LiteLLM_VerificationToken");
  });

  it("sends empty JSON requests without parsing a missing payload", async () => {
    const transport = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", transport);
    const response = await productFetch("http://localhost/action", {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    expect(response.status).toBe(204);
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0][1].body.byteLength).toBe(0);
  });

  it.each([{ method: "HEAD", status: 200 }, { method: "GET", status: 205 }])(
    "preserves bodyless $method responses with status $status",
    async ({ method, status }) => {
      const original = new Response(null, { status, headers: { "content-type": "application/json" } });
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(original));
      expect(await productFetch("http://localhost/action", { method })).toBe(original);
    },
  );

  it("converts system fields but preserves prompts and user metadata", () => {
    const value = {
      litellm_params: { model: "example" },
      metadata: { litellm_params: "user-owned" },
      messages: [{ role: "user", content: "litellm" }],
    };
    expect(translateProductFields(value)).toEqual({
      gateway_params: { model: "example" },
      metadata: { litellm_params: "user-owned" },
      messages: [{ role: "user", content: "litellm" }],
    });
    expect(translateProductFields(translateProductFields(value), true)).toEqual(value);
  });

  it("uses product discovery and runtime configuration URLs", () => {
    expect(productUrl("http://localhost/litellm/.well-known/litellm-ui-config")).toBe(
      "http://localhost/ai-gateway/.well-known/ui-config",
    );
    expect(productUrl("/ui/litellm-runtime-config.json")).toBe("/ui/ai-gateway-runtime-config.json");
  });

  it("sends product fields and headers while keeping internal callers compatible", async () => {
    const transport = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ gateway_params: { model: "test" } }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", transport);
    const response = await productFetch("http://localhost/model/new", {
      method: "POST",
      headers: { "content-type": "application/json", "x-litellm-trace-id": "trace" },
      body: JSON.stringify({ litellm_params: { model: "test" } }),
    });
    const [url, init] = transport.mock.calls[0];
    expect(url).toBe("http://localhost/model/new");
    expect(JSON.parse(init.body)).toEqual({ gateway_params: { model: "test" } });
    expect(init.headers.get("x-ai-gateway-trace-id")).toBe("trace");
    expect(init.headers.has("x-litellm-trace-id")).toBe(false);
    expect(await response.json()).toEqual({ litellm_params: { model: "test" } });
  });
});
