export type GatewayTrace = Readonly<{
  callId?: string;
  modelGroup?: string;
  deploymentId?: string;
  providerModel?: string;
  apiBase?: string;
  attemptedFallbacks?: number;
  attemptedRetries?: number;
  overheadMs?: number;
  responseMs?: number;
  cost?: number;
  appliedGuardrails: readonly string[];
  appliedPolicies?: readonly string[];
  cacheHit: boolean;
}>;

const text = (headers: Headers, name: string): string | undefined => {
  const value = headers.get(name)?.trim();
  return value ? value : undefined;
};

const number = (headers: Headers, name: string): number | undefined => {
  const value = text(headers, name);
  if (value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const list = (headers: Headers, name: string): readonly string[] =>
  (text(headers, name) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");

export const gatewayTraceFromHeaders = (headers: Headers): GatewayTrace => ({
  callId: text(headers, "x-ai-gateway-call-id"),
  modelGroup: text(headers, "x-ai-gateway-model-group"),
  deploymentId: text(headers, "x-ai-gateway-model-id"),
  providerModel: text(headers, "x-ai-gateway-model-name"),
  apiBase: text(headers, "x-ai-gateway-model-api-base"),
  attemptedFallbacks: number(headers, "x-ai-gateway-attempted-fallbacks"),
  attemptedRetries: number(headers, "x-ai-gateway-attempted-retries"),
  overheadMs: number(headers, "x-ai-gateway-overhead-duration-ms"),
  responseMs: number(headers, "x-ai-gateway-response-duration-ms"),
  cost: number(headers, "x-ai-gateway-response-cost"),
  appliedGuardrails: list(headers, "x-ai-gateway-applied-guardrails"),
  appliedPolicies: headers.has("x-ai-gateway-call-id") ? list(headers, "x-ai-gateway-applied-policies") : undefined,
  cacheHit: text(headers, "x-ai-gateway-cache-key") !== undefined,
});
