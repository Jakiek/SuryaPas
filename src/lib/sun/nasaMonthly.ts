// NASA POWER monthly client: the long-term record that the hourly year is
// scaled to (SPEC 3.4, "Long-term scaling"). Build the request, read the
// response into one row of twelve months per year, and fetch it.
//
// Facts confirmed against the live API on 2026-11-15 (POWER Monthly and Annual
// API v2.10.0, source SYN1DEG, the same as the hourly series):
//   - Parameter ALLSKY_SFC_SW_DWN, the same quantity as the hourly series.
//   - Unit kWh/m²/day: each month's value is the mean day of that month.
//   - Keys are "YYYYMM" for months 01 to 12, and "YYYY13" for the whole year,
//     which we do not use (we add up the months ourselves; see longTerm.ts).
//   - A month NASA has no data for yet is -999 (header.fill_value) or absent.
//     Asked on 2026-11-15 for 2026, it gave January to July and -999 after.
//   - start and end are plain years ("2006", "2025").
//
// Like nasa.ts, this file is loaded directly by scripts/build-sun-fallback.mjs.

import { SunDataError } from "./nasa";

const NASA_MONTHLY_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point";
const PARAMETER = "ALLSKY_SFC_SW_DWN";
export const MONTHS_PER_YEAR = 12;

/**
 * The monthly record: for each year, the mean day of each month in kWh/m²/day,
 * January first. A month without data is null.
 */
export type MonthlyRecord = Record<number, ReadonlyArray<number | null>>;

// ---------------------------------------------------------------- request

export function buildNasaMonthlyUrl(
  lat: number,
  lon: number,
  firstYear: number,
  lastYear: number,
): string {
  const query = new URLSearchParams({
    parameters: PARAMETER,
    community: "RE", // renewable-energy community, as for the hourly series
    latitude: String(lat),
    longitude: String(lon),
    start: String(firstYear),
    end: String(lastYear),
    format: "JSON",
  });
  return `${NASA_MONTHLY_URL}?${query.toString()}`;
}

// ----------------------------------------------------------------- parsing

const pad2 = (n: number) => String(n).padStart(2, "0");

/** NASA marks a missing month as -999; a month can also be absent. */
function isUsableMonth(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/** Pull one row of twelve months per year, from firstYear to lastYear, out of a response. */
export function parseNasaMonthly(
  response: unknown,
  firstYear: number,
  lastYear: number,
): MonthlyRecord {
  const body = response as {
    properties?: { parameter?: Record<string, Record<string, number>> };
  };
  const monthly = body?.properties?.parameter?.[PARAMETER];
  if (!monthly || typeof monthly !== "object") {
    throw new SunDataError(`monthly response has no ${PARAMETER} values`);
  }
  const record: MonthlyRecord = {};
  for (let year = firstYear; year <= lastYear; year++) {
    const months: (number | null)[] = [];
    for (let month = 1; month <= MONTHS_PER_YEAR; month++) {
      const value = monthly[`${year}${pad2(month)}`];
      months.push(isUsableMonth(value) ? value : null);
    }
    record[year] = months;
  }
  return record;
}

// ------------------------------------------------------------------- fetch

export interface FetchNasaMonthlyOptions {
  lat: number;
  lon: number;
  firstYear: number;
  lastYear: number;
  fetchFn: typeof fetch;
  /** Ends the request early; the caller owns the time limit. */
  signal: AbortSignal;
}

/** Fetch the monthly record for one point. Throws if it fails or looks wrong. */
export async function fetchNasaMonthly(options: FetchNasaMonthlyOptions): Promise<MonthlyRecord> {
  const { lat, lon, firstYear, lastYear, fetchFn, signal } = options;
  const response = await fetchFn(buildNasaMonthlyUrl(lat, lon, firstYear, lastYear), { signal });
  if (!response.ok) {
    throw new SunDataError(`NASA POWER monthly answered ${response.status}`);
  }
  const json: unknown = await response.json();
  return parseNasaMonthly(json, firstYear, lastYear);
}
