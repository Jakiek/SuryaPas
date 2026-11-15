import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "../assumptions";
import { HOURS_PER_YEAR } from "../calendar";
import type { EnergyResult, EngineInputs, SunSeries } from "../types";
import { simulateEnergy } from "./index";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

// A made-up but sun-shaped year: a smooth arc from 06:00 to 18:00 peaking at 800 W/m², every day.
const SUN: SunSeries = {
  source: "live",
  ghiWm2: Array.from({ length: HOURS_PER_YEAR }, (_, hour) => {
    const hourOfDay = hour % 24;
    return hourOfDay >= 6 && hourOfDay < 18 ? 800 * Math.sin((Math.PI * (hourOfDay + 0.5 - 6)) / 12) : 0;
  }),
};

// The example house: Yogyakarta, 2,200 VA, Rp650,000 a month, someone home with the air conditioning on.
const HOUSE: EngineInputs = {
  location: { latitude: -7.8, longitude: 110.4 },
  roof: { areaM2: 48, usableFraction: 0.65, facing: "E", slope: "gentle", shade: "none" },
  electricity: { billing: "postpaid", connectedVa: 2200, subsidised: false, monthlySpendRp: [650_000] },
  lifestyle: { homeOnWeekdays: true, daytimeAc: true, workFromHome: false, electricVehicle: false },
};

function expectBalanced(energy: EnergyResult, yearlyLoadKwh: number): void {
  // Every kWh the panels made went somewhere.
  expect(energy.selfConsumedKwh + energy.exportedKwh + energy.batteryLossKwh + energy.batteryEndKwh).toBeCloseTo(energy.generationKwh, 6);
  // Every kWh the home used came from somewhere.
  expect(energy.selfConsumedKwh + energy.gridImportKwh).toBeCloseTo(yearlyLoadKwh, 6);
  // The monthly figures add up to the yearly ones.
  expect(sum(energy.monthly.generationKwh)).toBeCloseTo(energy.generationKwh, 6);
  expect(sum(energy.monthly.selfConsumedKwh)).toBeCloseTo(energy.selfConsumedKwh, 6);
  expect(sum(energy.monthly.exportedKwh)).toBeCloseTo(energy.exportedKwh, 6);
  expect(sum(energy.monthly.gridImportKwh)).toBeCloseTo(energy.gridImportKwh, 6);
}

describe("simulateEnergy", () => {
  const result = simulateEnergy(HOUSE, SUN, ASSUMPTIONS_V1);
  const yearlyLoadKwh = sum(result.monthlyLoadKwh);

  it("assesses every size the roof holds, 2 to 12 panels", () => {
    expect(result.candidates.map((candidate) => candidate.panels)).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(result.roofTooSmall).toBeNull();
  });

  it("reports the daytime share from the lifestyle answers: 0.30 + 0.10 + 0.15", () => {
    expect(result.daytimeShare.weekday).toBeCloseTo(0.55, 10);
  });

  it("keeps the energy books balanced for every size, with and without a battery", () => {
    for (const candidate of result.candidates) {
      expectBalanced(candidate.withoutBattery, yearlyLoadKwh);
      if (candidate.withBattery) expectBalanced(candidate.withBattery.energy, yearlyLoadKwh);
    }
  });

  it("generation grows in step with size, but self-consumption flattens", () => {
    const first = result.candidates[0];
    const last = result.candidates[result.candidates.length - 1];
    const perKwp = (candidate: typeof first) => candidate.withoutBattery.generationKwh / candidate.kwp;
    expect(perKwp(last)).toBeCloseTo(perKwp(first), 6);

    const usedShare = (candidate: typeof first) => candidate.withoutBattery.selfConsumedKwh / candidate.withoutBattery.generationKwh;
    for (let i = 1; i < result.candidates.length; i++) {
      const smaller = result.candidates[i - 1];
      const larger = result.candidates[i];
      expect(larger.withoutBattery.selfConsumedKwh).toBeGreaterThanOrEqual(smaller.withoutBattery.selfConsumedKwh);
      expect(usedShare(larger)).toBeLessThanOrEqual(usedShare(smaller));
    }
    expect(usedShare(last)).toBeLessThan(usedShare(first));
  });

  it("a battery never lowers self-consumption", () => {
    for (const candidate of result.candidates) {
      if (candidate.withBattery) {
        expect(candidate.withBattery.energy.selfConsumedKwh).toBeGreaterThanOrEqual(candidate.withoutBattery.selfConsumedKwh);
      }
    }
  });

  it("offers a battery only to sizes with enough surplus", () => {
    expect(result.candidates[0].withBattery).toBeNull(); // 2 panels: everything is used directly
    expect(result.candidates[result.candidates.length - 1].withBattery).not.toBeNull();
  });

  it("gives the 24-hour curves for the chart", () => {
    expect(result.averageLoadByHourKwh).toHaveLength(24);
    expect(result.averageSolarByHourPerKwp).toHaveLength(24);
    expect(sum(result.averageLoadByHourKwh) * 365).toBeCloseTo(yearlyLoadKwh, 6);
    expect(sum(result.averageSolarByHourPerKwp) * 365).toBeCloseTo(result.yearlyYieldPerKwp, 6);
    expect(result.averageSolarByHourPerKwp[0]).toBe(0);
  });

  it("returns the same answer every time", () => {
    expect(simulateEnergy(HOUSE, SUN, ASSUMPTIONS_V1)).toEqual(result);
  });

  it("says when the roof is too small, and how much roof the smallest system needs", () => {
    const tiny = simulateEnergy({ ...HOUSE, roof: { ...HOUSE.roof, areaM2: 4 } }, SUN, ASSUMPTIONS_V1);
    expect(tiny.candidates).toEqual([]);
    expect(tiny.roofTooSmall?.requiredAreaM2).toBeCloseTo(8, 10);
  });

  it("flags fallback sun data and heavy shade", () => {
    const flagged = simulateEnergy({ ...HOUSE, roof: { ...HOUSE.roof, shade: "heavy" } }, { ...SUN, source: "fallback" }, ASSUMPTIONS_V1);
    expect(flagged.flags).toEqual({ fallbackSunData: true, heavyShade: true });
    expect(result.flags).toEqual({ fallbackSunData: false, heavyShade: false });
  });
});
