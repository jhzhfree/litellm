"use client";

import { useTranslation } from "react-i18next";
import { useState } from "react";
import Link from "next/link";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { SidebarHeader } from "@/components/shared/Sidebar";
import { uiHref } from "@/utils/uiHref";
import { cn } from "@/lib/cva.config";
import { productNames } from "@/i18n/untranslated/productNames";
import aiGwLogo from "../../../public/assets/logos/ai_gw_logo.svg";
import aiGwLogoDark from "../../../public/assets/logos/ai_gw_logo_dark.svg";
import aiGwMonogram from "../../../public/assets/logos/ai_gw_monogram.svg";

// Admin-uploaded custom logos keep the horizontal wordmark proportions.
const LOGO_CLASS_NAME =
  "h-7 w-auto max-w-[180px] object-contain group-data-[collapsed=true]/sidebar:h-8 group-data-[collapsed=true]/sidebar:w-8";
// Bundled brand: enlarged monogram tile + product name text.
const MONOGRAM_CLASS_NAME = "h-9 w-9 flex-none rounded-md";

function bundledLogoSrc({ dark, monogram }: { dark: boolean; monogram: boolean }): string {
  if (monogram) return aiGwMonogram.src;
  return dark ? aiGwLogoDark.src : aiGwLogo.src;
}

export function SidebarBrand({
  homeHref = uiHref(""),
  homeLabel,
  collapsed = false,
  onToggleCollapsed,
  onHomeClick,
}: {
  accessToken?: string | null;
  homeHref?: string;
  homeLabel?: string;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  onHomeClick?: () => void;
}) {
  const { t } = useTranslation();
  const { logoUrl, logoUrlDark } = useTheme();
  const [erroredDarkLogo, setErroredDarkLogo] = useState<string | null>(null);
  const brandName = t("shell.brand.name", { defaultValue: productNames.liteLLM });
  const linkLabel = homeLabel ?? brandName;
  const customLogo = Boolean(logoUrl);
  const reachableDarkLogo = logoUrlDark === erroredDarkLogo ? null : logoUrlDark;
  const darkLogoSrc = reachableDarkLogo || logoUrl || bundledLogoSrc({ dark: true, monogram: collapsed });
  return (
    <SidebarHeader className="h-14 border-b border-border group-data-[collapsed=true]/sidebar:h-auto group-data-[collapsed=true]/sidebar:py-2">
      <div className="flex items-center justify-between gap-2 group-data-[collapsed=true]/sidebar:flex-col group-data-[collapsed=true]/sidebar:gap-1">
        <div className="flex min-w-0 items-center gap-2.5">
          <Link
            href={homeHref}
            onClick={onHomeClick}
            className="flex min-w-0 items-center gap-2.5"
            aria-label={brandName}
          >
            {customLogo ? (
              <>
                <img src={logoUrl ?? undefined} alt={brandName} className={cn(LOGO_CLASS_NAME, "dark:hidden")} />
                <img
                  src={darkLogoSrc}
                  alt=""
                  aria-hidden
                  onError={() => setErroredDarkLogo(logoUrlDark)}
                  className={cn(LOGO_CLASS_NAME, "hidden dark:block")}
                />
              </>
            ) : (
              <>
                <img
                  src={aiGwMonogram.src}
                  alt=""
                  aria-hidden
                  className={MONOGRAM_CLASS_NAME}
                />
                <span className="truncate text-lg font-semibold tracking-tight text-foreground group-data-[collapsed=true]/sidebar:hidden">
                  {brandName}
                </span>
              </>
            )}
          </Link>
        </div>
        {onToggleCollapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? t("shell.navbar.expandSidebar") : t("shell.navbar.collapseSidebar")}
            className="flex-none text-muted-foreground group-data-[collapsed=true]/sidebar:size-9"
          >
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        )}
      </div>
    </SidebarHeader>
  );
}
