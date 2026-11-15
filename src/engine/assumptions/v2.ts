// Assumption set, version 2. Version 1 with the two results of the PVGIS check (T07):
// the performance ratio and the orientation table. Every other entry is version 1's, unchanged.
// The check, its numbers and its limits are in docs/VALIDATION.md; it reruns with scripts/validate-pvgis.mjs.
// Never edit a released version (SPEC 4.2); a further change is version 3.

import type { AssumptionSet } from "./types";
import { ASSUMPTIONS_V1 } from "./v1";

const DATE = "2026-11-15";
const VALIDATION = "See docs/VALIDATION.md";

export const ASSUMPTIONS_V2: AssumptionSet = {
  ...ASSUMPTIONS_V1,
  version: "2",

  entries: {
    ...ASSUMPTIONS_V1.entries,

    // PVGIS's own yield ÷ irradiation on a flat roof, with its default 14% system loss, at
    // Medan, Yogyakarta and Makassar: 0.747, 0.754 and 0.743; the mean, 0.748, rounded.
    // Version 1 had 0.78, a judgment that left out about 11% of heat loss in this climate.
    "pv.performanceRatio": {
      value: 0.75,
      unit: "share",
      label: "thin",
      source: "PVGIS 5.3 (PVGIS-ERA5) losses at three Indonesian cities. " + VALIDATION,
      url: "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc",
      date: DATE,
      adjustable: false,
    },
  },

  // PVGIS yield on a tilted roof ÷ yield on a flat roof, at Medan (north of the equator) and
  // Yogyakarta (south of it), averaged over the two sites, and over east and west.
  // Gentle is taken as 25° and steep as 45°: a choice recorded in SPEC.
  orientation: {
    note: {
      label: "sourced",
      source: "PVGIS 5.3 (PVGIS-ERA5) runs at Medan and Yogyakarta; gentle 25°, steep 45°. " + VALIDATION,
      url: "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc",
      date: DATE,
    },
    table: {
      gentle: { towardEquator: 0.97, eastWest: 0.95, awayFromEquator: 0.9 },
      steep: { towardEquator: 0.85, eastWest: 0.84, awayFromEquator: 0.72 },
    },
  },
};
