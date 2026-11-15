// The sun-data cache backed by the store's `sun_cache` table (SPEC 4.1), so a
// fetched cell survives a server restart and is shared by every server
// instance. In development the store is the in-memory one, which behaves the
// same while the process lives.
import type { Store } from "../store/types";
import { parseCacheKey, type CachedSun, type SunCache } from "./cache";

/** The two store methods this cache needs. */
type SunCacheStore = Pick<Store, "getSunCache" | "putSunCache">;

export class StoreSunCache implements SunCache {
  // The clock only stamps `fetchedAt`; it is an argument so tests can fix it.
  constructor(
    private readonly store: SunCacheStore,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(key: string): Promise<CachedSun | undefined> {
    const { cellId, year } = parseCacheKey(key);
    const entry = await this.store.getSunCache(cellId, year);
    return entry ? { series: entry.series, year: entry.year } : undefined;
  }

  async set(key: string, value: CachedSun): Promise<void> {
    const { cellId } = parseCacheKey(key);
    await this.store.putSunCache({
      cellId,
      year: value.year,
      fetchedAt: this.now().toISOString(),
      series: value.series,
    });
  }
}
