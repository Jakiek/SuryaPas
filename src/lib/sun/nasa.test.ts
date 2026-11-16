import { describe, expect, it } from "vitest";
import yogyakartaResponse from "./fixtures/nasa-hourly-yogyakarta-2025.json";
import {
  buildNasaUrl,
  fetchNasaYear,
  fillMissingHours,
  HOURS_PER_YEAR,
  hourKeysOfYear,
  latestAvailableYear,
  parseNasaHourly,
  SunDataError,
  whPerM2ToWattsPerM2,
  withTimeLimit,
} from "./nasa";

// The fixture is a real NASA POWER response, recorded 2026-11-14, for the 0.5°
// cell centred on -7.75, 110.25 (Yogyakarta), 2025, local solar time.
//
// NASA POWER's daily endpoint, asked the same day for the same point and year,
// gave 365 values in kWh/m²/day that add up to 1738.4702 kWh/m². That is our
// independent total (the daily product is NASA's own sum of the hours).
const DAILY_TOTAL_KWH_PER_M2 = 1738.4702;

/** A year of numbers for tests: every hour holds `value`. */
const flatYear = (value: number): Record<string, number> =>
  Object.fromEntries(hourKeysOfYear(2025).map((key) => [key, value]));

const responseWith = (hourly: Record<string, number>, timeStandard = "LST") => ({
  header: { time_standard: timeStandard, fill_value: -999 },
  properties: { parameter: { ALLSKY_SFC_SW_DWN: hourly } },
});

describe("unit conversion", () => {
  it("keeps the number: Wh/m² in one hour is the same figure as average W/m²", () => {
    expect(whPerM2ToWattsPerM2(0)).toBe(0);
    expect(whPerM2ToWattsPerM2(645.28)).toBe(645.28);
  });

  it("is applied to every value read from a response", () => {
    const series = parseNasaHourly(responseWith(flatYear(500)), 2025, 3);
    expect(series.every((value) => value === 500)).toBe(true);
  });
});

describe("filling missing hours", () => {
  it("leaves a series without gaps untouched", () => {
    expect(fillMissingHours([0, 10, 20], 3)).toEqual([0, 10, 20]);
  });

  it("draws a straight line across a one-hour gap", () => {
    expect(fillMissingHours([100, -999, 300], 3)).toEqual([100, 200, 300]);
  });

  it("draws a straight line across a three-hour gap", () => {
    expect(fillMissingHours([0, -999, -999, -999, 400], 3)).toEqual([0, 100, 200, 300, 400]);
  });

  it("copies the one good neighbour at the start and at the end", () => {
    expect(fillMissingHours([-999, 50, 60], 3)).toEqual([50, 50, 60]);
    expect(fillMissingHours([50, 60, -999], 3)).toEqual([50, 60, 60]);
  });

  it("treats null, undefined, NaN and any negative number as missing", () => {
    expect(fillMissingHours([10, null, undefined, NaN, -5, 50], 4)).toEqual([
      10, 18, 26, 34, 42, 50,
    ]);
  });

  it("refuses a gap longer than the limit", () => {
    expect(() => fillMissingHours([0, -999, -999, -999, -999, 0], 3)).toThrow(SunDataError);
  });

  it("refuses a series with no good hour", () => {
    expect(() => fillMissingHours([-999, -999], 3)).toThrow(SunDataError);
  });
});

describe("the leap-day rule", () => {
  it("gives 8,760 keys for an ordinary year", () => {
    expect(hourKeysOfYear(2025)).toHaveLength(HOURS_PER_YEAR);
  });

  it("gives 8,760 keys for a leap year, without 29 February", () => {
    const keys = hourKeysOfYear(2024);
    expect(keys).toHaveLength(HOURS_PER_YEAR);
    expect(keys.some((key) => key.startsWith("20240229"))).toBe(false);
    // 28 February is followed straight by 1 March.
    const lastOf28Feb = keys.indexOf("2024022823");
    expect(keys[lastOf28Feb + 1]).toBe("2024030100");
  });

  it("starts at 00:00 on 1 January and ends at 23:00 on 31 December", () => {
    const keys = hourKeysOfYear(2025);
    expect(keys[0]).toBe("2025010100");
    expect(keys[keys.length - 1]).toBe("2025123123");
  });

  it("parses a leap-year response (8,784 hours) into 8,760 values, ignoring 29 February", () => {
    const hourly: Record<string, number> = {};
    for (const key of hourKeysOfYear(2024)) hourly[key] = 100;
    // The real API also sends the 24 hours of 29 February; give them a loud value.
    for (let hour = 0; hour < 24; hour++) {
      hourly[`20240229${String(hour).padStart(2, "0")}`] = 99999;
    }
    const series = parseNasaHourly(responseWith(hourly), 2024, 3);
    expect(series).toHaveLength(HOURS_PER_YEAR);
    expect(Math.max(...series)).toBe(100);
  });
});

