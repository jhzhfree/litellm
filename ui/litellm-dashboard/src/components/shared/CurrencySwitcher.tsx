"use client";

import { useTranslation } from "react-i18next";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CurrencyCode } from "@/lib/currency";
import { useCurrency } from "@/lib/useCurrency";

const CURRENCIES: readonly CurrencyCode[] = ["USD", "CNY"];

/**
 * 全局「展示/输入货币」切换器（USD / CNY）。
 * 仅影响界面换算，后端始终以美元存储与校验预算。
 */
export function CurrencySwitcher({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { currency, setCurrency, rate } = useCurrency();

  const items = CURRENCIES.map((code) => ({
    value: code,
    label: t(code === "CNY" ? "shared.currency.cny" : "shared.currency.usd"),
  }));

  return (
    <Select
      items={items}
      value={currency}
      onValueChange={(next) => setCurrency(next as CurrencyCode)}
    >
      <SelectTrigger
        aria-label={t("shared.currency.label")}
        title={t("shared.currency.rateHint", { rate })}
        className={className ?? "w-36 shrink-0"}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
