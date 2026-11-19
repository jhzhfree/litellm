import { z } from "zod";
import type { components } from "@/lib/http/schema";
import type { AgentFormValues, AgentRequestPayload } from "./AgentFormKit";

export type EntraAgentIdentity = components["schemas"]["EntraIdentityConfig"];
export type AgentIdentity = EntraAgentIdentity | components["schemas"]["ExternalOIDCIdentityConfig"];

export const isManagedIdentityProvider = (value: unknown): boolean =>
  value === "microsoft_entra" || value === "external_oidc";
type AgentIdentityState = Pick<
  components["schemas"]["AgentResponse"],
  "identity" | "enabled" | "execution_mode" | "agent_card_params"
>;

export const IDENTITY_UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const stringGrants = (fallback: string[]) =>
  z
    .unknown()
    .optional()
    .transform((value) =>
      Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : fallback,
    );

const identityShape = {
  provider: z.literal("microsoft_entra"),
  tenant_id: z.string().regex(IDENTITY_UUID_PATTERN),
  client_id: z.string().regex(IDENTITY_UUID_PATTERN),
  service_principal_id: z.string().regex(IDENTITY_UUID_PATTERN).nullable().default(null),
  required_roles: stringGrants([]),
  required_scopes: stringGrants(["user_impersonation"]),
};
const identitySchema = z.discriminatedUnion("provider", [
  z.object(identityShape),
  z.object({
    provider: z.literal("external_oidc"),
    tenant_id: z.string().url(),
    client_id: z.string().min(1),
    service_principal_id: z.string().min(1),
    required_roles: z.array(z.string()).max(0).default([]),
    required_scopes: stringGrants(["gateway.invoke"]),
  }),
]);

export const readAgentIdentity = (value: unknown): AgentIdentity | null => {
  const parsed = identitySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

const identityFormFields = (identity: AgentIdentity | null): AgentFormValues => ({
  identity_provider: identity?.provider ?? "none",
  identity_tenant_id: identity?.tenant_id ?? "",
  identity_client_id: identity?.client_id ?? "",
  identity_service_principal_id: identity?.service_principal_id ?? "",
  identity_required_roles: identity?.required_roles?.join(", ") ?? "",
  identity_required_scopes: identity?.required_scopes?.join(", ") ?? "user_impersonation",
});

export const parseIdentityForForm = (agent?: Partial<AgentIdentityState> | null): AgentFormValues => {
  const identity = agent?.identity?.active === false ? null : readAgentIdentity(agent?.identity);
  return {
    ...identityFormFields(identity),
    execution_mode: agent?.execution_mode ?? "autonomous",
    enabled: agent?.enabled ?? true,
  };
};

const splitGrants = (value: unknown, fallback: string[]): string[] =>
  typeof value === "string"
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : fallback;

export const buildIdentityParams = (
  values: AgentFormValues,
  existingIdentity?: unknown,
): { identity?: AgentIdentity | null } => {
  if (values.identity_provider === undefined) return {};
  if (values.identity_provider === "none") return readAgentIdentity(existingIdentity) ? { identity: null } : {};
  if (values.identity_provider === "external_oidc") {
    if (values.execution_mode && values.execution_mode !== "autonomous")
      throw new Error("External OIDC agents support autonomous execution only");
    const identity = readAgentIdentity({
      provider: "external_oidc",
      tenant_id: typeof values.identity_tenant_id === "string" ? values.identity_tenant_id.trim() : "",
      client_id: typeof values.identity_client_id === "string" ? values.identity_client_id.trim() : "",
      service_principal_id:
        typeof values.identity_service_principal_id === "string" ? values.identity_service_principal_id.trim() : "",
      required_roles: [],
      required_scopes: splitGrants(values.identity_required_scopes, ["gateway.invoke"]),
    });
    if (!identity) throw new Error("Enter a valid issuer, client ID and workload subject");
    return { identity };
  }
  if (values.identity_provider !== "microsoft_entra") throw new Error("Unsupported identity provider");
  const candidate: EntraAgentIdentity = {
    provider: "microsoft_entra",
    tenant_id: typeof values.identity_tenant_id === "string" ? values.identity_tenant_id.trim().toLowerCase() : "",
    client_id: typeof values.identity_client_id === "string" ? values.identity_client_id.trim().toLowerCase() : "",
    service_principal_id:
      typeof values.identity_service_principal_id === "string" && values.identity_service_principal_id.trim()
        ? values.identity_service_principal_id.trim().toLowerCase()
        : null,
    required_roles: splitGrants(values.identity_required_roles, []),
    required_scopes: splitGrants(values.identity_required_scopes, ["user_impersonation"]),
  };
  const identity = readAgentIdentity(candidate);
  if (!identity) throw new Error("Enter valid Entra tenant, application client and service principal IDs");
  if (values.execution_mode !== "delegated" && !identity.service_principal_id)
    throw new Error("Autonomous agents require the Enterprise application Object ID");
  return { identity };
};

export const entraTenantFromIssuer = (issuer: string): string | null => {
  const match = /^https:\/\/login\.microsoftonline\.com\/([^/]+)\/v2\.0$/.exec(issuer);
  return match && IDENTITY_UUID_PATTERN.test(match[1]) ? match[1] : null;
};

export const withAgentIdentity = (
  payload: AgentRequestPayload,
  values: AgentFormValues,
  existing?: Partial<AgentIdentityState>,
  cardEdited = false,
): AgentRequestPayload => {
  const { agent_card_params, ...settings } = payload;
  const hasCard = !existing || cardEdited || Object.keys(existing.agent_card_params ?? {}).length > 0;
  const identityFields = buildIdentityParams(values, existing?.identity);
  const managed = isManagedIdentityProvider(values.identity_provider) || Boolean(readAgentIdentity(existing?.identity));
  return {
    ...settings,
    ...(hasCard && agent_card_params ? { agent_card_params } : {}),
    ...identityFields,
    ...(managed && values.execution_mode !== undefined ? { execution_mode: values.execution_mode } : {}),
    ...(managed && values.enabled !== undefined ? { enabled: values.enabled } : {}),
  };
};
