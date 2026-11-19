// The reserved result id "example" (SPEC 5.1): a 2,200 VA postpaid home in
// Yogyakarta, computed on request from data/example-house.json and the
// bundled Yogyakarta sun series. It is never stored, and it reads nothing
// from the network or the database, so it works offline and with no account.
import house from "../../../data/example-house.json";
import { assess, CURRENT_ASSUMPTIONS, type Assessment, type EngineInputs } from "../../engine";
import { loadFallbackFile } from "../../lib/sun/fallback";

export const EXAMPLE_ID = "example";

export const EXAMPLE_INPUTS = house.inputs as EngineInputs;
export const EXAMPLE_PLACE = house.place;

/**
 * The example's sun is labelled "live", not "fallback". The bundled
 * Yogyakarta file is NASA POWER's series for the example house's own 0.5°
 * cell (-7.75, 110.25), the same data a live fetch for this pin returns; it
 * is not the nearest city standing in for somewhere else, which is what
 * "fallback" and the "approximate" label mean (SPEC 2.5). This label is our
 * reading of SPEC 2.5, not a rule it states.
 */
export async function assessExampleHouse(): Promise<Assessment> {
  const sun = await loadFallbackFile("yogyakarta");
  return assess(EXAMPLE_INPUTS, { ghiWm2: sun.series, source: "live" }, CURRENT_ASSUMPTIONS);
}
