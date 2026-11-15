// The sun-data service: cache first, then NASA POWER with a time limit, then
// the bundled series of the nearest city. Whichever it returns, live or
// fallback, is already scaled to the long-term mean (SPEC 3.4).
import { cacheKey, type SunCache } from "./cache";
import { loadNearestFallback, type FallbackSun } from "./fallback";
import { gridCellFor } from "./grid";
import { longTermYears, scaleToLongTerm } from "./longTerm";
import { fetchNasaYear, latestCompleteYear, withTimeLimit } from "./nasa";
import { fetchNasaMonthly } from "./nasaMonthly";

// Settings of this service. They are plumbing, not product numbers, so they are
// not in docs/ASSUMPTIONS.md.
/** How long we wait for NASA POWER before using the bundled data. A normal
 *  year-long request took about 2 seconds when we tried it. */
export const DEFAULT_TIMEOUT_MS = 8000;
/** Longest run of missing hours we repair by interpolation ("isolated" gaps). */
export const DEFAULT_MAX_GAP_HOURS = 3;

export interface SunResult {
  /** 8,760 hourly values of global horizontal irradiance, W/m², local solar
   *  time, scaled to the long-term mean. */
  series: number[];
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
  };
}

export async function getSun(lat: number, lon: number, deps: SunDeps): Promise<SunResult> {
  const cell = gridCellFor(lat, lon);
  const year = latestCompleteYear(deps.now());
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
    // only ever holds the series the engine should see.
    const { series } = scaleToLongTerm(hourly, monthlyRecord, year);
    await deps.cache.set(key, { series, year });
    return { series, source: "live", cellId: cell.cellId, year };
  } catch {
    // Slow, down, blocked or malformed: every failure ends the same way.
    // 3. The nearest major city, from the bundled files.
    const fallback = await deps.loadFallback(lat, lon);
    return {
      series: fallback.series,
      source: "fallback",
      cellId: cell.cellId,
      year: fallback.year,
      fallbackCityId: fallback.city.id,
    };
  }
}
