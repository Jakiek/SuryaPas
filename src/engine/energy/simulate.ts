// Steps 5 and 6 of the pipeline (SPEC 3.2): play a year hour by hour.
//
// In each hour the panels produce some energy and the home uses some.
// Solar that meets the home's use at that moment is "self-consumed" and saves money.
// Solar beyond it is surplus: without a battery it flows to the grid and earns nothing.

import { valueOf } from "../assumptions";
import type { AssumptionSet } from "../assumptions";
import { HOURS_PER_DAY, emptyMonthly, hourOfDay, isDaytimeHour, monthOfHour } from "../calendar";
import type { EnergyResult } from "../types";

function emptyResult(): EnergyResult {
  return {
    generationKwh: 0,
    selfConsumedKwh: 0,
    exportedKwh: 0,
    gridImportKwh: 0,
    batteryLossKwh: 0,
    batteryEndKwh: 0,
    monthly: {
      generationKwh: emptyMonthly(),
      selfConsumedKwh: emptyMonthly(),
      exportedKwh: emptyMonthly(),
      gridImportKwh: emptyMonthly(),
    },
  };
}

/** Adds one hour's flows to the yearly and monthly totals. */
function record(result: EnergyResult, hour: number, solar: number, selfConsumed: number, exported: number, gridImport: number): void {
  const month = monthOfHour(hour);
  result.generationKwh += solar;
  result.selfConsumedKwh += selfConsumed;
  result.exportedKwh += exported;
  result.gridImportKwh += gridImport;
  result.monthly.generationKwh[month] += solar;
  result.monthly.selfConsumedKwh[month] += selfConsumed;
  result.monthly.exportedKwh[month] += exported;
  result.monthly.gridImportKwh[month] += gridImport;
}

function requireSameLength(solarPerKwp: number[], load: number[]): void {
  if (solarPerKwp.length !== load.length) {
    throw new Error("Solar and load series must cover the same hours.");
  }
}

/**
 * A system with no battery.
 *
 *   self-consumed = the smaller of solar and load
 *   exported      = solar − self-consumed
 *   grid import   = load − self-consumed
 */
export function simulateWithoutBattery(solarPerKwp: number[], load: number[], kwp: number): EnergyResult {
  requireSameLength(solarPerKwp, load);
  const result = emptyResult();

  for (let hour = 0; hour < load.length; hour++) {
    const solar = solarPerKwp[hour] * kwp;
    const selfConsumed = Math.min(solar, load[hour]);
    record(result, hour, solar, selfConsumed, solar - selfConsumed, load[hour] - selfConsumed);
  }
  return result;
}

/**
 * A system with a battery. Surplus solar charges the battery; the battery then serves the home
 * before the grid does. Some energy is lost on the way in (round-trip efficiency), and only part
 * of the battery's nameplate size may be used (usable fraction). The battery starts the year empty.
 */
export function simulateWithBattery(
  solarPerKwp: number[],
  load: number[],
  kwp: number,
  batteryKwh: number,
  assumptions: AssumptionSet,
): EnergyResult {
  requireSameLength(solarPerKwp, load);
  const efficiency = valueOf(assumptions, "battery.roundTripEfficiency");
  const capacity = batteryKwh * valueOf(assumptions, "battery.usableFraction");
  const result = emptyResult();
  let stored = 0;

  for (let hour = 0; hour < load.length; hour++) {
    const solar = solarPerKwp[hour] * kwp;
    const direct = Math.min(solar, load[hour]);
    const surplus = solar - direct;
    const shortfall = load[hour] - direct;

    // Charge with surplus. Taking `charged` kWh from the panels puts `charged × efficiency` into the battery.
    const charged = Math.min(surplus, (capacity - stored) / efficiency);
    stored += charged * efficiency;
    result.batteryLossKwh += charged * (1 - efficiency);

    // Discharge to cover what the panels could not.
    const discharged = Math.min(shortfall, stored);
    stored -= discharged;

    record(result, hour, solar, direct + discharged, surplus - charged, shortfall - discharged);
  }
  result.batteryEndKwh = stored;
  return result;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Picks the battery size for a system, or null when a battery would sit mostly empty.
 *
 * A battery is useful up to the smaller of two amounts: the surplus a typical day produces,
 * and the energy the home uses on a typical night. "Typical" is the median day.
 * The engine offers the product size whose usable capacity is closest to that amount,
 * and offers none when the amount would fill less than a set share of the smallest battery.
 */
export function chooseBatterySizeKwh(solarPerKwp: number[], load: number[], kwp: number, assumptions: AssumptionSet): number | null {
  requireSameLength(solarPerKwp, load);
  const days = Math.floor(load.length / HOURS_PER_DAY);
  const dailySurplus: number[] = [];
  const dailyNightUse: number[] = [];

  for (let day = 0; day < days; day++) {
    let surplus = 0;
    let nightUse = 0;
    for (let h = 0; h < HOURS_PER_DAY; h++) {
      const hour = day * HOURS_PER_DAY + h;
      surplus += Math.max(0, solarPerKwp[hour] * kwp - load[hour]);
      if (!isDaytimeHour(hourOfDay(hour))) nightUse += load[hour];
    }
    dailySurplus.push(surplus);
    dailyNightUse.push(nightUse);
  }

  const usefulKwh = Math.min(median(dailySurplus), median(dailyNightUse));
  const usableFraction = valueOf(assumptions, "battery.usableFraction");
  const sizes = assumptions.batterySizesKwh.sizes;
  if (sizes.length === 0) return null;

  const smallestUsable = sizes[0] * usableFraction;
  if (usefulKwh < smallestUsable * valueOf(assumptions, "battery.minFillShare")) {
    return null;
  }

  let best = sizes[0];
  for (const size of sizes) {
    const gap = Math.abs(size * usableFraction - usefulKwh);
    const bestGap = Math.abs(best * usableFraction - usefulKwh);
    if (gap < bestGap) best = size;
  }
  return best;
}

/** The average of a series in each hour of the day. 24 values. */
export function averageByHourOfDay(series: number[]): number[] {
  const sums = Array<number>(HOURS_PER_DAY).fill(0);
  const counts = Array<number>(HOURS_PER_DAY).fill(0);
  for (let hour = 0; hour < series.length; hour++) {
    sums[hourOfDay(hour)] += series[hour];
    counts[hourOfDay(hour)] += 1;
  }
  return sums.map((sum, h) => (counts[h] === 0 ? 0 : sum / counts[h]));
}
