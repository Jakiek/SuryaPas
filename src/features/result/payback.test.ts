import { describe, expect, it } from "vitest";
import { paybackYearOf } from "../../engine";
import { judgePayback, markedYears, paysBackAtTypicalCost } from "./payback";

describe("judgePayback", () => {
  it("pays back: a range from the low-cost year to the high-cost year", () => {
    const judgment = judgePayback({ low: 9, typical: 15, high: 20 });
    expect(judgment).toEqual({ kind: "range", lowYear: 9, highYear: 20 });
    expect(paysBackAtTypicalCost(judgment)).toBe(true);
  });

  it("pays back at the typical cost but not at the high cost: the low year, open-ended", () => {
    const judgment = judgePayback({ low: 13, typical: 20, high: null });
    expect(judgment).toEqual({ kind: "notAtHighCost", lowYear: 13 });
    expect(paysBackAtTypicalCost(judgment)).toBe(true);
  });

  it("pays back only at the low cost: it does not pay back, and no year is the headline", () => {
    const judgment = judgePayback({ low: 22, typical: null, high: null });
    expect(judgment).toEqual({ kind: "onlyAtLowCost", lowYear: 22 });
    expect(paysBackAtTypicalCost(judgment)).toBe(false);
  });

  it("does not pay back at the typical cost, nor at any cost", () => {
    const judgment = judgePayback({ low: null, typical: null, high: null });
    expect(judgment).toEqual({ kind: "never" });
    expect(paysBackAtTypicalCost(judgment)).toBe(false);
  });

  it("reads the year the engine reports after a dip, not the first time the total touches the cost", () => {
    // The running total reaches the cost of 100 in year 11, falls back below it
    // in year 12 (the inverter is replaced), and is above it again from year 14.
    // paybackYearOf is the engine's rule: the first year it STAYS repaid.
    const cumulative = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 105, 90, 98, 106, 115, 125];
    expect(cumulative.findIndex((total) => total >= 100)).toBe(11);
    const typicalYear = paybackYearOf(cumulative, 100);
    expect(typicalYear).toBe(14);

    const judgment = judgePayback({ low: 12, typical: typicalYear, high: null });
    expect(judgment).toEqual({ kind: "notAtHighCost", lowYear: 12 });
    expect(paysBackAtTypicalCost(judgment)).toBe(true);
  });

  it("does not turn a dip that never recovers into a payback year", () => {
    const cumulative = [0, 20, 40, 60, 80, 105, 90, 92, 94];
    expect(paybackYearOf(cumulative, 100)).toBeNull();
    expect(judgePayback({ low: null, typical: paybackYearOf(cumulative, 100), high: null })).toEqual({ kind: "never" });
  });

  it("never invents a low-cost year from a missing one", () => {
    expect(judgePayback({ low: null, typical: 16, high: 24 })).toEqual({ kind: "range", lowYear: 16, highYear: 24 });
  });
});

describe("markedYears", () => {
  it("marks the years the headline gives, and nothing when the headline says it does not pay back", () => {
    expect(markedYears(judgePayback({ low: 9, typical: 15, high: 20 }), 25)).toEqual({ fromYear: 9, toYear: 20 });
    expect(markedYears(judgePayback({ low: 13, typical: 20, high: null }), 25)).toEqual({ fromYear: 13, toYear: 25 });
    expect(markedYears(judgePayback({ low: 22, typical: null, high: null }), 25)).toBeNull();
    expect(markedYears(judgePayback({ low: null, typical: null, high: null }), 25)).toBeNull();
  });
});
