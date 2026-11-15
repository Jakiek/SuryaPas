// What the result page needs from a saved assessment, and the few decisions
// the page makes about it. Every number here is copied from the engine's
// output (src/engine/types.ts, "Assessment"); nothing is recalculated.
//
// Why a smaller copy? The saved result also holds monthly breakdowns the page
// never shows. Sending only what is drawn keeps the page light on a phone.

import type { Assessment, Billing, CostRange, EnergyResult, MoneyResult } from "../../engine";

/** One system (with or without a battery), as the page shows it. */
export interface OptionView {
  upfrontCostRp: CostRange;
  monthlySavingsRp: number;
  paybackYears: MoneyResult["paybackYears"];
  netSavingsRp: number;
  /** Year 0 to the horizon, at the typical cost. */
  cumulativeSavingsRp: number[];
  selfConsumedShare: number;
  co2AvoidedKgPerYear: number;
  /** Yearly energy, kWh. */
  generationKwh: number;
  selfConsumedKwh: number;
  exportedKwh: number;
}

export interface CandidateView {
  panels: number;
  kwp: number;
  panelAreaM2: number;
  withoutBattery: OptionView;
  /** Null when the engine offers no battery at this size. */
  withBattery: (OptionView & { batteryKwh: number }) | null;
}

export interface ResultView {
  candidates: CandidateView[];
  /** Null when the roof is too small for the smallest system. */
  recommendedPanels: number | null;
  /** 24 values, average kWh in each hour of the day. */
  averageLoadByHourKwh: number[];
  /** 24 values, per installed kWp. */
  averageSolarByHourPerKwp: number[];
  roofTooSmall: { requiredAreaM2: number } | null;
  flags: Assessment["flags"];
}

/** What the page says about the home itself. No location: the page never shows or sends the pin. */
export interface HomeSummary {
  billing: Billing;
  connectedVa: number;
  subsidised: boolean;
  monthlySpendRp: number[];
  roofAreaM2: number;
  /** A place name, only for the example house. */
  place?: string;
}

function toOptionView(energy: EnergyResult, money: MoneyResult): OptionView {
  return {
    upfrontCostRp: money.upfrontCostRp,
    monthlySavingsRp: money.monthlySavingsRp,
    paybackYears: money.paybackYears,
    netSavingsRp: money.netSavingsRp,
    cumulativeSavingsRp: money.cumulativeSavingsRp,
    selfConsumedShare: money.selfConsumedShare,
    co2AvoidedKgPerYear: money.co2AvoidedKgPerYear,
    generationKwh: energy.generationKwh,
    selfConsumedKwh: energy.selfConsumedKwh,
    exportedKwh: energy.exportedKwh,
  };
}

export function toResultView(assessment: Assessment): ResultView {
  return {
    candidates: assessment.candidates.map((candidate) => ({
      panels: candidate.panels,
      kwp: candidate.kwp,
      panelAreaM2: candidate.panelAreaM2,
      withoutBattery: toOptionView(candidate.withoutBattery.energy, candidate.withoutBattery.money),
      withBattery:
        candidate.withBattery === null
          ? null
          : {
              ...toOptionView(candidate.withBattery.energy, candidate.withBattery.money),
              batteryKwh: candidate.withBattery.batteryKwh,
            },
    })),
    recommendedPanels: assessment.recommendedPanels,
    averageLoadByHourKwh: assessment.averageLoadByHourKwh,
    averageSolarByHourPerKwp: assessment.averageSolarByHourPerKwp,
    roofTooSmall: assessment.roofTooSmall,
    flags: assessment.flags,
  };
}

/** The analysis horizon in years, read from the engine's own series (year 0 to the horizon). */
export function horizonYears(view: ResultView): number {
  return view.candidates[0].withoutBattery.cumulativeSavingsRp.length - 1;
}

export function candidateFor(view: ResultView, panels: number): CandidateView {
  const found = view.candidates.find((candidate) => candidate.panels === panels);
  if (!found) throw new Error(`no candidate with ${panels} panels`);
  return found;
}

// ---------- The panel picker (SPEC 2.3 item 2) ----------

/** SPEC 2.3: "at most twelve shown". */
export const MAX_PICKER_PANELS = 12;

export interface PickerSlot {
  panels: number;
  /** False below the smallest system: shown, but cannot be chosen. */
  selectable: boolean;
}

/**
 * The counts the picker shows: from one up to the most the roof holds, at
 * most twelve. If the roof holds more than twelve and the recommended count
 * lies beyond twelve, the twelve slide up so the recommendation is in view
 * (SPEC is silent on this case; our reading).
 */
export function pickerSlots(view: ResultView): PickerSlot[] {
  if (view.candidates.length === 0 || view.recommendedPanels === null) return [];
  const smallest = view.candidates[0].panels;
  const largest = view.candidates[view.candidates.length - 1].panels;

  let first = 1;
  let last = Math.min(largest, MAX_PICKER_PANELS);
  if (view.recommendedPanels > last) {
    last = Math.min(largest, view.recommendedPanels + 1);
    first = last - MAX_PICKER_PANELS + 1;
  }

  const slots: PickerSlot[] = [];
  for (let panels = first; panels <= last; panels++) {
    slots.push({ panels, selectable: panels >= smallest });
  }
  return slots;
}

// ---------- Honest verdicts (SPEC 2.3 and 2.5) ----------

export type Verdict = "doesNotPayBack" | "sizeDoesNotPayBack" | "heavyShade" | "approximate";

/**
 * The warnings shown for the selected system, in the order they are shown.
 * - doesNotPayBack: the size on show does not repay its typical cost within
 *   the horizon, and neither does the recommended one: the engine's own flag
 *   (src/engine/assess.ts). At this home's tariff, solar does not pay
 *   (SPEC 2.3 "Honest verdicts").
 * - sizeDoesNotPayBack: the size on show does not pay back, but the
 *   recommended one does. The tariff is not the reason; the size is.
 * - heavyShade: an installer must visit before the estimate can be trusted.
 * - approximate: the sun data is the nearest city's bundled series (SPEC 2.5).
 * A roof too small for any system is not a verdict on a size; the page
 * replaces the whole report with it (see roofTooSmall).
 */
export function verdictsFor(view: ResultView, selected: CandidateView): Verdict[] {
  const verdicts: Verdict[] = [];
  if (selected.withoutBattery.paybackYears.typical === null) {
    verdicts.push(view.flags.doesNotPayBack ? "doesNotPayBack" : "sizeDoesNotPayBack");
  }
  if (view.flags.heavyShade) verdicts.push("heavyShade");
  if (view.flags.fallbackSunData) verdicts.push("approximate");
  return verdicts;
}

/** What the picker's line under it says about the chosen count (SPEC 2.3 item 2). */
export type Comparison = "recommended" | "fewer" | "more";

export function compareWithRecommended(view: ResultView, panels: number): Comparison {
  if (view.recommendedPanels === null || panels === view.recommendedPanels) return "recommended";
  return panels < view.recommendedPanels ? "fewer" : "more";
}
