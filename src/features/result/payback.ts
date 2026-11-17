// The one place that decides what a system's payback means for the reader
// (SPEC 2.3 "Honest verdicts"). The headline, the figures, the battery column,
// the warnings and the payback chart's caption all read this, so they can never
// disagree about whether a system pays back.
//
// Input: the engine's payback years at the low, typical and high installed
// cost. Each is "the first year from which the running total of savings stays
// at or above the upfront cost for the rest of the horizon", so a system that
// reaches its cost and then falls back below it after an inverter or battery
// replacement is reported at the later year (SPEC 3.2 step 7). Nothing here
// re-derives a year; it only reads the three the engine gave.
//
// The rule: payback is judged at the TYPICAL cost.

import type { MoneyResult } from "../../engine";

export type PaybackYears = MoneyResult["paybackYears"];

export type PaybackJudgment =
  /** Pays back at the typical and at the high cost: a range of years, low cost to high cost. */
  | { kind: "range"; lowYear: number; highYear: number }
  /** Pays back at the typical cost but not at the high cost: "lowYear or more". */
  | { kind: "notAtHighCost"; lowYear: number }
  /** Does not pay back at the typical cost, though the lowest installer price would. No year is a headline. */
  | { kind: "onlyAtLowCost"; lowYear: number }
  /** Does not pay back, not even at the lowest cost. */
  | { kind: "never" };

export function judgePayback(years: PaybackYears): PaybackJudgment {
  if (years.typical === null) {
    return years.low === null ? { kind: "never" } : { kind: "onlyAtLowCost", lowYear: years.low };
  }
  // The typical cost pays back. The engine's low-cost year is never later than
  // the typical one while the costs are ordered (the server checks that); the
  // typical year stands in for a missing one so a number is never invented.
  const lowYear = years.low ?? years.typical;
  if (years.high === null) return { kind: "notAtHighCost", lowYear };
  return { kind: "range", lowYear, highYear: years.high };
}

/** True when the system repays its cost within the horizon at the typical cost: the only case that may show a payback year. */
export function paysBackAtTypicalCost(judgment: PaybackJudgment): boolean {
  return judgment.kind === "range" || judgment.kind === "notAtHighCost";
}

/**
 * The years the payback chart marks with its solid column, so the picture
 * agrees with the headline: from the low-cost year to the high-cost year, or
 * to the end of the horizon when the high cost does not pay back. Nothing is
 * marked when the headline says the system does not pay back.
 */
export function markedYears(judgment: PaybackJudgment, horizon: number): { fromYear: number; toYear: number } | null {
  if (judgment.kind === "range") return { fromYear: judgment.lowYear, toYear: judgment.highYear };
  if (judgment.kind === "notAtHighCost") return { fromYear: judgment.lowYear, toYear: horizon };
  return null;
}
