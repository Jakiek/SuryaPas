import { beforeEach, describe, expect, it } from "vitest";
import exampleHouse from "../../../../data/example-house.json";
import { assess, CURRENT_ASSUMPTIONS, ENGINE_VERSION, type EngineInputs, type SunSeries } from "../../../engine";
import { MemoryStore } from "../../../lib/store/memory";
import { StoreError } from "../../../lib/store/types";
import { loadFallbackFile } from "../../../lib/sun/fallback";
import { forgetStoredVersions, handleCreateAssessment, type CreateAssessmentDeps } from "./handler";

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

  it("refuses inputs the form would refuse, without saving", async () => {
    const store = new MemoryStore();
    const noRoof = { ...INPUTS, roof: { ...INPUTS.roof, areaM2: -5 } };

    const response = await handleCreateAssessment(post({ inputs: noRoof, overrides: {}, locale: "id" }), deps(store));

    expect(response.status).toBe(400);
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

  it("answers 503 when saving fails, so the flow can offer a retry", async () => {
    const store = new MemoryStore();
    store.createAssessment = async () => {
      throw new StoreError("database down");
    };
    const response = await handleCreateAssessment(post({ inputs: INPUTS, overrides: {}, locale: "id" }), deps(store));
    expect(response.status).toBe(503);
  });
});
