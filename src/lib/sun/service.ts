// The sun-data service: cache first, then NASA POWER with a time limit, then
// the bundled series of the nearest city. Whichever it returns, live or
// fallback, is already scaled to the long-term mean (SPEC 3.4).
//
// Every series is fetched, cached and bundled in UTC. The last step before a
// series leaves this service moves it to the legal time zone of the pin
// (SPEC 3.4), so one cache cell that spans two zones serves both correctly.
import { legalUtcOffsetHours } from "../timezone/legalTimeZone";
import { cacheKey, type SunCache } from "./cache";
import { loadNearestFallback, type FallbackSun } from "./fallback";
import { gridCellFor } from "./grid";
import { rotateUtcToLegalTime } from "./legalTime";
import { longTermYears, scaleToLongTerm } from "./longTerm";
import { fetchNasaYear, latestAvailableYear, withTimeLimit } from "./nasa";
import { fetchNasaMonthly } from "./nasaMonthly";

// Settings of this service. They are plumbing, not product numbers, so they are
// not in docs/ASSUMPTIONS.md.
/** How long we wait for NASA POWER before using the bundled data. A normal
 *  year-long request took about 2 seconds when we tried it. */
export const DEFAULT_TIMEOUT_MS = 8000;
/** Longest run of missing hours we repair by interpolation ("isolated" gaps). */
export const DEFAULT_MAX_GAP_HOURS = 3;

export interface SunResult {
  /** 8,760 hourly values of global horizontal irradiance, W/m², in the legal
   *  time of the pin (SPEC 3.4), scaled to the long-term mean. */
  series: number[];
  /** The pin's legal clock: hour h of `series` is UTC hour h − utcOffsetHours. */
  utcOffsetHours: number;
  source: "live" | "fallback";
  cellId: string;
  year: number;
  /** Set only when source is "fallback": which city's series this is. */
  fallbackCityId?: string;
}

export interface SunDeps {
  cache: SunCache;
  fetchFn: typeof fetch;
  /** The clock arrives as an argument so tests can fix the year. */
  now: () => Date;
  timeoutMs: number;
  maxGapHours: number;
  loadFallback: (lat: number, lon: number) => Promise<FallbackSun>;
  /** The pin's legal UTC offset (7, 8 or 9). Throws for a pin outside
   *  Indonesia. An argument so tests can stub it. */
  legalUtcOffsetHours: (lat: number, lon: number) => number;
}

export function defaultDeps(cache: SunCache): SunDeps {
  return {
    cache,
    // Look up fetch when called, so a test can replace globalThis.fetch.
    fetchFn: (input, init) => globalThis.fetch(input, init),
    now: () => new Date(),
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxGapHours: DEFAULT_MAX_GAP_HOURS,
    loadFallback: loadNearestFallback,
    legalUtcOffsetHours,
  };
}

export async function getSun(lat: number, lon: number, deps: SunDeps): Promise<SunResult> {
  // The pin's clock first: a pin outside Indonesia throws here, before any
  // request is made.
  const utcOffsetHours = deps.legalUtcOffsetHours(lat, lon);
  const utcSeries = await getUtcSeries(lat, lon, deps);
  // The last step: UTC to the pin's legal time (SPEC 3.4).
  const legalTimeSeries = rotateUtcToLegalTime(utcSeries.series, utcOffsetHours);
  return { ...utcSeries, series: legalTimeSeries, utcOffsetHours };
}

/** Everything getSun returns, with the series still in UTC. */
type UtcSunResult = Omit<SunResult, "utcOffsetHours">;

async function getUtcSeries(lat: number, lon: number, deps: SunDeps): Promise<UtcSunResult> {
  const cell = gridCellFor(lat, lon);
  // One year for everything below: the cache key, the hourly request, and the
  // end of the monthly record's twenty-year window.
  const year = latestAvailableYear(deps.now());
  const key = cacheKey(cell.cellId, year);

  // 1. Same cell, same year: reuse the earlier fetch.
  const cached = await deps.cache.get(key);
  if (cached) {
    return { series: cached.series, source: "live", cellId: cell.cellId, year: cached.year };
  }

  // 2. Ask NASA POWER about the cell centre, so everyone in the cell gets one
  //    answer: the hourly year, and the monthly record of the twenty years
  //    ending with it. Both requests run at once, under one time limit.
  try {
    const { firstYear, lastYear } = longTermYears(year);
    const point = { lat: cell.centreLat, lon: cell.centreLon, fetchFn: deps.fetchFn };
    const [hourly, monthlyRecord] = await withTimeLimit(deps.timeoutMs, (signal) =>
      Promise.all([
        fetchNasaYear({ ...point, year, signal, maxGapHours: deps.maxGapHours }),
        fetchNasaMonthly({ ...point, firstYear, lastYear, signal }),
      ]),
    );
    // Scale to the long-term mean (SPEC 3.4) before caching, so the cache
    // only ever holds the series the engine should see, in UTC.
    const { series } = scaleToLongTerm(hourly, monthlyRecord, year);
    await deps.cache.set(key, { series, year });
    return { series, source: "live", cellId: cell.cellId, year };
  } catch {
    // Slow, down, blocked or malformed: every failure ends the same way.
    // 3. The nearest major city, from the bundled files.
    const fallback = await deps.loadFallback(lat, lon);
    return {
      series: fallback.seriesUtc,
      source: "fallback",
      cellId: cell.cellId,
      year: fallback.year,
      fallbackCityId: fallback.city.id,
    };
  }
}
