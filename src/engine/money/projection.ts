// Step 7 of the pipeline, second part (SPEC 3.2): follow the money year by year.

import { valueOf } from "../assumptions";
import type { AssumptionSet } from "../assumptions";
import type { CostRange } from "../types";

export interface ProjectionInput {
  /** What the system saves in its first year, in rupiah. */
  firstYearSavingsRp: number;
  /** Installed cost of the panels and inverter, without any battery. */
  solarCostRp: number;
  /** Battery size in kWh, or null for none. */
  batteryKwh: number | null;
}

export interface Projection {
  upfrontCostRp: number;
  /** Running total of savings less running costs, year 0 to the horizon. */
  cumulativeSavingsRp: number[];
  /** The year savings have repaid the upfront cost for good, or null if they never do. */
  paybackYear: number | null;
  /** Savings minus every cost over the horizon. */
  netSavingsRp: number;
}

/** What a battery of a given size costs: a fixed part for the hybrid inverter plus a part per kWh. */
export function batteryCostRp(batteryKwh: number, assumptions: AssumptionSet): number {
  return valueOf(assumptions, "battery.fixedCost") + batteryKwh * valueOf(assumptions, "battery.costPerKwh");
}

/** Installed cost of the panels and inverter at the low, typical and high price per kWp. */
export function solarCostRange(kwp: number, assumptions: AssumptionSet): CostRange {
  return {
    low: kwp * valueOf(assumptions, "capex.perKwp.low"),
    typical: kwp * valueOf(assumptions, "capex.perKwp.typical"),
    high: kwp * valueOf(assumptions, "capex.perKwp.high"),
  };
}

/**
 * The first year in which the running total reaches the upfront cost and never drops below it again.
 * "Never again" matters because a replacement inverter or battery can pull the total back down.
 */
export function paybackYearOf(cumulativeSavingsRp: number[], upfrontCostRp: number): number | null {
  for (let year = 1; year < cumulativeSavingsRp.length; year++) {
    const staysRepaid = cumulativeSavingsRp.slice(year).every((total) => total >= upfrontCostRp);
    if (staysRepaid) return year;
  }
  return null;
}

/**
 * Projects one system over the analysis horizon.
 *
 * In year y (counting from 1):
 *   savings   = first-year savings × (1 − degradation)^(y−1) × (1 + tariff rise)^(y−1)
 *   upkeep    = a yearly share of the solar cost
 *   inverter  = a share of the solar cost, once, in the inverter's replacement year
 *   battery   = the battery's per-kWh cost again, once, in the battery's replacement year
 *
 * Scaling savings by the panels' fading output is a simplification: a little of the lost output
 * would have been surplus anyway, so real savings fade slightly more slowly than this.
 * There is no discounting; payback is a plain count of years.
 */
export function projectMoney(input: ProjectionInput, assumptions: AssumptionSet): Projection {
  const horizon = valueOf(assumptions, "finance.horizonYears");
  const keepsOutput = 1 - valueOf(assumptions, "pv.degradationPerYear");
  const tariffGrowth = 1 + valueOf(assumptions, "finance.tariffEscalationPerYear");
  const yearlyUpkeep = input.solarCostRp * valueOf(assumptions, "opex.yearlyShareOfCapex");
  const inverterCost = input.solarCostRp * valueOf(assumptions, "inverter.replacementShareOfCapex");

  const hasBattery = input.batteryKwh !== null;
  const batteryUpfront = hasBattery ? batteryCostRp(input.batteryKwh as number, assumptions) : 0;
  const batteryReplacement = hasBattery ? (input.batteryKwh as number) * valueOf(assumptions, "battery.costPerKwh") : 0;

  const cumulativeSavingsRp = [0];
  let total = 0;
  for (let year = 1; year <= horizon; year++) {
    const yearsOfWear = year - 1;
    total += input.firstYearSavingsRp * Math.pow(keepsOutput, yearsOfWear) * Math.pow(tariffGrowth, yearsOfWear);
    total -= yearlyUpkeep;
    if (year === valueOf(assumptions, "inverter.replacementYear")) total -= inverterCost;
    if (hasBattery && year === valueOf(assumptions, "battery.replacementYear")) total -= batteryReplacement;
    cumulativeSavingsRp.push(total);
  }

  const upfrontCostRp = input.solarCostRp + batteryUpfront;
  return {
    upfrontCostRp,
    cumulativeSavingsRp,
    paybackYear: paybackYearOf(cumulativeSavingsRp, upfrontCostRp),
    netSavingsRp: total - upfrontCostRp,
  };
}
