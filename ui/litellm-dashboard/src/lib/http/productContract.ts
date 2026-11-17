const fields: Readonly<Record<string, string>> = {
  litellm_params: "gateway_params",
  litellm_cache_params: "gateway_cache_params",
  litellm_changed_by: "gateway_changed_by",
  litellm_count_model: "gateway_count_model",
  litellm_count_source: "gateway_count_source",
  litellm_credential_name: "gateway_credential_name",
  litellm_logging_obj: "gateway_logging_context",
  litellm_model: "gateway_model",
  litellm_model_table: "gateway_model_table",
  litellm_request_id: "gateway_request_id",
  tier_litellm_params: "tier_gateway_params",
  use_litellm_proxy: "use_ai_gateway",

  litellm_params_to_remove: "gateway_params_to_remove",
  litellm_metadata: "gateway_metadata",
  litellm_settings: "gateway_settings",
  litellm_provider: "gateway_provider",
  litellm_version: "gateway_version",
  litellm_call_id: "gateway_call_id",
  litellm_trace_id: "gateway_trace_id",
  litellm_session_id: "gateway_session_id",
  litellm_prompt_id: "gateway_prompt_id",
  litellm_budget_table: "gateway_budget",
  litellm_params_template: "gateway_params_template",
  include_in_litellm_params: "include_in_gateway_params",
  litellm_disabled_callbacks: "gateway_disabled_callbacks",
};
const tableNames: Readonly<Record<string, string>> = {
  LiteLLM_TeamTable: "Gateway_TeamTable",
  LiteLLM_UserTable: "Gateway_UserTable",
  LiteLLM_VerificationToken: "Gateway_VerificationToken",
  LiteLLM_ProxyModelTable: "Gateway_ProxyModelTable",
  LiteLLM_ManagedFileTable: "Gateway_ManagedFileTable",
  LiteLLM_ToolTable: "Gateway_ToolTable",
  LiteLLM_CacheConfig: "Gateway_CacheConfig",
  LiteLLM_ConfigOverrides: "Gateway_ConfigOverrides",
  LiteLLM_Config: "Gateway_Config",
  LiteLLM_SSOConfig: "Gateway_SSOConfig",
  LiteLLM_UISettings: "Gateway_UISettings",
  LiteLLM_AgentsTable: "Gateway_AgentsTable",
  LiteLLM_OrganizationTable: "Gateway_OrganizationTable",
};
const internalTableNames = Object.fromEntries(Object.entries(tableNames).map(([key, value]) => [value, key]));

const providerNames: Readonly<Record<string, string>> = {
  litellm_proxy: "ai_gateway",
  LITELLM_PROXY: "AI_GATEWAY",
  litellm_content_filter: "gateway_content_filter",
};
const internalProviderNames = Object.fromEntries(Object.entries(providerNames).map(([key, value]) => [value, key]));
const providerFields = new Set(["provider", "litellm_provider", "gateway_provider", "custom_llm_provider", "guardrail"]);

function translateEnumValue(key: string, value: string, incoming = false): string {
  if (key === "table_name") return (incoming ? internalTableNames : tableNames)[value] ?? value;
  if (providerFields.has(key)) return (incoming ? internalProviderNames : providerNames)[value] ?? value;
  return value;
}

const internalFields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [value, key]));
const opaque = new Set([
  "metadata",
  "gateway_metadata",
  "litellm_metadata",
  "messages",
  "content",
  "input",
  "output",
  "choices",
  "tools",
  "tool_calls",
  "arguments",
  "parameters",
  "json_schema",
  "response_format",
  "usage",
  "model_info",
  "environment_variables",
]);
const paths: Readonly<Record<string, string>> = {
  "/litellm-asset-prefix": "/ai-gateway-assets",
  "/ui/litellm-runtime-config.json": "/ui/ai-gateway-runtime-config.json",
  "/litellm/.well-known/litellm-ui-config": "/ai-gateway/.well-known/ui-config",
  "/.well-known/litellm-ui-config": "/.well-known/ai-gateway-ui-config",
  "/.well-known/litellm-cli-auth": "/.well-known/ai-gateway-cli-auth",
  "/public/litellm_blog_posts": "/public/gateway_updates",
  "/public/litellm_model_cost_map": "/public/gateway_model_cost_map",
};

export function translateProductFields(value: unknown, incoming = false): unknown {
  if (Array.isArray(value)) return value.map((item) => translateProductFields(item, incoming));
  if (value === null || typeof value !== "object") return value;
  const names = incoming ? internalFields : fields;
  const sourcePrefix = incoming ? "AI_GATEWAY_" : "LITELLM_";
  const targetPrefix = incoming ? "LITELLM_" : "AI_GATEWAY_";
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      names[key] ?? (key.startsWith(sourcePrefix) ? targetPrefix + key.slice(sourcePrefix.length) : key),
      opaque.has(key) ? item : typeof item === "string" ? translateEnumValue(key, item, incoming) : translateProductFields(item, incoming),
    ]),
  );
}

export function productUrl(url: string): string {
  const parsed = new URL(url, "http://localhost");
  const match = Object.entries(paths).find(
    ([oldPath]) => parsed.pathname === oldPath || parsed.pathname.startsWith(`${oldPath}/`),
  );
  if (match) parsed.pathname = match[1] + parsed.pathname.slice(match[0].length);
  const entries = [...parsed.searchParams.entries()];
  if (entries.some(([key, value]) => key in fields || translateEnumValue(key, value) !== value)) {
    parsed.search = new URLSearchParams(entries.map(([key, value]) => [fields[key] ?? key, translateEnumValue(key, value)])).toString();
  }
  return /^https?:\/\//.test(url) ? parsed.toString() : `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export const productFetch: typeof fetch = async (input, init) => {
  const request = new Request(
    input instanceof Request ? input : new URL(String(input), globalThis.location?.origin ?? "http://localhost"),
    init,
  );
  const headers = new Headers();
  request.headers.forEach((value, key) => headers.set(key.replace(/^x-litellm-/, "x-ai-gateway-"), value));
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  const outbound =
    body?.byteLength && headers.get("content-type")?.includes("application/json")
      ? JSON.stringify(translateProductFields(JSON.parse(new TextDecoder().decode(body))))
      : body;
  const response = await globalThis.fetch(productUrl(request.url), {
    method: request.method,
    headers,
    body: outbound,
    signal: request.signal,
    credentials: request.credentials,
    redirect: request.redirect,
    cache: request.cache,
  });
  if (
    request.method === "HEAD" ||
    !response.headers.get("content-type")?.includes("application/json") ||
    response.status === 204 ||
    response.status === 205
  ) return response;
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-length");
  responseHeaders.delete("content-encoding");
  return new Response(JSON.stringify(translateProductFields(await response.json(), true)), {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
};
