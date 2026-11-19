"use client";

import { useTranslation } from "react-i18next";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Global 404 page — any unmatched route renders this unified error page.
 */
export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      <div className="rounded-full bg-muted p-6">
        <Compass className="size-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <p className="text-6xl font-bold tracking-tight text-foreground">404</p>
      <h1 className="text-xl font-semibold">{t("notFound.title")}</h1>
      <p className="max-w-md text-sm text-muted-foreground">{t("notFound.description")}</p>
      <div className="mt-2 flex gap-3">
        <Button onClick={() => window.history.back()} variant="outline">
          {t("notFound.goBack")}
        </Button>
        <Button onClick={() => window.location.assign("/")}>{t("notFound.backHome")}</Button>
      </div>
    </div>
  );
}
