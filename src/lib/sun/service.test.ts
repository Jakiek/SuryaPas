import { describe, expect, it, vi } from "vitest";
import { cacheKey, MemorySunCache } from "./cache";
import yogyakartaResponse from "./fixtures/nasa-hourly-yogyakarta-2025.json";
import yogyakartaMonthlyResponse from "./fixtures/nasa-monthly-yogyakarta-2006-2025.json";
import { loadFallbackFile } from "./fallback";
import { scaleToLongTerm, seriesIrradiation } from "./longTerm";
import { parseNasaHourly } from "./nasa";
import { parseNasaMonthly } from "./nasaMonthly";
import { defaultDeps, getSun, type SunDeps } from "./service";

const FIXED_NOW = new Date("2026-11-14T10:00:00Z"); // so the target year is 2025

function makeDeps(fetchFn: typeof fetch, overrides: Partial<SunDeps> = {}): SunDeps {
  return {
    ...defaultDeps(new MemorySunCache()),
    fetchFn,
    now: () => FIXED_NOW,
    ...overrides,
  };
}

const isMonthly = (url: unknown) => String(url).includes("/temporal/monthly/");

/** A fake NASA POWER: the recorded hourly year and the recorded monthly record.
 *  `monthly` replaces the monthly answer, to make that one request fail. */
type Answer = (init?: RequestInit) => Promise<Response>;
const nasaAnswers = (monthly: Answer = async () => Response.json(yogyakartaMonthlyResponse)) =>
  vi.fn(async (url: unknown, init?: RequestInit) =>
    isMonthly(url) ? monthly(init) : Response.json(yogyakartaResponse),
  ) as unknown as typeof fetch & {
    mock: { calls: unknown[][] };
  };

/** What the service should hand over for the recorded cell: 2025 scaled to 2006–2025. */
const expectedScaled = () =>
  scaleToLongTerm(parseNasaHourly(yogyakartaResponse, 2025, 3), parseNasaMonthly(yogyakartaMonthlyResponse, 2006, 2025), 2025);

const askedUrls = (fetchFn: { mock: { calls: unknown[][] } }) => fetchFn.mock.calls.map((call) => new URL(String(call[0])));

describe("live data", () => {
  it("returns a live series for the pin's grid cell", async () => {
    const fetchFn = nasaAnswers();
    const result = await getSun(-7.7956, 110.3695, makeDeps(fetchFn));
    expect(result.source).toBe("live");
    expect(result.year).toBe(2025);
    expect(result.cellId).toBe("-7.75,110.25");
    expect(result.series).toHaveLength(8760);
    // It asked about the centre of the cell, not the pin itself, in both requests.
    const urls = askedUrls(fetchFn);
    expect(urls).toHaveLength(2);
    for (const url of urls) {
      expect(url.searchParams.get("latitude")).toBe("-7.75");
      expect(url.searchParams.get("longitude")).toBe("110.25");
    }
  });

  it("asks for the monthly record of the twenty years ending with the hourly year", async () => {
    const fetchFn = nasaAnswers();
    await getSun(-7.7956, 110.3695, makeDeps(fetchFn));
    const monthly = askedUrls(fetchFn).find((url) => isMonthly(url));
    expect(monthly?.searchParams.get("start")).toBe("2006");
    expect(monthly?.searchParams.get("end")).toBe("2025");
  });

  it("returns the hourly year scaled to the long-term mean, and caches that scaled series", async () => {
    const fetchFn = nasaAnswers();
    const cache = new MemorySunCache();
    const result = await getSun(-7.7956, 110.3695, makeDeps(fetchFn, { cache }));
    const { series, scaling } = expectedScaled();
    // About 7% more sun than 2025 alone gave (docs/VALIDATION.md).
    expect(scaling.factor).toBeGreaterThan(1.06);
    expect(result.series).toEqual(series);
    expect(seriesIrradiation(result.series)).toBeCloseTo(scaling.meanKwhPerM2, 6);
    // The cache holds the scaled series, not the raw year.
    const cached = await cache.get(cacheKey("-7.75,110.25", 2025));
    expect(cached?.series).toEqual(series);
    expect(cached?.series).not.toEqual(parseNasaHourly(yogyakartaResponse, 2025, 3));
  });

  it("serves a second point in the same cell from the cache, without asking NASA again", async () => {
    const fetchFn = nasaAnswers();
    const deps = makeDeps(fetchFn);
    const first = await getSun(-7.7956, 110.3695, deps); // Yogyakarta city centre
    const second = await getSun(-7.52, 110.01, deps); // elsewhere in the same cell
    expect(fetchFn.mock.calls).toHaveLength(2); // the hourly and the monthly request, once
    expect(second.cellId).toBe(first.cellId);
    expect(second.source).toBe("live");
    expect(second.series).toEqual(first.series);
  });

  it("fetches again for a point in a different cell", async () => {
    const fetchFn = nasaAnswers();
    const deps = makeDeps(fetchFn);
    await getSun(-7.7956, 110.3695, deps);
    await getSun(-6.2088, 106.8456, deps); // Jakarta
    expect(fetchFn.mock.calls).toHaveLength(4);
  });

  it("does not reuse a cached year in a later year", async () => {
    const fetchFn = nasaAnswers();
    const cache = new MemorySunCache();
    await getSun(-7.7956, 110.3695, makeDeps(fetchFn, { cache }));
    await getSun(-7.7956, 110.3695, makeDeps(fetchFn, { cache, now: () => new Date("2027-03-01T00:00:00Z") }));
    expect(fetchFn.mock.calls).toHaveLength(4);
  });
});

