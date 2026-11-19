import { describe, expect, it } from "vitest";
import {
  buildIdentityParams,
  entraTenantFromIssuer,
  parseIdentityForForm,
  readAgentIdentity,
  withAgentIdentity,
} from "./agent_identity";

const identity = {
  provider: "microsoft_entra",
  tenant_id: "11111111-1111-4111-8111-111111111111",
  client_id: "22222222-2222-4222-8222-222222222222",
  service_principal_id: "33333333-3333-4333-8333-333333333333",
  required_roles: ["Agent.Invoke"],
  required_scopes: ["user_impersonation"],
} satisfies import("./agent_identity").EntraAgentIdentity;

describe("agent identity configuration", () => {
  it("round trips an existing binding independently of the agent name and runtime", () => {
    const values = {
      ...parseIdentityForForm({
        identity: { ...identity, agent_id: "stable", active: true, revision: "rev", issuer: "https://issuer.example" },
      }),
      agent_name: "Renamed",
      url: "https://new-runtime.example",
    };
    expect(buildIdentityParams(values)).toEqual({ identity });
  });
  it("preserves untouched bindings and explicitly clears a removed binding", () => {
    expect(buildIdentityParams({ agent_name: "legacy" })).toEqual({});
    expect(buildIdentityParams({ identity_provider: "none" }, identity)).toEqual({ identity: null });
    expect(parseIdentityForForm({}).identity_provider).toBe("none");
  });
  it.each([
    null,
    {},
    "invalid",
    { ...identity, client_id: "bad" },
    { ...identity, tenant_id: 3 },
    { ...identity, provider: "other" },
  ])("rejects malformed bindings: %j", (value) => {
    expect(readAgentIdentity(value)).toBeNull();
  });
  it("rejects incomplete submissions", () => {
    expect(() => buildIdentityParams({ identity_provider: "microsoft_entra" })).toThrow("Enter valid Entra");
  });
  it("submits identity as top-level settings without changing runtime parameters", () => {
    const formValues = {
      identity_provider: "microsoft_entra",
      identity_tenant_id: identity.tenant_id,
      identity_client_id: identity.client_id,
      identity_service_principal_id: identity.service_principal_id,
      execution_mode: "both",
      enabled: false,
    };
    const payload = withAgentIdentity({ litellm_params: { model: "runtime" } }, formValues);
    expect(payload.litellm_params).toEqual({ model: "runtime" });
    expect(payload.identity).toMatchObject({
      client_id: identity.client_id,
      service_principal_id: identity.service_principal_id,
    });
    expect(payload.execution_mode).toBe("both");
    expect(payload.enabled).toBe(false);
  });
  it("requires a service principal for autonomous execution", () => {
    const values = {
      identity_provider: "microsoft_entra",
      identity_tenant_id: identity.tenant_id,
      identity_client_id: identity.client_id,
      execution_mode: "autonomous",
    };
    expect(() => buildIdentityParams(values)).toThrow("Enterprise application Object ID");
  });

  it("only offers tenant-specific Microsoft issuers", () => {
    expect(entraTenantFromIssuer(`https://login.microsoftonline.com/${identity.tenant_id}/v2.0`)).toBe(
      identity.tenant_id,
    );
    expect(entraTenantFromIssuer("https://attacker.example/tenant/v2.0")).toBeNull();
    expect(entraTenantFromIssuer("https://login.microsoftonline.com/common/v2.0")).toBeNull();
  });
});

describe("external OIDC agent identity", () => {
  const external = {
    provider: "external_oidc" as const,
    tenant_id: "https://identity.example/realms/Company",
    client_id: "AgentClient",
    service_principal_id: "SubjectABC",
    required_roles: [],
    required_scopes: ["gateway.invoke"],
  };
  it("round trips case-sensitive external bindings without clearing them", () => {
    const values = parseIdentityForForm({
      identity: { ...external, agent_id: "agent", issuer: external.tenant_id, revision: "one" },
    });
    expect(buildIdentityParams(values)).toEqual({ identity: external });
    expect(withAgentIdentity({}, { ...values, enabled: false }).enabled).toBe(false);
    expect(buildIdentityParams({ identity_provider: "none" }, external)).toEqual({ identity: null });
  });
  it.each(["delegated", "both"])("rejects unsupported execution mode %s", (mode) => {
    expect(() => buildIdentityParams({ identity_provider: "external_oidc", execution_mode: mode })).toThrow(
      "autonomous",
    );
  });
  it("does not silently unbind an unknown provider", () => {
    expect(() => buildIdentityParams({ identity_provider: "typo" }, external)).toThrow("Unsupported identity provider");
  });
  it("rejects an empty workload subject", () => {
    expect(() =>
      buildIdentityParams({
        identity_provider: "external_oidc",
        identity_tenant_id: external.tenant_id,
        identity_client_id: external.client_id,
        identity_service_principal_id: "",
      }),
    ).toThrow("workload subject");
  });
});
