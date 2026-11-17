import { describe, expect, it, vi } from "vitest";
import { cacheKey, MemorySunCache } from "./cache";
import yogyakartaResponse from "./fixtures/nasa-hourly-yogyakarta-2025-utc.json";
import yogyakartaMonthlyResponse from "./fixtures/nasa-monthly-yogyakarta-2006-2025.json";
import { loadFallbackFile, readStoredFallbackFile } from "./fallback";
import { rotateUtcToLegalTime } from "./legalTime";
import { scaleToLongTerm, seriesIrradiation } from "./longTerm";
import { parseNasaHourly } from "./nasa";
import { parseNasaMonthly } from "./nasaMonthly";
import { DEFAULT_TIMEOUT_MS, defaultDeps, getSun, type SunDeps } from "./service";
import { PinOutsideIndonesiaError } from "../timezone/legalTimeZone";

// The sun service looks up the pin's legal time zone, which is "server-only";
// that package throws outside the Next.js server build, and tests are plain Node.
vi.mock("server-only", () => ({}));

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

/**
 * A request that never answers but obeys the abort signal, like the real fetch.
 * `asked` resolves once it has been called, which is after the time limit's
 * timer is set.
 */
function hangingUntilAborted() {
  let markAsked = () => {};
  const asked = new Promise<void>((resolve) => (markAsked = resolve));
  const answer = (init?: RequestInit) => {
    markAsked();
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
    });
  };
  return { answer, asked };
}

/**
 * Run `start` with timers faked, and once NASA has been asked, move the clock
 * past the service's real time limit. No test waits on a real timer, so the
 * result cannot depend on how busy the machine is.
 */
async function pastTheTimeLimit<T>(start: () => Promise<T>, asked: Promise<void>): Promise<T> {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  try {
    const pending = start();
    await asked;
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUT_MS);
    return await pending;
  } finally {
    vi.useRealTimers();
  }
}

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
    const hourly = askedUrls(fetchFn).find((url) => !isMonthly(url));
    expect(hourly?.searchParams.get("start")).toBe("20250101");
    expect(monthly?.searchParams.get("start")).toBe("2006");
    expect(monthly?.searchParams.get("end")).toBe("2025");
  });

  it("gives both requests the same year, whichever year the date selects", async () => {
    // On 30 June 2027 the year used is still 2025; from 1 July 2027 it is 2026 (SPEC 3.4).
    for (const [now, year] of [["2027-06-30T23:59:59Z", 2025], ["2027-07-01T00:00:00Z", 2026]] as const) {
      const fetchFn = nasaAnswers();
      await getSun(-7.7956, 110.3695, makeDeps(fetchFn, { now: () => new Date(now) }));
      const hourly = askedUrls(fetchFn).find((url) => !isMonthly(url));
      const monthly = askedUrls(fetchFn).find((url) => isMonthly(url));
      expect(hourly?.searchParams.get("start")).toBe(`${year}0101`);
      expect(hourly?.searchParams.get("end")).toBe(`${year}1231`);
      expect(monthly?.searchParams.get("start")).toBe(String(year - 19));
      expect(monthly?.searchParams.get("end")).toBe(String(year));
    }
  });

  it("returns the hourly year scaled to the long-term mean, and caches that scaled series in UTC", async () => {
    const fetchFn = nasaAnswers();
    const cache = new MemorySunCache();
    const result = await getSun(-7.7956, 110.3695, makeDeps(fetchFn, { cache }));
    const { series, scaling } = expectedScaled();
    // About 7% more sun than 2025 alone gave (docs/VALIDATION.md).
    expect(scaling.factor).toBeGreaterThan(1.06);
    // Yogyakarta is on WIB, UTC+7: the scaled UTC year, moved seven hours.
    expect(result.utcOffsetHours).toBe(7);
    expect(result.series).toEqual(rotateUtcToLegalTime(series, 7));
    expect(seriesIrradiation(result.series)).toBeCloseTo(scaling.meanKwhPerM2, 6);
    // The cache holds the scaled series in UTC, not the raw year.
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
    // From 1 July 2027 the year used is 2026 (SPEC 3.4), so the cached 2025 must not be reused.
    await getSun(-7.7956, 110.3695, makeDeps(fetchFn, { cache, now: () => new Date("2027-07-01T00:00:00Z") }));
    expect(fetchFn.mock.calls).toHaveLength(4);
  });
});

/** The clock hour (0 to 23) of the brightest hour of the year's mean day. */
function brightestClockHour(series: number[]): number {
  const meanDay = Array.from({ length: 24 }, () => 0);
  series.forEach((watts, hour) => (meanDay[hour % 24] += watts));
  return meanDay.indexOf(Math.max(...meanDay));
}