describe("fallback", () => {
  it("uses the nearest city's bundled series when the network is blocked", async () => {
    const blocked = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const result = await getSun(-7.72, 110.4, makeDeps(blocked)); // Sleman, near Yogyakarta
    const yogyakarta = await loadFallbackFile("yogyakarta");
    expect(result.source).toBe("fallback");
    expect(result.fallbackCityId).toBe("yogyakarta");
    expect(result.series).toEqual(yogyakarta.series);
    expect(result.year).toBe(yogyakarta.year);
  });

  it("uses the fallback when NASA is slower than the time limit", async () => {
    const hanging = ((_url: unknown, init?: RequestInit) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const result = await getSun(-8.65, 115.2, makeDeps(hanging, { timeoutMs: 20 }));
    expect(result.source).toBe("fallback");
    expect(result.fallbackCityId).toBe("denpasar");
  });

  it("uses the fallback when NASA answers with an error or nonsense", async () => {
    const serverError = (async () => new Response("down", { status: 503 })) as typeof fetch;
    const nonsense = (async () => Response.json({ hello: "world" })) as typeof fetch;
    expect((await getSun(3.6, 98.7, makeDeps(serverError))).source).toBe("fallback");
    expect((await getSun(3.6, 98.7, makeDeps(nonsense))).source).toBe("fallback");
  });

  describe("when only the monthly request fails", () => {
    async function expectFallback(monthly: Answer, extra: Partial<SunDeps> = {}) {
      const cache = new MemorySunCache();
      const result = await getSun(-7.7956, 110.3695, makeDeps(nasaAnswers(monthly), { cache, ...extra }));
      const yogyakarta = await loadFallbackFile("yogyakarta");
      expect(result.source).toBe("fallback");
      expect(result.fallbackCityId).toBe("yogyakarta");
      expect(result.series).toEqual(yogyakarta.series);
      // The good hourly year was not cached unscaled.
      expect(await cache.get(cacheKey("-7.75,110.25", 2025))).toBeUndefined();
    }

    it("uses the fallback when the monthly request answers with an error", async () => {
      await expectFallback(async () => new Response("down", { status: 503 }));
    });

    it("uses the fallback when the monthly request is blocked", async () => {
      await expectFallback(async () => {
        throw new TypeError("fetch failed");
      });
    });

    it("uses the fallback when the monthly request outlasts the shared time limit", async () => {
      // The hourly request answers at once; the monthly one never does, but
      // obeys the abort signal like the real fetch.
      const hanging: Answer = (init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      await expectFallback(hanging, { timeoutMs: 20 });
    });

    it("uses the fallback when the record has fewer than ten complete years", async () => {
      // Keep the response's shape but mark every month before 2017 missing: nine years remain.
      const values = { ...yogyakartaMonthlyResponse.properties.parameter.ALLSKY_SFC_SW_DWN } as Record<string, number>;
      for (const key of Object.keys(values)) if (Number(key.slice(0, 4)) < 2017) values[key] = -999;
      const thin = { ...yogyakartaMonthlyResponse, properties: { parameter: { ALLSKY_SFC_SW_DWN: values } } };
      await expectFallback(async () => Response.json(thin));
    });
  });

  it("does not cache a fallback, so live data is tried again next time", async () => {
    const blocked = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const deps = makeDeps(blocked);
    await getSun(-7.7956, 110.3695, deps);
    await getSun(-7.7956, 110.3695, deps);
    // Two requests per try, two tries.
    expect((blocked as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(4);
  });
});
