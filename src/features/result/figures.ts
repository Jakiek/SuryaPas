// How each engine number on the result page is written. Every function takes
// a value exactly as the engine gave it and only formats it, through the
// helpers in src/lib/format (docs/DESIGN.md "Number formats"). Changing a
// rounding here changes what the page shows, so each rule is stated.

import {
  formatDecimal,
  formatMoneyRange,
  formatMoneyRounded,
  formatYearsRange,
  type Formatted,
} from "../../lib/format";
import type { OptionView } from "./view";

// Unit conversions only.
const KG_PER_TONNE = 1000;
const DAYS_PER_YEAR = 365; // the engine's year is 8,760 hours
const PERCENT = 100;

/** Upfront cost, low to high, in whole millions: "Rp18–33 juta". */
export function costRangeFigure(cost: OptionView["upfrontCostRp"], locale: string): Formatted {
  return formatMoneyRange(cost.low, cost.high, locale);
}

/**
 * A money amount in words of scale. One decimal between one and ten million
 * ("Rp6,5 juta"), where a whole number would round away a large share of the
 * amount; whole numbers otherwise ("Rp231 ribu", "Rp23 juta"). The mock's rule.
 */
export function roundedMoneyFigure(amount: number, locale: string): Formatted {
  const size = Math.abs(amount);
  const decimals = size >= 1_000_000 && size < 10_000_000 ? 1 : 0;
  return formatMoneyRounded(amount, locale, decimals);
}

/**
 * Payback, as the engine reports it at the low and high cost.
 * - "range": both ends pay back: "9–20 tahun" (one value when equal).
 * - "atLeast": only the low cost pays back within the horizon: "13" + "+".
 * - "never": not even the low cost does. The page writes words, not a number.
 */
export type PaybackFigure =
  | { kind: "range"; value: Formatted }
  | { kind: "atLeast"; value: Formatted }
  | { kind: "never" };

export function paybackFigure(payback: OptionView["paybackYears"], locale: string): PaybackFigure {
  if (payback.low === null) return { kind: "never" };
  if (payback.high === null) return { kind: "atLeast", value: formatYearsRange(payback.low, payback.low, locale) };
  return { kind: "range", value: formatYearsRange(payback.low, payback.high, locale) };
}

/** A share, 0 to 1, as a whole percent: 0.749 → "75" + "%". */
export function percentFigure(share: number, locale: string): Formatted {
  const parts = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).formatToParts(share);
  const figure = parts
    .filter((part) => part.type !== "percentSign" && part.type !== "literal")
    .map((part) => part.value)
    .join("");
  const unit = parts.find((part) => part.type === "percentSign")?.value ?? "%";
  return { figure, unit, text: `${figure}${unit}` };
}

/** The share of output that goes to the grid unpaid, as a whole percent number: "25". */
export function wastedPercentText(option: OptionView, locale: string): string {
  return formatDecimal((1 - option.selfConsumedShare) * PERCENT, locale, 0);
}

/** CO₂ avoided, in tonnes a year, always with one decimal: "1,1" / "1.1" (docs/DESIGN.md, T08 review). */
export function co2TonnesText(kgPerYear: number, locale: string): string {
  return formatDecimal(kgPerYear / KG_PER_TONNE, locale, 1, 1);
}

/** A yearly energy figure as an average day, one decimal: 1 460 kWh a year → "4" (id "4", en "4"). */
export function kwhPerDayText(kwhPerYear: number, locale: string): string {
  return formatDecimal(kwhPerYear / DAYS_PER_YEAR, locale, 1);
}

/** System size: "1,65" kWp. */
export function kwpText(kwp: number, locale: string): string {
  return formatDecimal(kwp, locale, 2);
}

/** Roof area covered, rounded to whole square metres, shown after "about": "8". */
export function areaText(areaM2: number, locale: string): string {
  return formatDecimal(areaM2, locale, 0);
}
