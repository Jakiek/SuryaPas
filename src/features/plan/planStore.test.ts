import { describe, expect, it } from "vitest";
import { emptyDraft, type PlanDraft } from "./draft";
import {
  createPlanStore,
  readSavedDraft,
  STORAGE_KEY,
  type StorageLike,
} from "./planStore";

/** A storage held in a Map, standing in for localStorage. */
function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

function filledDraft(): PlanDraft {
  const draft = emptyDraft();
  draft.step = 3;
  draft.electricity = {
    billing: "prepaid",
    connectedVa: 900,
    subsidised: true,
    monthlySpendRp: [150000, 175000],
  };
  return draft;
}

describe("plan store", () => {
  it("restores the step and every value after a reload", () => {
    const storage = fakeStorage();
    createPlanStore(() => storage).set(filledDraft());

    // A new store over the same storage is what a refreshed page sees.
    const afterReload = createPlanStore(() => storage).getSnapshot();
    expect(afterReload).toEqual(filledDraft());
  });

  it("saves on every change and tells subscribers", () => {
    const storage = fakeStorage();
    const store = createPlanStore(() => storage);
    let notified = 0;
    store.subscribe(() => notified++);
    store.set(filledDraft());
    expect(notified).toBe(1);
    expect(storage.data.has(STORAGE_KEY)).toBe(true);
  });

  it("keeps working from memory when storage throws", () => {
    const blocked: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    const store = createPlanStore(() => blocked);
    expect(store.getSnapshot()).toEqual(emptyDraft());
    store.set(filledDraft());
    expect(store.getSnapshot().step).toBe(3);
  });

  it("works with no storage at all", () => {
    const store = createPlanStore(() => null);
    store.set(filledDraft());
    expect(store.getSnapshot().electricity.billing).toBe("prepaid");
  });

  it("ignores text that is not a draft", () => {
    const storage = fakeStorage();
    storage.data.set(STORAGE_KEY, "{not json");
    expect(readSavedDraft(storage)).toBeNull();
    storage.data.set(STORAGE_KEY, "42");
    expect(readSavedDraft(storage)).toBeNull();
  });

  it("fills in fields an older saved draft did not have", () => {
    const storage = fakeStorage();
    storage.data.set(STORAGE_KEY, JSON.stringify({ step: 2 }));
    const restored = readSavedDraft(storage);
    expect(restored?.step).toBe(2);
    expect(restored?.electricity.monthlySpendRp).toEqual([null]);
  });

  it("returns the same object until something changes", () => {
    const store = createPlanStore(() => fakeStorage());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("resets a connected-power pair the select does not offer", () => {
    const storage = fakeStorage();
    const saved = emptyDraft();
    saved.electricity = { ...saved.electricity, connectedVa: 2200, subsidised: true };
    storage.data.set(STORAGE_KEY, JSON.stringify(saved));
    const restored = readSavedDraft(storage);
    expect(restored?.electricity.connectedVa).toBeNull();
    expect(restored?.electricity.subsidised).toBe(false);
  });

  it("drops values of the wrong kind but keeps empty fields and good ones", () => {
    const storage = fakeStorage();
    const saved = {
      step: 2,
      location: { latitude: 500, longitude: 110.3 },
      roof: { slope: "sideways", shade: "some", areaM2: 48 },
      lifestyle: { daytimeAc: "yes", workFromHome: true },
    };
    storage.data.set(STORAGE_KEY, JSON.stringify(saved));
    const restored = readSavedDraft(storage);
    expect(restored?.location).toEqual({ latitude: null, longitude: 110.3 });
    expect(restored?.roof.slope).toBeNull();
    expect(restored?.roof.shade).toBe("some");
    expect(restored?.roof.areaM2).toBe(48);
    expect(restored?.lifestyle.daytimeAc).toBeNull();
    expect(restored?.lifestyle.workFromHome).toBe(true);
    expect(restored?.lifestyle.homeOnWeekdays).toBeNull();
  });
});
