import { useTranslation } from "react-i18next";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CurrencyCode } from "@/lib/currency";
import { useCurrency } from "@/lib/useCurrency";

const CONTROL_ID = "account-menu-currency";
const CURRENCIES: readonly CurrencyCode[] = ["USD", "CNY"];

/**
 * 账户菜单中的「货币单位」设置：切换后所有预算/消费金额按所选货币展示与录入。
 * 后端仍以美元（USD）存储与校验。
 */
export default function CurrencyField() {
  const { t } = useTranslation();
  const { currency, setCurrency, rate, setRate } = useCurrency();

  const items = CURRENCIES.map((code) => ({
    value: code,
    label: t(code === "CNY" ? "shared.currency.cny" : "shared.currency.usd"),
  }));

  return (
    <Field className="gap-1.5 px-3 pt-1 pb-2.5">
      <FieldLabel htmlFor={CONTROL_ID} className="text-[13px] font-normal">
        {t("shared.currency.label")}
      </FieldLabel>
      <Select items={items} value={currency} onValueChange={(next) => setCurrency(next as CurrencyCode)}>
        <SelectTrigger id={CONTROL_ID} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="start" className="w-auto min-w-(--anchor-width)">
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldDescription className="text-xs">{t("shared.currency.rateHint", { rate })}</FieldDescription>
    </Field>
  );
}
