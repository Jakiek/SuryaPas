import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "../assumptions";
import { averageByHourOfDay, chooseBatterySizeKwh, simulateWithBattery, simulateWithoutBattery } from "./simulate";

// One day, small enough to check on paper.
// Sun: each kWp produces 0.5 kWh in each of the four hours from 10:00 to 14:00, and nothing else.
const SQUARE_SUN = Array.from({ length: 24 }, (_, hour) => (hour >= 10 && hour < 14 ? 0.5 : 0));
// A home that uses 0.4 kWh every hour: 9.6 kWh a day.
const FLAT_LOAD = Array<number>(24).fill(0.4);
// A home that uses 1 kWh in each hour from 18:00 to 22:00 and nothing in the daytime.
const NIGHT_LOAD = Array.from({ length: 24 }, (_, hour) => (hour >= 18 && hour < 22 ? 1 : 0));

describe("simulateWithoutBattery", () => {
  it("a 1 kWp system against a flat load", () => {
    const day = simulateWithoutBattery(SQUARE_SUN, FLAT_LOAD, 1);
    expect(day.generationKwh).toBeCloseTo(2.0, 10); // 4 hours × 0.5
    expect(day.selfConsumedKwh).toBeCloseTo(1.6, 10); // 4 hours × the 0.4 the home can take
    expect(day.exportedKwh).toBeCloseTo(0.4, 10); // 4 hours × the 0.1 left over
    expect(day.gridImportKwh).toBeCloseTo(8.0, 10); // 9.6 used − 1.6 from the panels
  });

  it("a half-size system exports nothing: its 0.25 kWh an hour is all used", () => {
    const day = simulateWithoutBattery(SQUARE_SUN, FLAT_LOAD, 0.5);
    expect(day.selfConsumedKwh).toBeCloseTo(1.0, 10);
    expect(day.exportedKwh).toBeCloseTo(0, 10);
  });

  it("a far larger system saves no more: self-consumption stops at what the home uses", () => {
    const big = simulateWithoutBattery(SQUARE_SUN, FLAT_LOAD, 50);
    const bigger = simulateWithoutBattery(SQUARE_SUN, FLAT_LOAD, 100);
    expect(big.selfConsumedKwh).toBeCloseTo(1.6, 10);
    expect(bigger.selfConsumedKwh).toBeCloseTo(1.6, 10);
    expect(bigger.exportedKwh).toBeGreaterThan(big.exportedKwh);
  });

  it("a home that only uses power at night gets nothing from panels alone", () => {
    const day = simulateWithoutBattery(SQUARE_SUN, NIGHT_LOAD, 1);
    expect(day.selfConsumedKwh).toBe(0);
    expect(day.exportedKwh).toBeCloseTo(2.0, 10);
    expect(day.gridImportKwh).toBeCloseTo(4.0, 10);
  });
});

describe("simulateWithBattery", () => {
  it("carries daytime solar into the night, less the charging loss", () => {
    // 2.0 kWh of solar goes into the battery at 90% efficiency: 1.8 kWh stored, 0.2 lost.
    const day = simulateWithBattery(SQUARE_SUN, NIGHT_LOAD, 1, 5, ASSUMPTIONS_V1);
    expect(day.selfConsumedKwh).toBeCloseTo(1.8, 10);
    expect(day.batteryLossKwh).toBeCloseTo(0.2, 10);
    expect(day.exportedKwh).toBeCloseTo(0, 10);
    expect(day.gridImportKwh).toBeCloseTo(2.2, 10); // 4.0 used − 1.8 from the battery
    expect(day.batteryEndKwh).toBeCloseTo(0, 10);
  });

  it("stops charging when full: a 5 kWh battery holds 4.5 usable", () => {
    // 10 kWp makes 20 kWh. Filling 4.5 kWh takes 5.0 from the panels; the other 15 is exported.
    const day = simulateWithBattery(SQUARE_SUN, NIGHT_LOAD, 10, 5, ASSUMPTIONS_V1);
    expect(day.exportedKwh).toBeCloseTo(15, 10);
    expect(day.batteryLossKwh).toBeCloseTo(0.5, 10);
    expect(day.selfConsumedKwh).toBeCloseTo(4.0, 10); // the whole night's use
    expect(day.gridImportKwh).toBeCloseTo(0, 10);
    expect(day.batteryEndKwh).toBeCloseTo(0.5, 10); // 4.5 stored − 4.0 used
  });

  it("keeps the books balanced", () => {
    const day = simulateWithBattery(SQUARE_SUN, NIGHT_LOAD, 10, 5, ASSUMPTIONS_V1);
    // Every kWh the panels made went somewhere.
    expect(day.selfConsumedKwh + day.exportedKwh + day.batteryLossKwh + day.batteryEndKwh).toBeCloseTo(day.generationKwh, 10);
    // Every kWh the home used came from somewhere.
    expect(day.selfConsumedKwh + day.gridImportKwh).toBeCloseTo(4.0, 10);
  });
});

describe("chooseBatterySizeKwh", () => {
  it("offers no battery when the surplus is small: 0.4 kWh a day would barely touch a 5 kWh battery", () => {
    expect(chooseBatterySizeKwh(SQUARE_SUN, FLAT_LOAD, 1, ASSUMPTIONS_V1)).toBeNull();
  });

  it("sizes to the night's use when the surplus is large", () => {
    // 20 kWp leaves 38.4 kWh of surplus, but the home uses only 4.8 kWh outside 06:00 to 18:00.
    // 4.8 is closer to the 5 kWh battery's 4.5 usable than to the 10 kWh battery's 9.
    expect(chooseBatterySizeKwh(SQUARE_SUN, FLAT_LOAD, 20, ASSUMPTIONS_V1)).toBe(5);
  });

  it("picks the larger battery when both surplus and night use are large", () => {
    const heavyNightLoad = NIGHT_LOAD.map((kwh) => kwh * 2); // 8 kWh a night
    expect(chooseBatterySizeKwh(SQUARE_SUN, heavyNightLoad, 20, ASSUMPTIONS_V1)).toBe(10);
  });
});

describe("averageByHourOfDay", () => {
  it("averages each hour across days", () => {
    const twoDays = [...Array<number>(24).fill(1), ...Array<number>(24).fill(3)];
    expect(averageByHourOfDay(twoDays)).toEqual(Array<number>(24).fill(2));
  });
});
