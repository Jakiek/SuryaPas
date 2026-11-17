// The sun-data cache. The service is written against this interface; T09 adds
// a database-backed version, and the in-memory one below is the default.
//
// Only live series are cached, so a fallback never sticks once NASA recovers.
export interface CachedSun {
  /** 8,760 hourly values in UTC, already scaled to the long-term mean. */
  series: number[];
  year: number;
}

export interface SunCache {
  get(key: string): Promise<CachedSun | undefined>;
  set(key: string, value: CachedSun): Promise<void>;
}

/** Lives as long as the server process. Fine for one instance, and for tests. */
export class MemorySunCache implements SunCache {
  private readonly entries = new Map<string, CachedSun>();

  async get(key: string): Promise<CachedSun | undefined> {
    return this.entries.get(key);
  }

  async set(key: string, value: CachedSun): Promise<void> {
    this.entries.set(key, value);
  }
}

/**
 * Every cached series is in UTC (SPEC 3.4). The key says so, and the tag
 * travels into the stored cell id, so a row written before T20, when the
 * cache held NASA's "LST" hours, can never be read as UTC.
 */
const TIME_STANDARD_TAG = "@utc";

/** One cache entry per grid cell and year, so a new year never reuses old data. */
export function cacheKey(cellId: string, year: number): string {
  return `${year}:${cellId}${TIME_STANDARD_TAG}`;
}

/**
 * The reverse of cacheKey, as the store needs it:
 * "2025:-7.75,110.25@utc" → { year: 2025, storeCellId: "-7.75,110.25@utc" }.
 * A cell id never contains ":", so the first ":" is the separator. The store's
 * cell id keeps the time-standard tag (see TIME_STANDARD_TAG).
 */
export function parseCacheKey(key: string): { storeCellId: string; year: number } {
  const separator = key.indexOf(":");
  const year = Number(key.slice(0, separator));
  if (separator === -1 || !Number.isInteger(year)) {
    throw new Error(`not a sun cache key: ${key}`);
  }
  return { storeCellId: key.slice(separator + 1), year };
}
