import { describe, expect, it, vi } from "vitest";
import { MemorySunCache } from "./cache";
import yogyakartaResponse from "./fixtures/nasa-hourly-yogyakarta-2025.json";
import { loadFallbackFile } from "./fallback";
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

const nasaAnswers = () =>
  vi.fn(async () => Response.json(yogyakartaResponse)) as unknown as typeof fetch & {
    mock: { calls: unknown[][] };
  };

describe("live data", () => {
  it("returns a live series for the pin's grid cell", async () => {
    const fetchFn = nasaAnswers();
    const result = await getSun(-7.7956, 110.3695, makeDeps(fetchFn));
    expect(result.source).toBe("live");
    expect(result.year).toBe(2025);
    expect(result.cellId).toBe("-7.75,110.25");
    expect(result.series).toHaveLength(8760);
    // It asked about the centre of the cell, not the pin itself.
    const askedUrl = new URL(String(fetchFn.mock.calls[0][0]));
    expect(askedUrl.searchParams.get("latitude")).toBe("-7.75");
    expect(askedUrl.searchParams.get("longitude")).toBe("110.25");
  });

  it("serves a second point in the same cell from the cache, without asking NASA again", async () => {
    const fetchFn = nasaAnswers();
    const deps = makeDeps(fetchFn);
    const first = await getSun(-7.7956, 110.3695, deps); // Yogyakarta city centre
    const second = await getSun(-7.52, 110.01, deps); // elsewhere in the same cell
    expect(fetchFn.mock.calls).toHaveLength(1);
    expect(second.cellId).toBe(first.cellId);
    expect(second.source).toBe("live");
    expect(second.series).toEqual(first.series);
  });

  it("fetches again for a point in a different cell", async () => {
    const fetchFn = nasaAnswers();
    const deps = makeDeps(fetchFn);
    await getSun(-7.7956, 110.3695, deps);
    await getSun(-6.2088, 106.8456, deps); // Jakarta
    expect(fetchFn.mock.calls).toHaveLength(2);
  });

  it("does not reuse a cached year in a later year", async () => {
    const fetchFn = nasaAnswers();
    const cache = new MemorySunCache();
    await getSun(-7.7956, 110.3695, makeDeps(fetchFn, { cache }));
    await getSun(-7.7956, 110.3695, makeDeps(fetchFn, { cache, now: () => new Date("2027-03-01T00:00:00Z") }));
    expect(fetchFn.mock.calls).toHaveLength(2);
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

  it("does not cache a fallback, so live data is tried again next time", async () => {
    const blocked = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const deps = makeDeps(blocked);
    await getSun(-7.7956, 110.3695, deps);
    await getSun(-7.7956, 110.3695, deps);
    expect((blocked as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2);
  });
});
