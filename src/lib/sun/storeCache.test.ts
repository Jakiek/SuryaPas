import { describe, expect, it } from "vitest";
import { MemoryStore } from "../store/memory";
import { cacheKey, parseCacheKey } from "./cache";
import { getSun, type SunDeps } from "./service";
import { StoreSunCache } from "./storeCache";

const FIXED_NOW = new Date("2026-11-15T08:00:00Z");
const SERIES = Array.from({ length: 8760 }, (_, hour) => hour % 24);

describe("parseCacheKey", () => {
  it("reverses cacheKey", () => {
    expect(parseCacheKey(cacheKey("-7.75,110.25", 2025))).toEqual({ cellId: "-7.75,110.25", year: 2025 });
  });

  it("rejects text that is not a key", () => {
    expect(() => parseCacheKey("nonsense")).toThrow();
  });
});

describe("StoreSunCache", () => {
  it("writes a cell to the store and reads it back", async () => {
    const store = new MemoryStore();
    const cache = new StoreSunCache(store, () => FIXED_NOW);

    await cache.set(cacheKey("-7.75,110.25", 2025), { series: SERIES, year: 2025 });

    expect(await cache.get(cacheKey("-7.75,110.25", 2025))).toEqual({ series: SERIES, year: 2025 });
    expect(await store.getSunCache("-7.75,110.25", 2025)).toEqual({
      cellId: "-7.75,110.25",
      year: 2025,
      fetchedAt: FIXED_NOW.toISOString(),
      series: SERIES,
    });
  });

  it("misses a cell or a year it has not stored", async () => {
    const cache = new StoreSunCache(new MemoryStore());
    await cache.set(cacheKey("-7.75,110.25", 2025), { series: SERIES, year: 2025 });
    expect(await cache.get(cacheKey("-7.75,110.25", 2024))).toBeUndefined();
    expect(await cache.get(cacheKey("-6.25,106.75", 2025))).toBeUndefined();
  });

  it("lets a second service (a restarted server) reuse the first one's fetch", async () => {
    const store = new MemoryStore();
    let nasaCalls = 0;
    const deps = (): SunDeps => ({
      cache: new StoreSunCache(store),
      fetchFn: async () => {
        nasaCalls += 1;
        throw new TypeError("not expected in this test");
      },
      now: () => FIXED_NOW,
      timeoutMs: 1000,
      maxGapHours: 3,
      loadFallback: async () => {
        throw new Error("not expected in this test");
      },
    });
    // The first server fetched and stored the cell.
    await store.putSunCache({ cellId: "-7.75,110.25", year: 2025, fetchedAt: FIXED_NOW.toISOString(), series: SERIES });

    const result = await getSun(-7.7956, 110.3695, deps());

    expect(result).toEqual({ series: SERIES, source: "live", cellId: "-7.75,110.25", year: 2025 });
    expect(nasaCalls).toBe(0);
  });
});
