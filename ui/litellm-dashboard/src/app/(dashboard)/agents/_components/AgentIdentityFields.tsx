import React, { useEffect, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import type { ParseKeys } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import i18n from "@/i18n/i18n";
import { apiClient } from "@/components/networking";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentFormField, type AgentFormValues } from "./AgentFormKit";
import { entraTenantFromIssuer, IDENTITY_UUID_PATTERN, isManagedIdentityProvider } from "./agent_identity";
import { codeSamples } from "@/i18n/untranslated/codeSamples";

const PROVIDER_OPTIONS: { value: string; labelKey: ParseKeys }[] = [
  { value: "external_oidc", labelKey: "agents.identityFields.providers.externalOidc" },
  { value: "none", labelKey: "agents.identityFields.providers.none" },
  { value: "microsoft_entra", labelKey: "agents.identityFields.providers.microsoftEntra" },
];
const EXECUTION_MODE_OPTIONS: { value: string; labelKey: ParseKeys }[] = [
  { value: "autonomous", labelKey: "agents.identityFields.executionModes.autonomous" },
  { value: "delegated", labelKey: "agents.identityFields.executionModes.delegated" },
  { value: "both", labelKey: "agents.identityFields.executionModes.both" },
];
const EXECUTION_OPTIONS: { value: string; labelKey: ParseKeys }[] = [
  { value: "enabled", labelKey: "agents.identityFields.execution.enabled" },
  { value: "disabled", labelKey: "agents.identityFields.execution.disabled" },
];

