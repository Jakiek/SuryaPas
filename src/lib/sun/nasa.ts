// NASA POWER hourly client: build the request, turn the response into exactly
// 8,760 hourly values in W/m², and fetch it with a time limit.
//
// Facts confirmed against the live API on 2026-11-14 (POWER Hourly API v2.10.4):
//   - Parameter ALLSKY_SFC_SW_DWN, "All Sky Surface Shortwave Downward
//     Irradiance", which is global horizontal irradiance.
//   - Hourly unit is Wh/m² (energy over one hour); see whPerM2ToWattsPerM2.
//   - A missing value is -999 (header.fill_value).
//   - `time-standard=LST` returns NASA's "local solar time", which is in fact
//     the time zone of the nearest 15° of longitude (SPEC 3.4); the response header
//     repeats it as time_standard: "LST".
//   - Values are keyed "YYYYMMDDHH", hours 00 to 23, one key per hour.
//
// This file imports nothing, because scripts/build-sun-fallback.mjs loads it
// directly with Node.

export const HOURS_PER_YEAR = 8760;

const NASA_HOURLY_URL = "https://power.larc.nasa.gov/api/temporal/hourly/point";
const PARAMETER = "ALLSKY_SFC_SW_DWN";
const LOCAL_SOLAR_TIME = "LST";

/** Anything wrong with the sun data. The service answers it with the fallback. */
export class SunDataError extends Error {}

// ---------------------------------------------------------------- request

export function buildNasaUrl(lat: number, lon: number, year: number): string {
  const query = new URLSearchParams({
    parameters: PARAMETER,
    community: "RE", // renewable-energy community
    latitude: String(lat),
    longitude: String(lon),
    start: `${year}0101`,
    end: `${year}1231`,
    format: "JSON",
    "time-standard": LOCAL_SOLAR_TIME,
  });
  return `${NASA_HOURLY_URL}?${query.toString()}`;
}

/**
 * SPEC 3.4: a year is used only once it ended at least this many months ago.
 * NASA's solar data runs about four months behind the calendar (asked on
 * 2026-11-15, the monthly record had 2026 only to July), so a year is not
 * available in full until well into the next one.
 */
export const MONTHS_AFTER_YEAR_END = 6;

/**
 * The most recent calendar year that ended at least MONTHS_AFTER_YEAR_END
 * months before `now` (read in UTC). A year ends on 1 January of the next, so
 * 2025 qualifies from 1 July 2026 and 2026 from 1 July 2027.
 */
export function latestAvailableYear(now: Date): number {
  // Whole months since 1 January of the current year: January is 0, July is 6.
  const monthsIntoYear = now.getUTCMonth();
  // The previous year ended on 1 January of this one, monthsIntoYear months ago.
  // Before July, it ended under six months ago, so go back one year more.
  const yearsBack = monthsIntoYear >= MONTHS_AFTER_YEAR_END ? 1 : 2;
  return now.getUTCFullYear() - yearsBack;
}

// ------------------------------------------------------------- hour keys

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * The 8,760 keys "YYYYMMDDHH" of a year, in time order.
 * 29 February is skipped, so a leap year also gives 8,760 keys. That is the
 * leap-day rule: every year we hand to the engine has the same length.
 */
export function hourKeysOfYear(year: number): string[] {
  const keys: string[] = [];
  for (let month = 1; month <= 12; month++) {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    for (let day = 1; day <= daysInMonth; day++) {
      if (month === 2 && day === 29) continue;
      for (let hour = 0; hour < 24; hour++) {
        keys.push(`${year}${pad2(month)}${pad2(day)}${pad2(hour)}`);
      }
    }
  }
  return keys;
}

// -------------------------------------------------------------- conversion

/**
 * NASA's hourly value is the energy that fell on one square metre during that
 * hour, in Wh/m². Energy over exactly one hour, divided by that one hour, is
 * the average power over the hour in W/m². So the number does not change; the
 * division is written out so the unit change is visible.
 */
const HOURS_PER_VALUE = 1;
export function whPerM2ToWattsPerM2(whPerM2: number): number {
  return whPerM2 / HOURS_PER_VALUE;
}

// ----------------------------------------------------------------- filling

/** A value is missing when it is absent, not a number, or negative.
 *  NASA marks missing hours as -999, and irradiance can never be below zero. */
