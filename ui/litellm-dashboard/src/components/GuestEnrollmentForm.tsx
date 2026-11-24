import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { apiClient } from "./networking";

type GuestState = "not_started" | "identity_created" | "awaiting_activation" | "activation_requested" | "active";
type GuestAction = "prepare" | "status" | "send";

export function GuestEnrollmentForm({
  accessToken,
  busy,
  onBusyChange,
}: {
  accessToken: string;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{ operation_id: string; state: GuestState } | null>(null);

  const perform = async (action: GuestAction) => {
    if (!email.trim() || busy) return;
    onBusyChange(true);
    try {
      const next = await apiClient.post<{ operation_id: string; state: GuestState }>("/sso/users/guest", {
        accessToken,
        body: { email: email.trim(), action },
      });
      setResult(next);
      if (action === "prepare") await queryClient.invalidateQueries({ queryKey: ["userList"] });
    } catch {
      setResult(null);
      toast.error(t("users.createUser.guest.error"));
    } finally {
      onBusyChange(false);
    }
  };

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        void perform("prepare");
      }}
    >
      <label className="block space-y-2">
        <span className="text-sm font-medium">{t("users.createUser.guest.email")}</span>
        <Input
          type="email"
          value={email}
          maxLength={254}
          required
          disabled={busy}
          onChange={(event) => {
            setEmail(event.target.value);
            setResult(null);
          }}
        />
      </label>
      {result && (
        <div role="status" className="space-y-1 text-sm">
          <p>{t(`users.createUser.guest.states.${result.state}`)}</p>
          <p className="break-all text-muted-foreground">
            {t("users.createUser.guest.operation", { id: result.operation_id })}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy || !email.trim()}>
          {t("users.createUser.guest.prepare")}
        </Button>
        <Button type="button" variant="outline" disabled={busy || !email.trim()} onClick={() => void perform("status")}>
          {t("users.createUser.guest.status")}
        </Button>
        {result?.state === "awaiting_activation" && (
          <Button type="button" variant="outline" disabled={busy} onClick={() => void perform("send")}>
            {t("users.createUser.guest.send")}
          </Button>
        )}
      </div>
    </form>
  );
}