describe("parsing a recorded NASA response (Yogyakarta, 2025)", () => {
  const series = parseNasaHourly(yogyakartaResponse, 2025, 3);

  it("returns exactly 8,760 non-negative values", () => {
    expect(series).toHaveLength(HOURS_PER_YEAR);
    expect(series.every((value) => value >= 0)).toBe(true);
  });

  it("is dark at night and bright at midday", () => {
    // Local solar time: hour 0 of 1 January is midnight, hour 11 is just before noon.
    expect(series[0]).toBe(0);
    expect(series[1]).toBe(0);
    expect(series[11]).toBeGreaterThan(300);
  });

  it("sums to the independently recorded daily total within 2%", () => {
    const hourlyTotalKwhPerM2 = series.reduce((sum, value) => sum + value, 0) / 1000;
    const difference = Math.abs(hourlyTotalKwhPerM2 - DAILY_TOTAL_KWH_PER_M2);
    expect(difference / DAILY_TOTAL_KWH_PER_M2).toBeLessThan(0.02);
  });
});

describe("parsing problems", () => {
  it("fills isolated missing hours marked -999", () => {
    const hourly = flatYear(200);
    hourly["2025030112"] = -999;
    const series = parseNasaHourly(responseWith(hourly), 2025, 3);
    expect(series).toHaveLength(HOURS_PER_YEAR);
    expect(series.every((value) => value === 200)).toBe(true);
  });

  it("counts a key the response lacks as missing", () => {
    const hourly = flatYear(200);
    delete hourly["2025030112"];
    const series = parseNasaHourly(responseWith(hourly), 2025, 3);
    expect(series[hourKeysOfYear(2025).indexOf("2025030112")]).toBe(200);
  });

  it("refuses a response that is not in local solar time", () => {
    expect(() => parseNasaHourly(responseWith(flatYear(1), "UTC"), 2025, 3)).toThrow(SunDataError);
  });

  it("refuses a response without the irradiance parameter", () => {
    expect(() => parseNasaHourly({ properties: { parameter: {} } }, 2025, 3)).toThrow(SunDataError);
    expect(() => parseNasaHourly(null, 2025, 3)).toThrow(SunDataError);
  });

  it("refuses a response with a long run of missing hours", () => {
    const hourly = flatYear(200);
    for (const key of hourKeysOfYear(2025).slice(100, 110)) hourly[key] = -999;
    expect(() => parseNasaHourly(responseWith(hourly), 2025, 3)).toThrow(SunDataError);
  });
});

describe("the request", () => {
  it("asks for the right parameter, year and time standard", () => {
    const url = new URL(buildNasaUrl(-7.75, 110.25, 2025));
    expect(url.origin + url.pathname).toBe("https://power.larc.nasa.gov/api/temporal/hourly/point");
    expect(url.searchParams.get("parameters")).toBe("ALLSKY_SFC_SW_DWN");
    expect(url.searchParams.get("latitude")).toBe("-7.75");
    expect(url.searchParams.get("longitude")).toBe("110.25");
    expect(url.searchParams.get("start")).toBe("20250101");
    expect(url.searchParams.get("end")).toBe("20251231");
    expect(url.searchParams.get("time-standard")).toBe("LST");
  });

  describe("the year used: the latest that ended at least six months ago (SPEC 3.4)", () => {
    it("is last year from 1 July on", () => {
      // 2025 ended on 1 January 2026; six months later is 1 July 2026, well before this date.
      expect(latestAvailableYear(new Date("2026-11-15T10:00:00Z"))).toBe(2025);
      // 2026 ended on 1 January 2027; it qualifies from 1 July 2027, the first instant included.
      expect(latestAvailableYear(new Date("2027-07-01T00:00:00Z"))).toBe(2026);
    });

    it("is the year before last until 30 June", () => {
      // On 1 January 2027, 2026 ended a moment ago: NASA does not have it yet, so 2025.
      expect(latestAvailableYear(new Date("2027-01-01T00:00:00Z"))).toBe(2025);
      // The last instant before the boundary: 2026 ended under six months ago, still 2025.
      expect(latestAvailableYear(new Date("2027-06-30T23:59:59Z"))).toBe(2025);
    });
  });

  it("gives up when NASA does not answer within the time limit", async () => {
    // A fetch that never answers, but obeys the abort signal like the real one.
    const hangingFetch = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    await expect(
      withTimeLimit(20, (signal) =>
        fetchNasaYear({ lat: -7.75, lon: 110.25, year: 2025, fetchFn: hangingFetch, signal, maxGapHours: 3 }),
      ),
    ).rejects.toThrow("aborted");
  });

  it("rejects a non-200 answer", async () => {
    const failingFetch = (async () => new Response("nope", { status: 503 })) as typeof fetch;
    await expect(
      withTimeLimit(1000, (signal) =>
        fetchNasaYear({ lat: -7.75, lon: 110.25, year: 2025, fetchFn: failingFetch, signal, maxGapHours: 3 }),
      ),
    ).rejects.toThrow(SunDataError);
  });

  it("stops every request under one time limit together", async () => {
    let aborted = 0;
    const hanging = (signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          aborted += 1;
          reject(new Error("aborted"));
        });
      });
    await expect(withTimeLimit(20, (signal) => Promise.all([hanging(signal), hanging(signal)]))).rejects.toThrow(
      "aborted",
    );
    expect(aborted).toBe(2);
  });

  it("aborts a request still running once its partner has failed", async () => {
    let partnerAborted = false;
    const partner = (signal: AbortSignal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          partnerAborted = true;
          reject(new Error("aborted"));
        });
      });
    const failsAtOnce = async () => {
      throw new SunDataError("broken");
    };
    await expect(
      withTimeLimit(60_000, (signal) => Promise.all([partner(signal), failsAtOnce()])),
    ).rejects.toThrow("broken");
    expect(partnerAborted).toBe(true);
  });
});
