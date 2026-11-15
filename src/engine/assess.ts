// The engine's front door: inputs, a year of sun and an assumption set in; the full assessment out.

import type { AssumptionSet } from "./assumptions";
import { simulateEnergy } from "./energy";
import { assessMoney, minimumChargeRp } from "./money";
import type { Assessment, Candidate, EngineInputs, SunSeries } from "./types";

/** Stored with every saved result, so an old result can be traced to the code that made it. */
export const ENGINE_VERSION = "1.0.0";

/**
 * Step 8 (SPEC 3.2): recommend the size with the highest net savings at the typical cost, without a battery.
 * "Shortest payback" would always pick the smallest system, and "cover the whole bill"
 * is the oversizing mistake this product exists to prevent.
 * When two sizes tie, the smaller wins: it costs less for the same result.
 */
export function recommend(candidates: Candidate[]): Candidate | null {
  let best: Candidate | null = null;
  for (const candidate of candidates) {
    if (best === null || candidate.withoutBattery.money.netSavingsRp > best.withoutBattery.money.netSavingsRp) {
      best = candidate;
    }
  }
  return best;
}

export function assess(inputs: EngineInputs, sun: SunSeries, assumptions: AssumptionSet): Assessment {
  const energy = simulateEnergy(inputs, sun, assumptions);
  const money = (result: Parameters<typeof assessMoney>[0], kwp: number, batteryKwh: number | null) =>
    assessMoney(result, kwp, batteryKwh, energy.monthlyLoadKwh, inputs.electricity, assumptions);

  const candidates: Candidate[] = energy.candidates.map((candidate) => ({
    panels: candidate.panels,
    kwp: candidate.kwp,
    panelAreaM2: candidate.panelAreaM2,
    withoutBattery: { energy: candidate.withoutBattery, money: money(candidate.withoutBattery, candidate.kwp, null) },
    withBattery:
      candidate.withBattery === null
        ? null
        : {
            batteryKwh: candidate.withBattery.batteryKwh,
            energy: candidate.withBattery.energy,
            money: money(candidate.withBattery.energy, candidate.kwp, candidate.withBattery.batteryKwh),
          },
  }));

  const recommended = recommend(candidates);

  return {
    engineVersion: ENGINE_VERSION,
    assumptionSetVersion: assumptions.version,
    monthlyLoadKwh: energy.monthlyLoadKwh,
    daytimeShare: energy.daytimeShare,
    averageLoadByHourKwh: energy.averageLoadByHourKwh,
    averageSolarByHourPerKwp: energy.averageSolarByHourPerKwp,
    yearlyYieldPerKwp: energy.yearlyYieldPerKwp,
    minimumChargeRp: minimumChargeRp(inputs.electricity, assumptions),
    candidates,
    recommendedPanels: recommended === null ? null : recommended.panels,
    roofTooSmall: energy.roofTooSmall,
    flags: {
      ...energy.flags,
      doesNotPayBack: recommended !== null && recommended.withoutBattery.money.paybackYears.typical === null,
    },
  };
}
