import { describe, expect, it } from "vitest";

import {
  currencySymbol,
  formatAmount,
  formatMoney,
  isCurrencyCode,
  roundAmount,
  toDisplayAmount,
  toUsdAmount,
} from "./currency";

describe("currency helpers", () => {
  it("recognises supported currencies only", () => {
    expect(isCurrencyCode("USD")).toBe(true);
    expect(isCurrencyCode("CNY")).toBe(true);
    expect(isCurrencyCode("EUR")).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
  });

  it("uses the conventional symbols", () => {
    expect(currencySymbol("USD")).toBe("$");
    expect(currencySymbol("CNY")).toBe("¥");
  });

  it("keeps USD amounts untouched and converts CNY with the configured rate", () => {
    expect(toDisplayAmount(10, "USD", 7.2)).toBe(10);
    expect(toDisplayAmount(10, "CNY", 7.2)).toBe(72);
    expect(toUsdAmount(72, "CNY", 7.2)).toBe(10);
    expect(toUsdAmount(10, "USD", 7.2)).toBe(10);
  });

  it("round-trips between display and stored amounts", () => {
    const usd = toUsdAmount(100, "CNY", 7.3);
    expect(toDisplayAmount(usd, "CNY", 7.3)).toBeCloseTo(100, 6);
  });

  it("formats money with the active currency symbol", () => {
    expect(formatMoney(12.5, "USD", 7.2)).toBe("$12.50");
    expect(formatMoney(12.5, "CNY", 7.2)).toBe("¥90.00");
  });

  it("formats large amounts with thousands separators", () => {
    expect(formatAmount(12345.678, 2)).toBe("12,345.68");
  });

  it("rounds to the requested precision", () => {
    expect(roundAmount(1.23456, 2)).toBe(1.23);
    expect(roundAmount(1.23456, 6)).toBe(1.23456);
  });
});
