"use client";

import { useLogin } from "@/app/(dashboard)/hooks/login/useLogin";
import { useUIConfig } from "@/app/(dashboard)/hooks/uiConfig/useUIConfig";
import LoadingScreen from "@/components/common_components/LoadingScreen";
import {
  exchangeLoginCode,
  getProxyBaseUrl,
  getRuntimeBackendBaseUrl,
  getUiPageUrl,
  switchToWorkerUrl,
} from "@/components/networking";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/shared/Alert";
import { PasswordInput } from "@/components/shared/PasswordInput";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { FormField } from "@/components/shared/form/FormField";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UiLoadingSpinner } from "@/components/ui/ui-loading-spinner";
import { useZodForm } from "@/lib/forms/useZodForm";
import { clearTokenCookies, getCookieFromDocument } from "@/utils/cookieUtils";
import { isJwtExpired } from "@/utils/jwtUtils";
import { consumeReturnUrl, getLoginUrl, getReturnUrl, isValidReturnUrl } from "@/utils/returnUrlUtils";
import { CheckCircle2, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { z } from "zod";
import { useWorker } from "@/hooks/useWorker";
import i18n from "@/i18n/i18n";
import { productNames } from "@/i18n/untranslated/productNames";
import aiGwLogo from "../../../public/assets/logos/ai_gw_logo.svg";
import aiGwLogoDark from "../../../public/assets/logos/ai_gw_logo_dark.svg";

const loginSchema = z.object({
  username: z.string().min(1, { error: () => i18n.t("login.schema.usernameRequired") }),
  password: z.string().min(1, { error: () => i18n.t("login.schema.passwordRequired") }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

function SsoEnabledNotice() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <Alert variant="info" className="mt-4">
      <Info />
      <AlertTitle>
        <Trans
          i18nKey="login.ssoNotice.title"
          components={{
            setting: (
              <code className="bg-muted px-1 py-0.5 rounded-sm text-xs">AUTO_REDIRECT_UI_LOGIN_TO_SSO=true</code>
            ),
          }}
        />
      </AlertTitle>
      <AlertAction>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t("login.ssoNotice.close")}
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" />
        </Button>
      </AlertAction>
    </Alert>
  );
}

function LoginPageContent() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const { data: uiConfig, isLoading: isConfigLoading } = useUIConfig();
  const loginMutation = useLogin();
  const router = useRouter();
  const { workers, selectWorker } = useWorker();
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const workerFieldId = useId();
  const form = useZodForm(loginSchema, { defaultValues: { username: "", password: "" } });

  // Pre-select worker from URL param (e.g. /ui/login?worker=team-b)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const workerParam = params.get("worker");
    if (workerParam) {
      setSelectedWorkerId(workerParam);
    }
  }, []);

  useEffect(() => {
    if (isConfigLoading) {
      return;
    }

    // Check if admin UI is disabled
    if (uiConfig && uiConfig.admin_ui_disabled) {
      setIsLoading(false);
      return;
    }

    // Cross-origin SSO: worker redirected back with a single-use code.
    // Exchange it for the JWT via the worker's /v3/login/exchange endpoint.
    const params = new URLSearchParams(window.location.search);
    const rawSsoCode = params.get("code");
    // Validate the SSO code is a plausible OAuth authorization code (alphanumeric
    // plus common URL-safe chars) so that arbitrary user input cannot trigger the
    // exchange endpoint.
    const ssoCode = rawSsoCode && /^[a-zA-Z0-9._~+/=-]+$/.test(rawSsoCode) ? rawSsoCode : null;
    if (ssoCode) {
      const rawWorkerUrl = localStorage.getItem("litellm_worker_url");
      // Validate the stored worker URL: only allow http(s) URLs.
      const workerUrl = rawWorkerUrl && /^https?:\/\/.+/.test(rawWorkerUrl) ? rawWorkerUrl : null;
      exchangeLoginCode(ssoCode, workerUrl).then(() => {
        params.delete("code");
        const cleanSearch = params.toString();
        window.history.replaceState(null, "", window.location.pathname + (cleanSearch ? `?${cleanSearch}` : ""));
        router.replace("/ui/?login=success");
      });
      return;
    }

    // If switching workers on a control plane, clear the old token and show login
    const switchingWorker = params.has("worker");
    if (switchingWorker && uiConfig?.is_control_plane) {
      clearTokenCookies();
      setIsLoading(false);
      return;
    }

    const rawToken = getCookieFromDocument("token");
    if (rawToken && !isJwtExpired(rawToken)) {
      // User already logged in - redirect to return URL or default
      const returnUrl = consumeReturnUrl(getRuntimeBackendBaseUrl());
      if (returnUrl) {
        router.replace(getUiPageUrl(returnUrl, true));
      } else {
        router.replace("/ui");
      }
      return;
    }

    if (uiConfig && uiConfig.auto_redirect_to_sso) {
      // For SSO, pass the return URL to the SSO endpoint
      const returnUrl = getReturnUrl();
      let ssoUrl = `${getProxyBaseUrl()}/sso/key/generate`;
      if (returnUrl && isValidReturnUrl(returnUrl)) {
        ssoUrl += `?redirect_to=${encodeURIComponent(returnUrl)}`;
      }
      router.push(ssoUrl);
      return;
    }

    setIsLoading(false);
  }, [isConfigLoading, router, uiConfig]);

  const handleSubmit = ({ username, password }: LoginFormValues) => {
    // If a worker is selected, point proxyBaseUrl at it before login
    const selectedWorker = workers.find((w) => w.worker_id === selectedWorkerId);
    if (selectedWorker) {
      switchToWorkerUrl(selectedWorker.url);
    }

    loginMutation.mutate(
      { username, password, useV3: !!selectedWorker },
      {
        onSuccess: (data) => {
          // Update the worker context with the selected worker
          if (selectedWorker) {
            selectWorker(selectedWorker.worker_id);
            // Stay on the CP's UI — proxyBaseUrl already points at the worker
            router.push("/ui/?login=success");
          } else {
            // Normal (non-control-plane) login — follow the server's redirect
            const returnUrl = consumeReturnUrl(getRuntimeBackendBaseUrl());
            if (returnUrl) {
              router.push(getUiPageUrl(returnUrl, true));
            } else {
              router.push(getUiPageUrl(data.redirect_url, true));
            }
          }
        },
        onError: () => {
          // Reset proxyBaseUrl on login failure
          if (selectedWorker) {
            switchToWorkerUrl(null);
          }
        },
      },
    );
  };

  const error = loginMutation.error instanceof Error ? loginMutation.error.message : null;
  const isLoginLoading = loginMutation.isPending;

  if (isConfigLoading || isLoading) {
    return <LoadingScreen />;
  }

  // Show disabled message if admin UI is disabled
  if (uiConfig && uiConfig.admin_ui_disabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Card className="w-full max-w-lg shadow-md">
          <CardContent>
            <div className="flex w-full flex-col gap-4">
              <div className="flex justify-center">
                <img src={aiGwLogo.src} alt={productNames.liteLLM} className="h-8 w-auto" />
              </div>

              <Alert variant="warning">
                <TriangleAlert />
                <AlertTitle>{t("login.adminDisabled.title")}</AlertTitle>
                <AlertDescription>
                  <p className="text-sm">{t("login.adminDisabled.description")}</p>
                  <p className="mt-2 text-sm">
                    <code className="bg-muted px-1 py-0.5 rounded-sm text-xs">DISABLE_ADMIN_UI=False</code>
                  </p>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const heroPoints = [
    t("login.hero.points.access"),
    t("login.hero.points.quota"),
    t("login.hero.points.audit"),
  ];

  return (
    <div className="min-h-screen bg-[#f5f7fb] lg:grid lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-[#0a1830] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_15%_10%,rgba(59,130,246,0.35),transparent_55%),radial-gradient(ellipse_at_85%_90%,rgba(124,58,237,0.28),transparent_50%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:48px_48px]" />
        </div>
        <div className="relative">
          <img src={aiGwLogoDark.src} alt={productNames.liteLLM} className="h-8 w-auto" />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-3xl font-semibold leading-snug">{t("login.hero.title")}</h1>
          <p className="mt-4 text-sm leading-6 text-white/70">{t("login.hero.subtitle")}</p>
          <ul className="mt-8 space-y-3">
            {heroPoints.map((point) => (
              <li key={point} className="flex items-center gap-2.5 text-sm text-white/85">
                <CheckCircle2 className="size-4 shrink-0 text-sky-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">
          {t("shell.footer.copyright", { brand: productNames.liteLLM, year: new Date().getFullYear() })}
        </p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 lg:min-h-0 lg:py-0">
        <Card className="w-full max-w-md rounded-2xl border-0 shadow-[0_24px_64px_-24px_rgba(15,23,42,0.28)]">
          <CardContent className="p-8">
            <TooltipProvider>
              <div className="flex w-full flex-col gap-5">
                <img
                  src={aiGwLogo.src}
                  alt={productNames.liteLLM}
                  className="h-8 w-auto self-start lg:hidden"
                />

                <div>
                  <h3 className="text-2xl font-semibold text-foreground">{t("login.form.title")}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{t("login.form.subtitle")}</p>
                </div>

              {!uiConfig?.hide_default_credentials_hint && (
                <Alert variant="info">
                  <Info />
                  <AlertTitle>{t("login.form.defaultCredentials.title")}</AlertTitle>
                  <AlertDescription>
                    <p className="text-sm">
                      <Trans
                        i18nKey="login.form.defaultCredentials.body"
                        components={{
                          username: <code className="bg-muted px-1 py-0.5 rounded-sm text-xs">admin</code>,
                          masterkey: <code className="bg-muted px-1 py-0.5 rounded-sm text-xs">MASTER_KEY</code>,
                        }}
                      />
                    </p>
                    <p className="mt-2 text-sm">
                      <Trans
                        i18nKey="login.form.defaultCredentials.help"
                        components={{
                          docs: (
                            <a href="/docs" target="_blank" rel="noopener noreferrer" />
                          ),
                        }}
                      />
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              {error && (
                <Alert variant="error">
                  <CircleAlert />
                  <AlertTitle>{error}</AlertTitle>
                </Alert>
              )}

              <form onSubmit={form.handleSubmit(handleSubmit)}>
                <FieldGroup>
                  {uiConfig?.is_control_plane && workers.length > 0 && (
                    <Field>
                      <FieldLabel htmlFor={workerFieldId}>{t("login.form.worker.label")}</FieldLabel>
                      <Select
                        items={workers.map((worker) => ({ label: worker.name, value: worker.worker_id }))}
                        value={selectedWorkerId}
                        onValueChange={(value: string | null) => setSelectedWorkerId(value)}
                      >
                        <SelectTrigger id={workerFieldId} className="h-10 w-full">
                          <SelectValue placeholder={t("login.form.worker.placeholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {workers.map((worker) => (
                            <SelectItem key={worker.worker_id} value={worker.worker_id}>
                              {worker.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  )}

                  <FormField control={form.control} name="username" label={t("login.form.username.label")}>
                    {({ ref, ...field }) => (
                      <Input
                        {...field}
                        ref={ref}
                        placeholder={t("login.form.username.placeholder")}
                        autoComplete="username"
                        disabled={isLoginLoading}
                        className="h-10 rounded-md"
                      />
                    )}
                  </FormField>

                  <FormField control={form.control} name="password" label={t("login.form.password.label")}>
                    {({ ref, ...field }) => (
                      <PasswordInput
                        {...field}
                        ref={ref}
                        placeholder={t("login.form.password.placeholder")}
                        autoComplete="current-password"
                        disabled={isLoginLoading}
                        groupClassName="h-10"
                      />
                    )}
                  </FormField>

                  <Button type="submit" size="lg" disabled={isLoginLoading} className="w-full">
                    {isLoginLoading && (
                      <UiLoadingSpinner className="size-4" role="img" aria-label={t("login.form.loading")} />
                    )}
                    {isLoginLoading ? t("login.form.submitting") : t("login.form.submit")}
                  </Button>

                  {!uiConfig?.sso_configured ? (
                    <Tooltip>
                      <TooltipTrigger render={<span className="block w-full" />}>
                        <Button type="button" variant="outline" size="lg" disabled className="w-full">
                          {t("login.form.sso")}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("login.form.ssoUnavailable")}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      disabled={isLoginLoading || (!!selectedWorkerId && workers.length === 0)}
                      onClick={() => {
                        const selectedWorker = workers.find((w) => w.worker_id === selectedWorkerId);
                        if (selectedWorker) {
                          // Store worker selection so useWorker hook restores it after redirect
                          localStorage.setItem("litellm_selected_worker_id", selectedWorkerId!);
                          switchToWorkerUrl(selectedWorker.url);
                        }
                        // SSO on the worker (or this instance if no worker), always
                        // include return_to so the callback redirects back here
                        const ssoBase = selectedWorker?.url ?? getProxyBaseUrl();
                        const returnTo = encodeURIComponent(getLoginUrl(window.location.origin));
                        router.push(`${ssoBase}/sso/key/generate?return_to=${returnTo}`);
                      }}
                      className="w-full"
                    >
                      {t("login.form.sso")}
                    </Button>
                  )}
                </FieldGroup>
              </form>
              </div>
              {uiConfig?.sso_configured && <SsoEnabledNotice />}
            </TooltipProvider>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return <LoginPageContent />;
}