describe("the pin's legal time (SPEC 3.4)", () => {
  // The recorded Yogyakarta year is the live series for every pin below; only
  // the clock it is read on differs. Its mean day is brightest from 04:00 to
  // 05:00 UTC.
  const UTC_BRIGHTEST_HOUR = brightestClockHour(expectedScaled().series);

  it("asks NASA in UTC", async () => {
    const fetchFn = nasaAnswers();
    await getSun(-7.7956, 110.3695, makeDeps(fetchFn));
    const hourly = askedUrls(fetchFn).find((url) => !isMonthly(url));
    expect(hourly?.searchParams.get("time-standard")).toBe("UTC");
    expect(UTC_BRIGHTEST_HOUR).toBe(4);
  });

  // Each row: pin, its legal offset (from the real province lookup), and the
  // offset of NASA's own "LST" at the pin's cell before T20, read from the
  // live API on 2026-11-17 (NASA's LST follows its 1° source grid, so its
  // zone edges fall at 98°, 113° and 128° E).
  it.each([
    ["Jakarta", -6.2088, 106.8456, 7, 7],
    ["Surabaya", -7.2575, 112.7521, 7, 7],
    ["Banyuwangi", -8.22, 114.37, 7, 8],
    ["Banda Aceh", 5.55, 95.32, 7, 6],
    ["Denpasar", -8.65, 115.22, 8, 8],
    ["Ternate", 0.79, 127.38, 9, 8],
  ] as const)("reads the sun on %s's clock", async (_place, lat, lon, legalOffset, nasaLstOffset) => {
    const result = await getSun(lat, lon, makeDeps(nasaAnswers()));
    expect(result.utcOffsetHours).toBe(legalOffset);
    const clockHour = brightestClockHour(result.series);
    expect(clockHour).toBe(UTC_BRIGHTEST_HOUR + legalOffset);
    // Before T20 the same sun was read on NASA's LST clock; the change is the
    // difference of the two offsets: none at Jakarta and Surabaya, an hour
    // earlier at Banyuwangi, an hour later at Banda Aceh and Ternate.
    const clockHourBefore = UTC_BRIGHTEST_HOUR + nasaLstOffset;
    expect(clockHour - clockHourBefore).toBe(legalOffset - nasaLstOffset);
  });

  it("serves one cached cell on two clocks: Banyuwangi (WIB) and Gilimanuk (WITA) share a cell", async () => {
    const fetchFn = nasaAnswers();
    const deps = makeDeps(fetchFn);
    const banyuwangi = await getSun(-8.13, 114.39, deps); // Ketapang harbour, East Java
    const gilimanuk = await getSun(-8.17, 114.44, deps); // across the strait, Bali
    expect(gilimanuk.cellId).toBe(banyuwangi.cellId);
    expect(fetchFn.mock.calls).toHaveLength(2); // one fetch for both
    expect([banyuwangi.utcOffsetHours, gilimanuk.utcOffsetHours]).toEqual([7, 8]);
    // The same UTC year, Bali's clock one hour further on.
    expect(gilimanuk.series).toEqual(rotateUtcToLegalTime(banyuwangi.series, 1));
  });

  it("moves the fallback to the pin's clock, not the nearest city's", async () => {
    const blocked = (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch;
    // Genteng, Banyuwangi (WIB), is nearest Denpasar (WITA).
    const result = await getSun(-8.37, 114.15, makeDeps(blocked));
    const denpasarUtc = await readStoredFallbackFile("denpasar");
    expect(result.fallbackCityId).toBe("denpasar");
    expect(result.utcOffsetHours).toBe(7);
    expect(result.series).toEqual(rotateUtcToLegalTime(denpasarUtc.series, 7));
  });

  it("uses an injected zone lookup, so a test can choose the clock", async () => {
    const result = await getSun(-7.7956, 110.3695, makeDeps(nasaAnswers(), { legalUtcOffsetHours: () => 9 }));
    expect(result.series).toEqual(rotateUtcToLegalTime(expectedScaled().series, 9));
  });

  it("refuses a pin with no legal time zone before asking NASA", async () => {
    const fetchFn = nasaAnswers();
    await expect(getSun(1.35, 103.82, makeDeps(fetchFn))).rejects.toThrow(PinOutsideIndonesiaError); // Singapore
    expect(fetchFn.mock.calls).toHaveLength(0);
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
    const { answer, asked } = hangingUntilAborted();
    const hanging = ((_url: unknown, init?: RequestInit) => answer(init)) as typeof fetch;
    const result = await pastTheTimeLimit(() => getSun(-8.65, 115.2, makeDeps(hanging)), asked);
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
    async function expectFallback(monthly: Answer, asked?: Promise<void>) {
      const cache = new MemorySunCache();
      const ask = () => getSun(-7.7956, 110.3695, makeDeps(nasaAnswers(monthly), { cache }));
      const result = asked ? await pastTheTimeLimit(ask, asked) : await ask();
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
      // The hourly request answers at once; the monthly one never does.
      const { answer, asked } = hangingUntilAborted();
      await expectFallback(answer, asked);
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
