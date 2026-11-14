import { describe, expect, it } from "vitest";
import { MemoryStore } from "./memory";
import { runStoreContract } from "./store.contract";

runStoreContract("MemoryStore", () => new MemoryStore());

// Behaviour the Store interface cannot show, because it has no way to list
// events or read an assumption set back.
describe("MemoryStore extras", () => {
  const fixedClock = () => new Date("2026-11-14T10:00:00.000Z");

  it("stamps assessments and events with the clock it was given", async () => {
    const store = new MemoryStore(fixedClock);
    const created = await store.createAssessment({
      locale: "en",
      inputs: {},
      overrides: {},
      assumptionSetVersion: "v1",
      engineVersion: "0.1.0",
      sunSource: "fallback",
      result: {},
    });
    await store.recordEvent({ name: "plan_started" });

    expect(created.createdAt).toBe("2026-11-14T10:00:00.000Z");
    expect(store.listEvents()).toEqual([
      {
        name: "plan_started",
        assessmentId: null,
        createdAt: "2026-11-14T10:00:00.000Z",
      },
    ]);
  });

  it("keeps the newest note when the same set is stored again", async () => {
    const store = new MemoryStore(fixedClock);
    await store.upsertAssumptionSet({ version: "v1", entries: { a: 1 }, note: "old" });
    await store.upsertAssumptionSet({ version: "v1", entries: { a: 1 }, note: "new" });
    expect(store.getAssumptionSet("v1")?.note).toBe("new");
  });

  it("does not share data between two stores", async () => {
    const one = new MemoryStore();
    const two = new MemoryStore();
    const created = await one.createAssessment({
      locale: "id",
      inputs: {},
      overrides: {},
      assumptionSetVersion: "v1",
      engineVersion: "0.1.0",
      sunSource: "live",
      result: {},
    });
    expect(await two.getAssessment(created.id)).toBeNull();
  });
});
