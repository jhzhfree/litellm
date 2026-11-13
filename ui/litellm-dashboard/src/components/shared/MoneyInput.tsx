"use client";

import React, { useEffect, useId, useState } from "react";

import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { useCurrency } from "@/lib/useCurrency";

type NativeInputProps = Omit<React.ComponentProps<"input">, "value" | "onChange" | "type" | "step">;

export interface MoneyInputProps extends NativeInputProps {
  /** 表单中的金额，始终为 USD */
  value: number | null | undefined;
  /** 回传的金额，始终为 USD */
  onChange: (value: number | null) => void;
  step?: number;
  className?: string;
}

/**
 * 金额输入框：按当前货币单位展示与录入，内部始终以美元（USD）与表单交互。
 * 后端预算字段单位为 USD，这里只做输入层的换算。
 */
export function MoneyInput({
  value,
  onChange,
  step = 0.01,
  id,
  placeholder,
  disabled,
  className,
  ...rest
}: MoneyInputProps) {
  const { currency, symbol, toDisplay, toUsd } = useCurrency();
  const autoId = useId();
  const inputId = id ?? autoId;
  const [draft, setDraft] = useState<string | null>(null);

  // 货币切换后清空草稿，避免旧单位数值残留
  useEffect(() => {
    setDraft(null);
  }, [currency]);

  const displayValue =
    draft ??
    (typeof value === "number" && Number.isFinite(value) ? String(Math.round(toDisplay(value) * 1e6) / 1e6) : "");

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    setDraft(raw);
    if (raw === "") {
      onChange(null);
      return;
    }
    const parsed = Number(raw);
    onChange(Number.isFinite(parsed) ? toUsd(parsed) : null);
  };

  return (
    <InputGroup className={className}>
      <InputGroupAddon>
        <InputGroupText>{symbol}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        {...rest}
        id={inputId}
        type="number"
        inputMode="decimal"
        step={step}
        min={0}
        value={displayValue}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleChange}
        onWheel={(event) => event.currentTarget.blur()}
        onBlur={() => setDraft(null)}
      />
    </InputGroup>
  );
}
