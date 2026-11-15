import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "../assumptions";
import { HOURS_PER_YEAR } from "../calendar";
import type { RoofInput } from "../types";
import { orientationFactor, shadeFactor, solarPerKwp } from "./solar";

const YOGYAKARTA = -7.8; // south of the equator
const MEDAN = 3.6; // north of the equator

const roof = (changes: Partial<RoofInput> = {}): RoofInput => ({
  areaM2: 48,
  usableFraction: 0.65,
  facing: "none",
  slope: "flat",
  shade: "none",
  ...changes,
});

describe("orientationFactor", () => {
  it("is 1 for a flat roof", () => {
    expect(orientationFactor(roof(), YOGYAKARTA, ASSUMPTIONS_V1)).toBe(1);
  });

  it("south of the equator, north faces the sun's path and south faces away", () => {
    expect(orientationFactor(roof({ slope: "steep", facing: "N" }), YOGYAKARTA, ASSUMPTIONS_V1)).toBe(0.97);
    expect(orientationFactor(roof({ slope: "steep", facing: "S" }), YOGYAKARTA, ASSUMPTIONS_V1)).toBe(0.88);
  });

  it("north of the equator, it is the other way round", () => {
    expect(orientationFactor(roof({ slope: "steep", facing: "S" }), MEDAN, ASSUMPTIONS_V1)).toBe(0.97);
    expect(orientationFactor(roof({ slope: "steep", facing: "N" }), MEDAN, ASSUMPTIONS_V1)).toBe(0.88);
  });

  it("treats east and west alike", () => {
    expect(orientationFactor(roof({ slope: "gentle", facing: "E" }), YOGYAKARTA, ASSUMPTIONS_V1)).toBe(0.99);
    expect(orientationFactor(roof({ slope: "gentle", facing: "W" }), YOGYAKARTA, ASSUMPTIONS_V1)).toBe(0.99);
  });
});

describe("shadeFactor", () => {
  it("reads the three shade levels", () => {
    expect(shadeFactor("none", ASSUMPTIONS_V1)).toBe(1);
    expect(shadeFactor("some", ASSUMPTIONS_V1)).toBe(0.9);
    expect(shadeFactor("heavy", ASSUMPTIONS_V1)).toBe(0.7);
  });
});

describe("solarPerKwp", () => {
  const fullSun = Array<number>(HOURS_PER_YEAR).fill(1000);

  it("gives 0.78 kWh per kWp in an hour of 1,000 W/m² on a flat, unshaded roof", () => {
    const output = solarPerKwp(fullSun, roof(), YOGYAKARTA, ASSUMPTIONS_V1);
    expect(output).toHaveLength(HOURS_PER_YEAR);
    expect(output[0]).toBeCloseTo(0.78, 10);
  });

  it("multiplies the factors: 0.78 × 0.94 (steep, east) × 0.7 (heavy shade)", () => {
    const output = solarPerKwp(fullSun, roof({ slope: "steep", facing: "E", shade: "heavy" }), YOGYAKARTA, ASSUMPTIONS_V1);
    expect(output[0]).toBeCloseTo(0.78 * 0.94 * 0.7, 10);
  });

  it("treats a negative reading as darkness", () => {
    const withBadReading = [...fullSun];
    withBadReading[5] = -999;
    expect(solarPerKwp(withBadReading, roof(), YOGYAKARTA, ASSUMPTIONS_V1)[5]).toBe(0);
  });

  it("rejects a series that is not a full year", () => {
    expect(() => solarPerKwp([1000, 1000], roof(), YOGYAKARTA, ASSUMPTIONS_V1)).toThrow();
  });
});
