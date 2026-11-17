import { currentCurrencySymbol, currentDisplayAmount } from "@/lib/currency";
import i18n from "@/i18n/i18n";

export function valueFormatter(number: number) {
  if (number >= 1_000_000_000) {
    return (number / 1_000_000_000).toFixed(2) + "B";
  }
  if (number >= 1_000_000) {
    return (number / 1_000_000).toFixed(2) + "M";
  }
  if (number >= 1000) {
    return number / 1000 + "k";
  }
  return number.toString();
}

export function averageResponseTimeMs(totalResponseTimeMs: number, timedRequests: number): number | null {
  if (timedRequests <= 0) return null;
  return totalResponseTimeMs / timedRequests;
}

export function formatResponseTime(ms: number | null | undefined) {
  if (ms == null) return "-";
  if (ms < 1000) return i18n.t("usage.valueFormatters.milliseconds", { value: Math.round(ms) });
  return i18n.t("usage.valueFormatters.seconds", { value: (ms / 1000).toFixed(2) });
}

export function valueFormatterSpend(number: number) {
  const symbol = currentCurrencySymbol();
  const value = currentDisplayAmount(number);
  if (value === 0) return `${symbol}0`;
  if (value >= 1_000_000_000) {
    return symbol + parseFloat((value / 1_000_000_000).toFixed(2)) + "B";
  }
  if (value >= 1_000_000) {
    return symbol + parseFloat((value / 1_000_000).toFixed(2)) + "M";
  }
  if (value >= 1000) {
    return symbol + value / 1000 + "k";
  }
  return symbol + value;
}