export const AgentIdentityFields = ({ accessToken }: { accessToken: string | null }) => {
  const { t } = useTranslation();
  const provider = useWatch<AgentFormValues>({ name: "identity_provider" });
  const mode = useWatch<AgentFormValues>({ name: "execution_mode" });
  const external = provider === "external_oidc";
  const { setValue } = useFormContext<AgentFormValues>();
  const showScopes = external || (mode !== "autonomous" && mode !== undefined);
  const defaultScope = external ? "gateway.invoke" : "user_impersonation";
  const identityText = (entraKey: ParseKeys, externalKey: ParseKeys) => t(external ? externalKey : entraKey);
  const executionModes = external ? EXECUTION_MODE_OPTIONS.slice(0, 1) : EXECUTION_MODE_OPTIONS;
  const [tenants, setTenants] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !isManagedIdentityProvider(provider)) return;
    let active = true;
    apiClient
      .get<string[]>("/v1/agents/identity/providers", { accessToken })
      .then((issuers) => {
        if (active) {
          setError(null);
          setTenants(
            issuers.flatMap((issuer) => {
              const tenant = entraTenantFromIssuer(issuer);
              if (external) return tenant ? [] : [issuer];
              return tenant ? [tenant] : [];
            }),
          );
        }
      })
      .catch(() => {
        if (active) setError(i18n.t("agents.identityFields.errors.providersLoadFailed"));
      });
    return () => {
      active = false;
    };
  }, [accessToken, provider, external]);

  const changeProvider = (next: string | null, onChange: (value: unknown) => void) => {
    setTenants([]);
    setError(null);
    onChange(next);
    setValue("identity_tenant_id", "");
    setValue("identity_client_id", "");
    setValue("identity_service_principal_id", "");
    setValue("identity_required_roles", "");
    setValue("identity_required_scopes", next === "external_oidc" ? "gateway.invoke" : "user_impersonation");
    setValue("execution_mode", "autonomous");
  };

  return (
    <>
      <section
        aria-label={t("agents.identityFields.regionLabel")}
        className="my-6 space-y-4 rounded-lg border border-border p-4"
      >
        <div>
          <h3 className="font-medium">{t("agents.identityFields.title")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("agents.identityFields.description")}</p>
        </div>
        <AgentFormField name="identity_provider" label={t("agents.identityFields.provider")} defaultValue="none">
          {({ value, onChange, id }) => (
            <Select
              items={PROVIDER_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
              value={typeof value === "string" ? value : "none"}
              onValueChange={(next) => changeProvider(next, onChange)}
            >
              <SelectTrigger id={id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </AgentFormField>
        {isManagedIdentityProvider(provider) && (
          <>
            <AgentFormField
              name="identity_tenant_id"
              label={identityText("agents.identityFields.tenant.label", "agents.identityFields.external.issuer")}
              rules={{
                required: identityText(
                  "agents.identityFields.tenant.required",
                  "agents.identityFields.external.issuerRequired",
                ),
              }}
            >
              {({ value, onChange, id }) => (
                <Select value={typeof value === "string" ? value : ""} onValueChange={onChange}>
                  <SelectTrigger id={id}>
                    <SelectValue
                      placeholder={identityText(
                        "agents.identityFields.tenant.placeholder",
                        "agents.identityFields.external.issuerRequired",
                      )}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((tenant) => (
                      <SelectItem key={tenant} value={tenant}>
                        {tenant}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </AgentFormField>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            {!error && tenants.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {identityText("agents.identityFields.tenant.noneAvailable", "agents.identityFields.external.noIssuers")}
              </p>
            )}
            <AgentFormField
              name="identity_client_id"
              label={t("agents.identityFields.clientId.label")}
              rules={{
                required: identityText(
                  "agents.identityFields.clientId.required",
                  "agents.identityFields.external.clientRequired",
                ),
                ...(external
                  ? {}
                  : {
                      pattern: { value: IDENTITY_UUID_PATTERN, message: t("agents.identityFields.clientId.invalid") },
                    }),
              }}
              description={
                external ? (
                  t("agents.identityFields.external.claimNote")
                ) : (
                  <Trans
                    i18nKey="agents.identityFields.clientId.description"
                    components={{
                      registrations: (
                        <a className="underline" href="https://entra.microsoft.com/" target="_blank" rel="noreferrer" />
                      ),
                    }}
                  />
                )
              }
            >
              {({ value, onChange, ref, ...control }) => (
                <Input
                  {...control}
                  ref={ref}
                  value={typeof value === "string" ? value : ""}
                  onChange={onChange}
                  placeholder={external ? "" : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}
                />
              )}
            </AgentFormField>
            <AgentFormField
              name="execution_mode"
              label={t("agents.identityFields.executionMode")}
              defaultValue="autonomous"
            >
              {({ value, onChange, id }) => (
                <Select
                  items={executionModes.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                  value={typeof value === "string" ? value : "autonomous"}
                  onValueChange={onChange}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {executionModes.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </AgentFormField>
            <AgentFormField
              name="identity_service_principal_id"
              label={identityText(
                "agents.identityFields.servicePrincipal.label",
                "agents.identityFields.external.subject",
              )}
              rules={{
                required:
                  mode !== "delegated"
                    ? identityText(
                        "agents.identityFields.servicePrincipal.required",
                        "agents.identityFields.external.subjectRequired",
                      )
                    : false,
                ...(external
                  ? {}
                  : {
                      pattern: {
                        value: IDENTITY_UUID_PATTERN,
                        message: t("agents.identityFields.servicePrincipal.invalid"),
                      },
                    }),
              }}
              description={
                external ? (
                  t("agents.identityFields.external.claimNote")
                ) : (
                  <Trans
                    i18nKey="agents.identityFields.servicePrincipal.description"
                    components={{
                      enterprise: (
                        <a
                          className="underline"
                          href="https://entra.microsoft.com/#view/Microsoft_AAD_IAM/StartboardApplicationsMenuBlade/~/AppAppsPreview"
                          target="_blank"
                          rel="noreferrer"
                        />
                      ),
                    }}
                  />
                )
              }
            >
              {({ value, onChange, ref, ...control }) => (
                <Input {...control} ref={ref} value={typeof value === "string" ? value : ""} onChange={onChange} />
              )}
            </AgentFormField>

            {!external && (
              <AgentFormField
                name="identity_required_roles"
                label={t("agents.identityFields.requiredRoles.label")}
                description={t("agents.identityFields.requiredRoles.description")}
              >
                {({ value, onChange, ref, ...control }) => (
                  <Input
                    {...control}
                    ref={ref}
                    value={typeof value === "string" ? value : ""}
                    onChange={onChange}
                    placeholder={codeSamples.agents.identityScope}
                  />
                )}
              </AgentFormField>
            )}

            {showScopes && (
              <>
                <AgentFormField
                  name="identity_required_scopes"
                  label={identityText(
                    "agents.identityFields.requiredScopes.label",
                    "agents.identityFields.external.scopes",
                  )}
                  defaultValue={external ? "gateway.invoke" : "user_impersonation"}
                  rules={{
                    required: identityText(
                      "agents.identityFields.requiredScopes.required",
                      "agents.identityFields.external.scopesRequired",
                    ),
                  }}
                >
                  {({ value, onChange, ref, ...control }) => (
                    <Input
                      {...control}
                      ref={ref}
                      value={typeof value === "string" ? value : defaultScope}
                      onChange={onChange}
                    />
                  )}
                </AgentFormField>
                <p className="text-sm text-muted-foreground">
                  {identityText(
                    "agents.identityFields.requiredScopes.note",
                    "agents.identityFields.external.scopeNote",
                  )}
                </p>
              </>
            )}
            <AgentFormField name="enabled" label={t("agents.identityFields.executionLabel")} defaultValue={true}>
              {({ value, onChange, id }) => (
                <Select
                  items={EXECUTION_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                  value={value === false ? "disabled" : "enabled"}
                  onValueChange={(next) => onChange(next === "enabled")}
                >
                  <SelectTrigger id={id}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXECUTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </AgentFormField>
            <p className="text-sm text-muted-foreground">
              {identityText(
                "agents.identityFields.verificationNote",
                "agents.identityFields.external.verificationNote",
              )}
            </p>
          </>
        )}
      </section>
    </>
  );
};
