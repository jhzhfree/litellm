"use client";

import { formatNumberWithCommas } from "@/utils/dataUtils";
import { useCurrency } from "@/lib/useCurrency";

interface MoneyCellProps {
  value: number | null | undefined;
  decimals?: number;
  emptyText?: string;
  showZero?: boolean;
}

const placeholderClassName = "block w-full whitespace-nowrap text-right tabular-nums text-muted-foreground";
const moneyClassName = "block w-full whitespace-nowrap text-right tabular-nums";

/**
 * 表格金额单元格。入参为后端存储的美元金额，按当前选择的货币（USD/CNY）换算展示。
 */
export function MoneyCell({ value, decimals = 4, emptyText = "-", showZero = false }: MoneyCellProps) {
  const { toDisplay, symbol } = useCurrency();

  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className={placeholderClassName}>{emptyText}</span>;
  }
  if (value === 0 && !showZero) {
    return <span className={placeholderClassName}>-</span>;
  }

  const displayValue = toDisplay(value);
  const halfSmallestUnit = Number(`5e-${decimals + 1}`);
  const formattedValue =
    displayValue !== 0 && Math.abs(displayValue) < halfSmallestUnit
      ? `< ${symbol}${(1 / 10 ** decimals).toFixed(decimals)}`
      : `${symbol}${formatNumberWithCommas(displayValue, decimals, false, true)}`;

  return (
    <span data-slot="money-cell" className={moneyClassName}>
      {formattedValue}
    </span>
  );
}
