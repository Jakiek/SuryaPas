// The energy half of the engine: steps 1 to 6 of SPEC 3.2, run in order.

import { valueOf } from "../assumptions";
import type { AssumptionSet } from "../assumptions";
import type { EnergyAssessment, EnergyCandidate, EngineInputs, SunSeries } from "../types";
import { kwpOfPanels, listCandidateSizes } from "./candidates";
import { buildHourlyLoad, daytimeShare } from "./loadProfile";
import { monthlyEnergyKwh } from "./monthlyEnergy";
import { averageByHourOfDay, chooseBatterySizeKwh, simulateWithBattery, simulateWithoutBattery } from "./simulate";
import { solarPerKwp } from "./solar";

export * from "./candidates";
export * from "./loadProfile";
export * from "./monthlyEnergy";
export * from "./simulate";
export * from "./solar";

/**
 * Works out the year's energy flows for every system size the roof can hold,
 * with and without a battery. No money yet: that is the next stage.
 */
export function simulateEnergy(inputs: EngineInputs, sun: SunSeries, assumptions: AssumptionSet): EnergyAssessment {
  // Step 1: how much energy the home uses each month.
  const monthlyLoadKwh = monthlyEnergyKwh(inputs.electricity, assumptions);

  // Step 2: when it uses it.
  const load = buildHourlyLoad(monthlyLoadKwh, inputs.lifestyle, assumptions);

  // Step 3: what one kWp produces on this roof.
  const perKwp = solarPerKwp(sun.ghiWm2, inputs.roof, inputs.location.latitude, assumptions);

  // Step 4: which sizes fit.
  const sizes = listCandidateSizes(inputs.roof, assumptions);

  // Steps 5 and 6: simulate each size, without and with a battery.
  const candidates: EnergyCandidate[] = sizes.panelCounts.map((panels) => {
    const kwp = kwpOfPanels(panels, assumptions);
    const batteryKwh = chooseBatterySizeKwh(perKwp, load, kwp, assumptions);
    return {
      panels,
      kwp,
      panelAreaM2: panels * valueOf(assumptions, "panel.areaM2"),
      withoutBattery: simulateWithoutBattery(perKwp, load, kwp),
      withBattery:
        batteryKwh === null ? null : { batteryKwh, energy: simulateWithBattery(perKwp, load, kwp, batteryKwh, assumptions) },
    };
  });

  return {
    monthlyLoadKwh,
    daytimeShare: {
      weekday: daytimeShare(inputs.lifestyle, assumptions, false),
      weekend: daytimeShare(inputs.lifestyle, assumptions, true),
    },
    averageLoadByHourKwh: averageByHourOfDay(load),
    averageSolarByHourPerKwp: averageByHourOfDay(perKwp),
    yearlyYieldPerKwp: perKwp.reduce((sum, kwh) => sum + kwh, 0),
    candidates,
    roofTooSmall: candidates.length === 0 ? { requiredAreaM2: sizes.requiredAreaM2 } : null,
    flags: {
      fallbackSunData: sun.source === "fallback",
      heavyShade: inputs.roof.shade === "heavy",
    },
  };
}
