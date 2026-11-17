import { beforeEach, describe, expect, it } from "vitest";
import exampleHouse from "../../../../data/example-house.json";
import { assess, CURRENT_ASSUMPTIONS, ENGINE_VERSION, type EngineInputs, type SunSeries } from "../../../engine";
import { MemoryStore } from "../../../lib/store/memory";
import { StoreError } from "../../../lib/store/types";
import { loadFallbackFile } from "../../../lib/sun/fallback";
import { getSun, defaultDeps, type SunDeps } from "../../../lib/sun/service";
import { StoreSunCache } from "../../../lib/sun/storeCache";
import {
  forgetStoredVersions,
  handleCreateAssessment,
  MAX_REQUEST_BODY_BYTES,
  type CreateAssessmentDeps,
} from "./handler";

const INPUTS = exampleHouse.inputs as EngineInputs;

function post(body: unknown): Request {
  return new Request("http://localhost/api/assessments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function yogyakartaSun(): Promise<SunSeries> {
  const file = await loadFallbackFile("yogyakarta");
  return { ghiWm2: file.series, source: "live" };
}

function deps(store: MemoryStore): CreateAssessmentDeps {
  return { store, assumptions: CURRENT_ASSUMPTIONS, sunFor: () => yogyakartaSun() };
}

beforeEach(() => forgetStoredVersions());

describe("POST /api/assessments", () => {
  it("saves exactly what the engine returns for the same inputs, with its versions and sun source", async () => {
    const store = new MemoryStore();

    const response = await handleCreateAssessment(post({ inputs: INPUTS, overrides: {}, locale: "id" }), deps(store));

    expect(response.status).toBe(201);
    const { id } = (await response.json()) as { id: string };
    const saved = await store.getAssessment(id);
    const expected = assess(INPUTS, await yogyakartaSun(), CURRENT_ASSUMPTIONS);
    expect(saved?.result).toEqual(JSON.parse(JSON.stringify(expected)));
    expect(saved).toMatchObject({
      locale: "id",
      inputs: INPUTS,
      overrides: {},
      assumptionSetVersion: CURRENT_ASSUMPTIONS.version,
      engineVersion: ENGINE_VERSION,
      sunSource: "live",
    });
  });

  it("stores the assumption set the result names", async () => {
    const store = new MemoryStore();
    const versionsStored: string[] = [];
    const upsert = store.upsertAssumptionSet.bind(store);
    store.upsertAssumptionSet = async (set) => {
      versionsStored.push(set.version);
      return upsert(set);
    };

    await handleCreateAssessment(post({ inputs: INPUTS, overrides: {}, locale: "en" }), deps(store));

    expect(versionsStored).toEqual([CURRENT_ASSUMPTIONS.version]);
  });

  it("runs the engine with the user's changes and stores them beside the base version", async () => {
    const store = new MemoryStore();
    const overrides = { "finance.tariffEscalationPerYear": 0.03 };

    const response = await handleCreateAssessment(post({ inputs: INPUTS, overrides, locale: "id" }), deps(store));
    const saved = await store.getAssessment(((await response.json()) as { id: string }).id);

    expect(saved?.overrides).toEqual(overrides);
    expect(saved?.assumptionSetVersion).toBe(CURRENT_ASSUMPTIONS.version);
    const plain = assess(INPUTS, await yogyakartaSun(), CURRENT_ASSUMPTIONS);
    expect(saved?.result).not.toEqual(JSON.parse(JSON.stringify(plain)));
  });

  it("gives a different upfront cost when the cost per kWp is changed (the assumptions screen's resubmit)", async () => {
    const store = new MemoryStore();
    const save = async (overrides: Record<string, number>) => {
      const response = await handleCreateAssessment(post({ inputs: INPUTS, overrides, locale: "id" }), deps(store));
      const saved = await store.getAssessment(((await response.json()) as { id: string }).id);
      return saved?.result as unknown as ReturnType<typeof assess>;
    };

    const plain = await save({});
    const dearer = await save({ "capex.perKwp.typical": 25_000_000 });

    const firstSize = (result: ReturnType<typeof assess>) => result.candidates[0];
    expect(firstSize(dearer).withoutBattery.money.upfrontCostRp.typical).toBeCloseTo(firstSize(dearer).kwp * 25_000_000, 0);
    expect(firstSize(dearer).withoutBattery.money.upfrontCostRp.typical).not.toBe(
      firstSize(plain).withoutBattery.money.upfrontCostRp.typical,
    );
  });

  it("refuses inputs the form would refuse, without saving", async () => {
    const store = new MemoryStore();
    const noRoof = { ...INPUTS, roof: { ...INPUTS.roof, areaM2: -5 } };

    const response = await handleCreateAssessment(post({ inputs: noRoof, overrides: {}, locale: "id" }), deps(store));

    expect(response.status).toBe(400);
  });

  it("accepts a pin inside Indonesia and refuses one outside it, without saving", async () => {
    const store = new MemoryStore();
    const at = (latitude: number, longitude: number) =>
      handleCreateAssessment(post({ inputs: { ...INPUTS, location: { latitude, longitude } }, overrides: {}, locale: "id" }), deps(store));

    // Surabaya, then Kuala Lumpur (Malaysia).
    expect((await at(-7.2575, 112.7521)).status).toBe(201);
    const outside = await at(3.139, 101.6869);
    expect(outside.status).toBe(400);
    expect(await outside.json()).toEqual({ error: "outside_indonesia" });
  });

  it("refuses a change to an assumption that is not adjustable", async () => {
    const response = await handleCreateAssessment(
      post({ inputs: INPUTS, overrides: { "panel.wattPeak": 900 }, locale: "id" }),
      deps(new MemoryStore()),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_overrides" });
  });

  it("refuses broken JSON", async () => {
    expect((await handleCreateAssessment(post("{"), deps(new MemoryStore()))).status).toBe(400);
  });

  it("returns the result marked as not saved when the store cannot be written", async () => {
    const store = new MemoryStore();
    store.createAssessment = async () => {
      throw new StoreError("database down");
    };
    const response = await handleCreateAssessment(post({ inputs: INPUTS, overrides: {}, locale: "id" }), deps(store));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { saved: boolean; assessment: unknown; id?: string };
    expect(body.saved).toBe(false);
    expect(body.id).toBeUndefined();
    const expected = assess(INPUTS, await yogyakartaSun(), CURRENT_ASSUMPTIONS);
    expect(body.assessment).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  it("returns the result marked as not saved when the assumption set cannot be stored", async () => {
    const store = new MemoryStore();
    store.upsertAssumptionSet = async () => {
      throw new StoreError("database paused");
    };
    const response = await handleCreateAssessment(post({ inputs: INPUTS, overrides: {}, locale: "en" }), deps(store));

    expect(response.status).toBe(200);
    expect(((await response.json()) as { saved: boolean }).saved).toBe(false);
  });

  it("returns the result marked as not saved when the store cannot be read for sun data", async () => {
    // The real sun service over a store that throws on every call, with NASA
    // POWER unreachable: the cache misses, the bundled city file is used.
    const store = new MemoryStore();
    const broken = async () => {
      throw new StoreError("database paused");
    };
    store.getSunCache = broken;
    store.putSunCache = broken;
    store.createAssessment = broken;
    const sunDeps: SunDeps = {
      ...defaultDeps(new StoreSunCache(store)),
      fetchFn: async () => {
        throw new TypeError("offline");
      },
    };

    const response = await handleCreateAssessment(post({ inputs: INPUTS, overrides: {}, locale: "id" }), {
      store,
      assumptions: CURRENT_ASSUMPTIONS,
      sunFor: async (latitude, longitude) => {
        const sun = await getSun(latitude, longitude, sunDeps);
        return { ghiWm2: sun.series, source: sun.source };
      },
    });

    expect(response.status).toBe(200);
    const body = (await response.json()) as { saved: boolean; assessment: { candidates: unknown[] } };
    expect(body.saved).toBe(false);
    expect(body.assessment.candidates.length).toBeGreaterThan(0);
  });

  describe("request size limit", () => {
    /** The largest valid request: twelve months, every adjustable assumption changed to its own value, the longest numbers. */
    function largestValidRequest() {
      const overrides: Record<string, number> = {};
      for (const [key, entry] of Object.entries(CURRENT_ASSUMPTIONS.entries)) {
        if (entry.adjustable) overrides[key] = entry.value;
      }
      const bill = 1_234_567;
      const inputs = {
        ...INPUTS,
        location: { latitude: -7.123456789012345, longitude: 110.123456789012345 },
        roof: { ...INPUTS.roof, areaM2: 1999.123456789012, usableFraction: 0.123456789012345 },
        electricity: { ...INPUTS.electricity, monthlySpendRp: Array.from({ length: 12 }, () => bill) },
      };
      return { inputs, overrides, locale: "id" };
    }

    it("accepts the largest valid request, which is well under the limit", async () => {
      const body = JSON.stringify(largestValidRequest());
      expect(body.length).toBeLessThan(MAX_REQUEST_BODY_BYTES / 2);

      const response = await handleCreateAssessment(post(body), deps(new MemoryStore()));
      expect(response.status).toBe(201);
    });

    it("accepts a body exactly at the limit and refuses one a byte over, before parsing", async () => {
      const padded = (size: number) => "{".padEnd(size, " ");
      // At the limit: read in full, then refused as broken JSON (400), not as too large.
      const atLimit = await handleCreateAssessment(post(padded(MAX_REQUEST_BODY_BYTES)), deps(new MemoryStore()));
      expect(atLimit.status).toBe(400);

      const over = await handleCreateAssessment(post(padded(MAX_REQUEST_BODY_BYTES + 1)), deps(new MemoryStore()));
      expect(over.status).toBe(413);
      expect(await over.json()).toEqual({ error: "request_too_large" });
    });

    it("refuses on the declared Content-Length without reading the body", async () => {
      const request = new Request("http://localhost/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": String(MAX_REQUEST_BODY_BYTES + 1) },
        body: "{}",
      });
      expect((await handleCreateAssessment(request, deps(new MemoryStore()))).status).toBe(413);
    });
  });
});