function isMissing(value: number | null | undefined): boolean {
  return value === null || value === undefined || !Number.isFinite(value) || value < 0;
}

/**
 * Replace missing hours by a straight line between the nearest good hours on
 * each side. A gap at the very start or end of the year copies the one good
 * neighbour. Only short gaps are filled: a gap longer than `maxGapHours` means
 * the data is unreliable, so we throw and the service uses the fallback.
 */
export function fillMissingHours(
  values: ReadonlyArray<number | null | undefined>,
  maxGapHours: number,
): number[] {
  const filled: number[] = [];
  let i = 0;
  while (i < values.length) {
    const value = values[i];
    if (!isMissing(value)) {
      filled.push(value as number);
      i++;
      continue;
    }
    // Find where this run of missing hours ends.
    let end = i;
    while (end < values.length && isMissing(values[end])) end++;
    const gapLength = end - i;
    if (gapLength > maxGapHours) {
      throw new SunDataError(`gap of ${gapLength} missing hours is too long`);
    }
    const before = i > 0 ? filled[i - 1] : undefined;
    const after = end < values.length ? (values[end] as number) : undefined;
    if (before === undefined && after === undefined) {
      throw new SunDataError("no valid hours at all");
    }
    for (let step = 1; step <= gapLength; step++) {
      if (before === undefined) filled.push(after as number);
      else if (after === undefined) filled.push(before);
      else filled.push(before + ((after - before) * step) / (gapLength + 1));
    }
    i = end;
  }
  return filled;
}

// ----------------------------------------------------------------- parsing

/** Pull the hourly values out of a NASA POWER response, in W/m², 8,760 long. */
export function parseNasaHourly(
  response: unknown,
  year: number,
  maxGapHours: number,
): number[] {
  const body = response as {
    header?: { time_standard?: string };
    properties?: { parameter?: Record<string, Record<string, number>> };
  };
  const hourly = body?.properties?.parameter?.[PARAMETER];
  if (!hourly || typeof hourly !== "object") {
    throw new SunDataError(`response has no ${PARAMETER} values`);
  }
  // The engine assumes NASA's "LST" zone time; refuse anything else.
  const timeStandard = body.header?.time_standard;
  if (timeStandard !== undefined && timeStandard !== LOCAL_SOLAR_TIME) {
    throw new SunDataError(`time standard is ${timeStandard}, expected LST`);
  }
  // Walk our own list of keys rather than trusting the response's order. A key
  // the response lacks (or marks -999) becomes a missing hour. The response's
  // 29 February hours, in a leap year, are simply never looked up.
  const asWatts = hourKeysOfYear(year).map((key) => {
    const raw = hourly[key];
    return isMissing(raw) ? null : whPerM2ToWattsPerM2(raw);
  });
  return fillMissingHours(asWatts, maxGapHours);
}

// ------------------------------------------------------------------- fetch

/**
 * Run `work` under one time limit. The signal it receives aborts when the
 * limit is reached, so every request given that signal stops together: this
 * is how the hourly and the monthly request share one limit (SPEC 3.4). The
 * timer covers the whole of `work`, including reading the bodies. When `work`
 * ends, the signal is aborted too, so a request still running after its
 * partner failed is not left hanging.
 */
export async function withTimeLimit<T>(
  timeoutMs: number,
  work: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await work(controller.signal);
  } finally {
    clearTimeout(timer);
    controller.abort();
  }
}

export interface FetchNasaOptions {
  lat: number;
  lon: number;
  year: number;
  fetchFn: typeof fetch;
  /** Ends the request early; the caller owns the time limit (withTimeLimit). */
  signal: AbortSignal;
  maxGapHours: number;
}

/** Fetch one year for one point. Throws if it is aborted, fails or looks wrong. */
export async function fetchNasaYear(options: FetchNasaOptions): Promise<number[]> {
  const { lat, lon, year, fetchFn, signal, maxGapHours } = options;
  const response = await fetchFn(buildNasaUrl(lat, lon, year), { signal });
  if (!response.ok) {
    throw new SunDataError(`NASA POWER answered ${response.status}`);
  }
  const json: unknown = await response.json();
  return parseNasaHourly(json, year, maxGapHours);
}
