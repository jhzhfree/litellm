"use client";

import { useTranslation } from "react-i18next";

/**
 * Bottom toolbar pinned under the main content area (right of the sidebar).
 * v1 shows only the product copyright; extend by rendering additional
 * items into the right-hand slot below.
 */
export function BottomToolbar() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();

  return (
    <footer
      data-testid="bottom-toolbar"
      className="flex h-7 flex-none items-center justify-between gap-4 border-t border-border bg-background px-4 text-xs text-muted-foreground"
    >
      <span className="truncate">{t("shell.footer.copyright", { brand: t("shell.brand.name"), year })}</span>
      <div className="flex flex-none items-center gap-3">{/* future toolbar items */}</div>
    </footer>
  );
}
