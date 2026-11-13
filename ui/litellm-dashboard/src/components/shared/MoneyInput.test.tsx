import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MoneyInput } from "./MoneyInput";
import { CURRENCY_STORAGE_KEY, RATE_STORAGE_KEY } from "@/lib/currency";

describe("MoneyInput", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("shows USD values with a dollar prefix by default", () => {
    render(<MoneyInput value={12.5} onChange={vi.fn()} aria-label="budget" />);

    expect(screen.getByText("$")).toBeInTheDocument();
    expect(screen.getByLabelText("budget")).toHaveValue(12.5);
  });

  it("converts typed CNY into the USD value handed to the form", () => {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, "CNY");
    window.localStorage.setItem(RATE_STORAGE_KEY, "7.2");
    const onChange = vi.fn();
    render(<MoneyInput value={null} onChange={onChange} aria-label="budget" />);

    fireEvent.change(screen.getByLabelText("budget"), { target: { value: "100" } });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toBeCloseTo(100 / 7.2, 6);
  });

  it("renders stored USD amounts in the selected currency", async () => {
    window.localStorage.setItem(CURRENCY_STORAGE_KEY, "CNY");
    window.localStorage.setItem(RATE_STORAGE_KEY, "7.2");
    render(<MoneyInput value={10} onChange={vi.fn()} aria-label="budget" />);

    await screen.findByText("¥");
    expect(screen.getByLabelText("budget")).toHaveValue(72);
  });
});
