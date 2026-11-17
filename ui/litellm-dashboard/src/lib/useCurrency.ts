"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import {
  currencySymbol,
  DEFAULT_CNY_RATE,
  DEFAULT_CURRENCY,
  formatAmount,
  formatMoney,
  readStoredCurrency,
  readStoredRate,
  roundAmount,
  subscribeCurrency,
  toDisplayAmount,
  toUsdAmount,
  writeStoredCurrency,
  writeStoredRate,
  type CurrencyCode,
} from "@/lib/currency";

export interface CurrencyHelpers {
  /** 当前展示货币 */
  currency: CurrencyCode;
  /** 1 USD = rate CNY */
  rate: number;
  symbol: string;
  setCurrency: (currency: CurrencyCode) => void;
  setRate: (rate: number) => void;
  /** USD → 展示货币 */
  toDisplay: (usd: number) => number;
  /** 展示货币 → USD（保留 6 位小数，避免换算误差累积） */
  toUsd: (amount: number) => number;
  /** 格式化带符号金额（入参为 USD） */
  format: (usd: number, decimals?: number) => string;
  /** 仅格式化数值（入参为 USD，不带符号） */
  formatValue: (usd: number, decimals?: number) => string;
}

/**
 * 读取/修改全局展示货币偏好。
 * 首屏使用默认值渲染，挂载后再同步 localStorage，避免 SSR 水合不一致。
 */
export function useCurrency(): CurrencyHelpers {
  const [currency, setCurrencyState] = useState<CurrencyCode>(DEFAULT_CURRENCY);
  const [rate, setRateState] = useState<number>(DEFAULT_CNY_RATE);

  useEffect(() => {
    const sync = () => {
      setCurrencyState(readStoredCurrency());
      setRateState(readStoredRate());
    };
    sync();
    return subscribeCurrency(sync);
  }, []);

  const setCurrency = useCallback((next: CurrencyCode) => {
    setCurrencyState(next);
    writeStoredCurrency(next);
  }, []);

  const setRate = useCallback((next: number) => {
    if (!Number.isFinite(next) || next <= 0) return;
    setRateState(next);
    writeStoredRate(next);
  }, []);

  const toDisplay = useCallback((usd: number) => toDisplayAmount(usd, currency, rate), [currency, rate]);

  const toUsd = useCallback(
    (amount: number) => roundAmount(toUsdAmount(amount, currency, rate), 6),
    [currency, rate],
  );

  const format = useCallback(
    (usd: number, decimals = 2) => formatMoney(usd, currency, rate, decimals),
    [currency, rate],
  );

  const formatValue = useCallback(
    (usd: number, decimals = 2) => formatAmount(toDisplayAmount(usd, currency, rate), decimals),
    [currency, rate],
  );

  return {
    currency,
    rate,
    symbol: currencySymbol(currency),
    setCurrency,
    setRate,
    toDisplay,
    toUsd,
    format,
    formatValue,
  };
}

/**
 * 订阅全局货币偏好变化并触发当前组件树重渲染。
 * 供布局层等容器调用，使通过纯函数格式化金额的子树在切换货币后立即刷新。
 */
export function useCurrencySync(): CurrencyCode {
  return useSyncExternalStore(subscribeCurrency, readStoredCurrency, () => DEFAULT_CURRENCY);
}
