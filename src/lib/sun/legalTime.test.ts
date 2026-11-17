import { describe, expect, it } from "vitest";
import { rotateUtcToLegalTime } from "./legalTime";

// A hand-worked day at 105° E, the meridian of WIB: the sun is highest at
// 12:00 on a UTC+7 clock, which is 05:00 UTC. Index = UTC hour.
//
//   UTC hour   23   0    1    2    3    4    5     6    7    8    9    10   11
//   W/m²       100  300  500  700  800  900  1000  900  800  700  500  300  100
//
// Hours 12 to 22 UTC are night. Total: 7,600.
const DAY_UTC = [
  300, 500, 700, 800, 900, 1000, 900, 800, 700, 500, 300, 100, // 00 to 11 UTC
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 12 to 22 UTC
  100, // 23 UTC, sunrise on the next local day
];
const TOTAL = 7600;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const peakHour = (values: number[]) => values.indexOf(Math.max(...values));

describe("rotating a day from UTC to the home's clock", () => {
  it("moves the day by 7 hours to WIB: sunrise at 06:00, the peak at 12:00, sunset at 18:00", () => {
    // Clock hour h = UTC hour h − 7. Clock 06 = UTC 23 (wrapped round from the
    // end), clock 07 = UTC 00, clock 12 = UTC 05, clock 18 = UTC 11.
    expect(rotateUtcToLegalTime(DAY_UTC, 7)).toEqual([
      0, 0, 0, 0, 0, 0, // 00 to 05: UTC 17 to 22, night
      100, 300, 500, 700, 800, 900, // 06 to 11: UTC 23, then 00 to 04
      1000, // 12: UTC 05
      900, 800, 700, 500, 300, 100, // 13 to 18: UTC 06 to 11
      0, 0, 0, 0, 0, // 19 to 23: UTC 12 to 16
    ]);
  });

  it("puts the peak at clock noon plus the zone's distance from 105° E", () => {
    // Same sun, clocks one and two hours further ahead: WITA reads 13:00, WIT 14:00.
    expect(peakHour(rotateUtcToLegalTime(DAY_UTC, 7))).toBe(12);
    expect(peakHour(rotateUtcToLegalTime(DAY_UTC, 8))).toBe(13);
    expect(peakHour(rotateUtcToLegalTime(DAY_UTC, 9))).toBe(14);
  });

  it("keeps the total, and every value, for each zone", () => {
    expect(sum(DAY_UTC)).toBe(TOTAL);
    for (const offset of [7, 8, 9]) {
      const rotated = rotateUtcToLegalTime(DAY_UTC, offset);
      expect(sum(rotated)).toBe(TOTAL);
      expect([...rotated].sort((a, b) => a - b)).toEqual([...DAY_UTC].sort((a, b) => a - b));
    }
  });

  it("does not change its input", () => {
    const copy = [...DAY_UTC];
    rotateUtcToLegalTime(DAY_UTC, 9);
    expect(DAY_UTC).toEqual(copy);
  });

  it("wraps a whole year the same way: the first hours of 1 January come from the end of 31 December UTC", () => {
    const yearUtc = Array.from({ length: 8760 }, (_, hour) => hour);
    const wib = rotateUtcToLegalTime(yearUtc, 7);
    expect(wib.slice(0, 8)).toEqual([8753, 8754, 8755, 8756, 8757, 8758, 8759, 0]);
    expect(wib[8759]).toBe(8752);
    expect(sum(wib)).toBe(sum(yearUtc));
  });
});
