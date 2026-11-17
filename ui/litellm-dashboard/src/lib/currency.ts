/**
 * 预算货币单位支持（USD / CNY）。
 *
 * 后端所有预算与消费金额都以美元（USD）存储和计算，这里只在「展示 / 输入」两层做换算：
 * - 读取：USD → 目标货币（乘以汇率）
 * - 提交：目标货币 → USD（除以汇率）
 *
 * 汇率默认取环境变量 NEXT_PUBLIC_CNY_RATE，可在界面中修改并保存在本地。
 */
export type CurrencyCode = "USD" | "CNY";

export const CURRENCY_STORAGE_KEY = "aigw_currency";
export const RATE_STORAGE_KEY = "aigw_usd_cny_rate";
export const CURRENCY_CHANGE_EVENT = "aigw-currency-change";

const ENV_RATE = Number(process.env.NEXT_PUBLIC_CNY_RATE);
export const DEFAULT_CNY_RATE = Number.isFinite(ENV_RATE) && ENV_RATE > 0 ? ENV_RATE : 7.2;

export const DEFAULT_CURRENCY: CurrencyCode = process.env.NEXT_PUBLIC_DEFAULT_CURRENCY === "CNY" ? "CNY" : "USD";

export const isCurrencyCode = (value: unknown): value is CurrencyCode => value === "USD" || value === "CNY";

export const currencySymbol = (currency: CurrencyCode): string => (currency === "CNY" ? "¥" : "$");

const storage = (): Storage | null => (typeof window === "undefined" ? null : window.localStorage);

const emitChange = () => {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CURRENCY_CHANGE_EVENT));
};

export const readStoredCurrency = (): CurrencyCode => {
  const raw = storage()?.getItem(CURRENCY_STORAGE_KEY);
  return isCurrencyCode(raw) ? raw : DEFAULT_CURRENCY;
};

export const writeStoredCurrency = (currency: CurrencyCode) => {
  storage()?.setItem(CURRENCY_STORAGE_KEY, currency);
  emitChange();
};

export const readStoredRate = (): number => {
  const raw = Number(storage()?.getItem(RATE_STORAGE_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_CNY_RATE;
};

export const writeStoredRate = (rate: number) => {
  if (!Number.isFinite(rate) || rate <= 0) return;
  storage()?.setItem(RATE_STORAGE_KEY, String(rate));
  emitChange();
};

export const subscribeCurrency = (callback: () => void): (() => void) => {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CURRENCY_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CURRENCY_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

export const roundAmount = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/** USD（存储值）→ 展示货币金额 */
export const toDisplayAmount = (usd: number, currency: CurrencyCode, rate: number): number =>
  currency === "USD" ? usd : usd * rate;

/** 展示货币金额 → USD（存储值） */
export const toUsdAmount = (amount: number, currency: CurrencyCode, rate: number): number =>
  currency === "USD" ? amount : amount / rate;

export const formatAmount = (value: number, decimals = 2): string =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

/** 带符号的金额文案，如 `$12.00` / `¥86.40` */
export const formatMoney = (usd: number, currency: CurrencyCode, rate: number, decimals = 2): string =>
  `${currencySymbol(currency)}${formatAmount(toDisplayAmount(usd, currency, rate), decimals)}`;

/* ---------- 非 React 上下文的便捷函数（按当前存储的货币偏好即时换算） ---------- */

/** USD → 当前展示货币数值（工具函数/导出等非组件场景用） */
export const currentDisplayAmount = (usd: number): number =>
  toDisplayAmount(usd, readStoredCurrency(), readStoredRate());

/** 按当前货币偏好格式化带符号金额（工具函数/导出等非组件场景用） */
export const currentMoney = (usd: number, decimals = 2): string =>
  formatMoney(usd, readStoredCurrency(), readStoredRate(), decimals);

/** 展示货币金额 → USD（非 React 上下文用，与 currentDisplayAmount 互逆） */
export const currentToUsd = (amount: number): number =>
  toUsdAmount(amount, readStoredCurrency(), readStoredRate());

/** 当前货币符号（`$` / `¥`） */
export const currentCurrencySymbol = (): string => currencySymbol(readStoredCurrency());

/** 单价/费率类金额（如 $/1M tokens）：按当前货币偏好换算后格式化 */
export const formatMoneyRate = (
  usd: number,
  maxFractionDigits: number,
  minFractionDigits = 2,
  useGrouping = false,
): string =>
  `${currentCurrencySymbol()}${currentDisplayAmount(usd).toLocaleString("en-US", {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: maxFractionDigits,
    useGrouping,
  })}`;
