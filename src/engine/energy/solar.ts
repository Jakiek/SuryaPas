// Step 3 of the pipeline (SPEC 3.2): from sunlight to the output of one installed kWp.

import { valueOf } from "../assumptions";
import type { AssumptionSet } from "../assumptions";
import { HOURS_PER_YEAR } from "../calendar";
import type { RoofInput, Shade } from "../types";

/** Panels are rated at this irradiance: 1 kWp produces 1 kW under 1,000 W/m². */
const RATING_IRRADIANCE_WM2 = 1000;

/**
 * Multiplier for the roof's slope and direction, relative to a flat roof.
 * What matters is the direction relative to the equator: south of it (Java, Bali) a north face
 * looks toward the sun's path, and north of it (Medan, Manado) a south face does.
 */
export function orientationFactor(roof: RoofInput, latitude: number, assumptions: AssumptionSet): number {
  if (roof.slope === "flat") return 1;

  const factors = assumptions.orientation.table[roof.slope];
  const equatorFacing = latitude < 0 ? "N" : "S";
  const poleFacing = latitude < 0 ? "S" : "N";

  if (roof.facing === equatorFacing) return factors.towardEquator;
  if (roof.facing === poleFacing) return factors.awayFromEquator;
  // East, west, or a sloped roof with no direction given.
  return factors.eastWest;
}

export function shadeFactor(shade: Shade, assumptions: AssumptionSet): number {
  if (shade === "some") return valueOf(assumptions, "shade.some");
  if (shade === "heavy") return valueOf(assumptions, "shade.heavy");
  return valueOf(assumptions, "shade.none");
}

/**
 * Output of one kWp in every hour of the year, in kWh. 8,760 values.
 *
 *   kWh per kWp = irradiance ÷ 1,000 × performance ratio × orientation factor × shade factor
 *
 * The performance ratio covers everything lost between sunlight and the socket:
 * heat, the inverter, wiring and dust.
 */
export function solarPerKwp(ghiWm2: number[], roof: RoofInput, latitude: number, assumptions: AssumptionSet): number[] {
  if (ghiWm2.length !== HOURS_PER_YEAR) {
    throw new Error(`Sun data needs ${HOURS_PER_YEAR} hourly values, got ${ghiWm2.length}.`);
  }
  const factor =
    valueOf(assumptions, "pv.performanceRatio") *
    orientationFactor(roof, latitude, assumptions) *
    shadeFactor(roof.shade, assumptions);

  return ghiWm2.map((irradiance) => (Math.max(0, irradiance) / RATING_IRRADIANCE_WM2) * factor);
}
