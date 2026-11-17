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

  // A store that fails is a cache that has nothing: the sun service then asks
  // NASA POWER as usual (SPEC 2.5 "Saving fails"). A cache must never be the
  // reason sun data cannot be returned.
  async get(key: string): Promise<CachedSun | undefined> {
    try {
      const { storeCellId, year } = parseCacheKey(key);
      const entry = await this.store.getSunCache(storeCellId, year);
      return entry ? { series: entry.series, year: entry.year } : undefined;
    } catch {
      return undefined;
    }
  }

  // A failed write only means the next request asks NASA POWER again.
  async set(key: string, value: CachedSun): Promise<void> {
    try {
      const { storeCellId } = parseCacheKey(key);
      await this.store.putSunCache({
        cellId: storeCellId,
        year: value.year,
        fetchedAt: this.now().toISOString(),
        series: value.series,
      });
    } catch {
      // Deliberately ignored: see above.
    }
  }
}
