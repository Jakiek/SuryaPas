// The contract every Store implementation must meet. It has no tests of its
// own: memory.test.ts runs it against MemoryStore, and
// supabase.contract.test.ts runs it against a real Supabase project.
import { describe, expect, it } from "vitest";
import {
  AssumptionSetConflictError,
  type NewAssessment,
  type Store,
} from "./types";

const sampleAssessment: NewAssessment = {
  locale: "id",
  inputs: {
    location: { latitude: -7.8, longitude: 110.37 },
    roof: { areaM2: 40, facing: "N" },
    electricity: { billing: "postpaid", powerClass: "R1_1300" },
  },
  overrides: { "tariff.R1_1300": 1500 },
  assumptionSetVersion: "v1",
  engineVersion: "0.1.0",
  sunSource: "live",
  result: { recommended: { panels: 8 }, paybackYears: [9, 12] },
};

// A fresh text per call, so tests against a shared real database do not
// trip over rows left by an earlier run.
function uniqueName(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function runStoreContract(label: string, makeStore: () => Store): void {
  describe(`Store contract: ${label}`, () => {
    describe("assessments", () => {
      it("saves an assessment and loads it back unchanged", async () => {
        const store = makeStore();
        const created = await store.createAssessment(sampleAssessment);
        const loaded = await store.getAssessment(created.id);

        expect(loaded).toEqual(created);
        expect(loaded).toMatchObject(sampleAssessment);
        expect(loaded?.ownerId).toBeNull();
        expect(Number.isNaN(Date.parse(created.createdAt))).toBe(false);
      });

      it("gives two created assessments different ids", async () => {
        const store = makeStore();
        const first = await store.createAssessment(sampleAssessment);
        const second = await store.createAssessment(sampleAssessment);

        expect(first.id).not.toBe(second.id);
        expect(await store.getAssessment(first.id)).toEqual(first);
        expect(await store.getAssessment(second.id)).toEqual(second);
      });

      it("returns null for an unknown id without throwing", async () => {
        const store = makeStore();
        // A well-formed id that was never issued, then ids that are not
        // well formed, then the reserved id from SPEC 5.1.
        const neverIssued = "A".repeat(22);
        for (const id of [neverIssued, "", "x", "example", "../etc/passwd"]) {
          await expect(store.getAssessment(id)).resolves.toBeNull();
        }
      });

      it("is not changed by later edits to the object that was passed in", async () => {
        const store = makeStore();
        const input = structuredClone(sampleAssessment);
        const created = await store.createAssessment(input);
        (input.result as Record<string, unknown>).recommended = "tampered";

        const loaded = await store.getAssessment(created.id);
        expect(loaded?.result).toEqual(sampleAssessment.result);
      });
    });

    describe("sun cache", () => {
      it("returns null for a cell that was never stored", async () => {
        const store = makeStore();
        expect(await store.getSunCache(uniqueName("cell"), 2025)).toBeNull();
      });

      it("stores a series and returns it", async () => {
        const store = makeStore();
        const entry = {
          cellId: uniqueName("cell"),
          year: 2025,
          fetchedAt: "2026-11-14T10:00:00.000Z",
          series: [0, 0, 120.5, 640],
        };
        await store.putSunCache(entry);
        expect(await store.getSunCache(entry.cellId, 2025)).toEqual(entry);
      });

      it("replaces the entry when the same cell and year is stored again", async () => {
        const store = makeStore();
        const cellId = uniqueName("cell");
        const base = { cellId, year: 2025 };
        await store.putSunCache({
          ...base,
          fetchedAt: "2026-01-01T00:00:00.000Z",
          series: [1, 2, 3],
        });
        await store.putSunCache({
          ...base,
          fetchedAt: "2026-06-01T00:00:00.000Z",
          series: [4, 5, 6],
        });

        const loaded = await store.getSunCache(cellId, 2025);
        expect(loaded?.series).toEqual([4, 5, 6]);
        expect(loaded?.fetchedAt).toBe("2026-06-01T00:00:00.000Z");
      });

      it("keeps different years of the same cell apart", async () => {
        const store = makeStore();
        const cellId = uniqueName("cell");
        const fetchedAt = "2026-11-14T10:00:00.000Z";
        await store.putSunCache({ cellId, year: 2024, fetchedAt, series: [1] });
        await store.putSunCache({ cellId, year: 2025, fetchedAt, series: [2] });

        expect((await store.getSunCache(cellId, 2024))?.series).toEqual([1]);
        expect((await store.getSunCache(cellId, 2025))?.series).toEqual([2]);
      });
    });

    describe("events", () => {
      it("records an event with and without an assessment id", async () => {
        const store = makeStore();
        const created = await store.createAssessment(sampleAssessment);

        await expect(
          store.recordEvent({ name: "result_viewed", assessmentId: created.id }),
        ).resolves.toBeUndefined();
        await expect(
          store.recordEvent({ name: "landing_viewed" }),
        ).resolves.toBeUndefined();
        await expect(
          store.recordEvent({ name: "landing_viewed", assessmentId: null }),
        ).resolves.toBeUndefined();
      });
    });

    describe("assumption sets", () => {
      it("stores a new version", async () => {
        const store = makeStore();
        await expect(
          store.upsertAssumptionSet({
            version: uniqueName("v"),
            entries: { "tariff.R1_1300": 1444.7 },
            note: "first cut",
          }),
        ).resolves.toBeUndefined();
      });

      it("accepts the same version again with the same entries", async () => {
        const store = makeStore();
        const version = uniqueName("v");
        const set = { version, entries: { a: 1, b: { c: 2 } }, note: "one" };
        await store.upsertAssumptionSet(set);
        // Same content with the keys written in another order, and a new note.
        await expect(
          store.upsertAssumptionSet({
            version,
            entries: { b: { c: 2 }, a: 1 },
            note: "two",
          }),
        ).resolves.toBeUndefined();
      });

      it("refuses to change the entries of an existing version", async () => {
        const store = makeStore();
        const version = uniqueName("v");
        await store.upsertAssumptionSet({ version, entries: { a: 1 }, note: "" });

        await expect(
          store.upsertAssumptionSet({ version, entries: { a: 2 }, note: "" }),
        ).rejects.toBeInstanceOf(AssumptionSetConflictError);
      });
    });
  });
}
