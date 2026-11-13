"use client";

import { useTranslation } from "react-i18next";

import { InheritedBudgetHint, type InheritedBudgetGate } from "@/components/shared/InheritedBudgetHint";
import { Meter, MeterIndicator, MeterTrack } from "@/components/shared/Meter";
import i18n from "@/i18n/i18n";
import { useCurrency } from "@/lib/useCurrency";
import { formatNumberWithCommas } from "@/utils/dataUtils";

interface SpendBudgetCellProps {
  spend: number | null | undefined;
  maxBudget: number | null | undefined;
  teamMemberGate?: InheritedBudgetGate | null;
  inheritedGates?: readonly InheritedBudgetGate[];
  spendDecimals?: number;
  budgetDecimals?: number;
}

export const getSpendBudgetMeterTone = (pct: number): "default" | "warning" | "over" => {
  if (pct > 100) return "over";
  if (pct >= 80) return "warning";
  return "default";
};

const getBudgetLabel = (budgetText: string | null, usesTeamMemberBudget: boolean, memberSpendText: string): string => {
  if (budgetText === null) return i18n.t("shared.tableCells.spendBudgetCell.unlimited");
  if (usesTeamMemberBudget)
    return i18n.t("shared.tableCells.spendBudgetCell.memberBudget", {
      spend: memberSpendText,
      budget: budgetText,
    });
  return i18n.t("shared.tableCells.spendBudgetCell.ofBudget", { budget: budgetText });
};

const getMeterValueText = (hasBudget: boolean, budgetText: string | null, meterSpendText: string): string => {
  if (!hasBudget || budgetText === null) return "";
  return i18n.t("shared.tableCells.spendBudgetCell.meterValue", { spend: meterSpendText, budget: budgetText });
};

export function SpendBudgetCell({
  spend,
  maxBudget,
  teamMemberGate = null,
  inheritedGates = [],
  spendDecimals = 4,
  budgetDecimals = 0,
}: SpendBudgetCellProps) {
  const { t } = useTranslation();
  const { toDisplay, symbol } = useCurrency();

  const formatUsd = (usd: number, decimals: number) =>
    `${symbol}${formatNumberWithCommas(toDisplay(usd), decimals, false, true)}`;

  const spendValue = typeof spend === "number" && !Number.isNaN(spend) ? spend : 0;
  const ownBudget = maxBudget ?? null;
  const budget = ownBudget ?? teamMemberGate?.maxBudget ?? null;
  const usesTeamMemberBudget = ownBudget === null && teamMemberGate !== null;
  const memberSpendValue =
    typeof teamMemberGate?.spend === "number" && !Number.isNaN(teamMemberGate.spend) ? teamMemberGate.spend : 0;
  const meterSpendValue = usesTeamMemberBudget ? memberSpendValue : spendValue;
  const hasBudget = typeof budget === "number" && budget > 0;
  const pct = hasBudget ? (meterSpendValue / budget) * 100 : 0;

  // 与前端约定保持一致：无消费时固定展示两位小数的 0，而不是连字符
  const spendText = spendValue > 0 ? formatUsd(spendValue, spendDecimals) : formatUsd(0, 2);
  const memberSpendText = memberSpendValue > 0 ? formatUsd(memberSpendValue, spendDecimals) : formatUsd(0, 2);
  const budgetText = budget === null ? null : formatUsd(budget, budgetDecimals);
  const budgetLabel = getBudgetLabel(budgetText, usesTeamMemberBudget, memberSpendText);
  const meterSpendText = usesTeamMemberBudget
    ? t("shared.tableCells.spendBudgetCell.memberSpend", { spend: memberSpendText })
    : spendText;
  const meterValueText = getMeterValueText(hasBudget, budgetText, meterSpendText);

  return (
    <div className="flex min-w-[130px] flex-col gap-1">
      <div className="whitespace-nowrap text-xs">
        <span className="font-medium tabular-nums text-foreground">{spendText}</span>{" "}
        <span className="text-muted-foreground">{budgetLabel}</span>
        {ownBudget === null && <InheritedBudgetHint gates={inheritedGates} />}
      </div>
      {hasBudget && (
        <Meter value={meterSpendValue} max={budget} aria-valuetext={meterValueText}>
          <MeterTrack>
            <MeterIndicator tone={getSpendBudgetMeterTone(pct)} />
          </MeterTrack>
        </Meter>
      )}
    </div>
  );
}
