import { describe, expect, it } from "vitest";
import { assess } from "../assess";
import { HOURS_PER_YEAR } from "../calendar";
import type { EngineInputs, SunSeries } from "../types";
import { ASSUMPTIONS_V2 } from "./index";

// The whole engine runs on version 2. The made-up sun and house of src/engine/assess.test.ts:
// a smooth arc from 06:00 to 18:00 peaking at 800 W/m² every day, and a 12-panel roof in Yogyakarta.
const SUN: SunSeries = {
  source: "live",
  ghiWm2: Array.from({ length: HOURS_PER_YEAR }, (_, hour) => {
    const hourOfDay = hour % 24;
    return hourOfDay >= 6 && hourOfDay < 18 ? 800 * Math.sin((Math.PI * (hourOfDay + 0.5 - 6)) / 12) : 0;
  }),
};

const HOUSE: EngineInputs = {
  location: { latitude: -7.8, longitude: 110.4 },
  roof: { areaM2: 48, usableFraction: 0.65, facing: "E", slope: "gentle", shade: "none" },
  electricity: { billing: "postpaid", connectedVa: 2200, subsidised: false, monthlySpendRp: [650_000] },
  lifestyle: { homeOnWeekdays: true, daytimeAc: true, workFromHome: false, electricVehicle: false },
};

describe("the engine on assumption set version 2", () => {
  const result = assess(HOUSE, SUN, ASSUMPTIONS_V2);

  it("records the version it used", () => {
    expect(result.assumptionSetVersion).toBe("2");
  });

  it("uses the new performance ratio and orientation factor", () => {
    // The twelve daylight hours sum to 800 ÷ sin(π/24) Wh/m² a day.
    //   yield per kWp = 365 × 800 ÷ sin(π/24) ÷ 1,000 × 0.75 × 0.95 (gentle, east) = 1,593.9 kWh a year
    const expected = (365 * 800) / Math.sin(Math.PI / 24) / 1000 * 0.75 * 0.95;
    expect(result.yearlyYieldPerKwp).toBeCloseTo(expected, 6);
    expect(result.yearlyYieldPerKwp).toBeCloseTo(1593.9, 1);
  });

  it("still sizes, prices and recommends", () => {
    // From the 1 kWp minimum (2 panels of 550 W) up to the 12 that fit: 11 sizes.
    expect(result.candidates).toHaveLength(11);
    expect(result.recommendedPanels).not.toBeNull();
  });
});
