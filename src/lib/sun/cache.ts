// The sun-data cache. The service is written against this interface; T09 adds
// a database-backed version, and the in-memory one below is the default.
//
// Only live series are cached, so a fallback never sticks once NASA recovers.
export interface CachedSun {
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

/** One cache entry per grid cell and year, so a new year never reuses old data. */
export function cacheKey(cellId: string, year: number): string {
  return `${year}:${cellId}`;
}

/**
 * The reverse of cacheKey: "2025:-7.75,110.25" → { year: 2025, cellId: "-7.75,110.25" }.
 * A cell id never contains ":", so the first ":" is the separator.
 */
export function parseCacheKey(key: string): { cellId: string; year: number } {
  const separator = key.indexOf(":");
  const year = Number(key.slice(0, separator));
  if (separator === -1 || !Number.isInteger(year)) {
    throw new Error(`not a sun cache key: ${key}`);
  }
  return { cellId: key.slice(separator + 1), year };
}
