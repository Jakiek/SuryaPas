import { describe, expect, it } from "vitest";
import exampleHouse from "../../../data/example-house.json";
import type { Assessment } from "../../engine";
import { assessmentRequestSchema } from "../../lib/schema";
import { forgetUnsaved, readUnsaved, rememberUnsaved, UNSAVED_KEY } from "./unsavedStore";

function fakeStorage(initial: Record<string, string> = {}) {
  const kept = new Map(Object.entries(initial));
  return {
    kept,
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
    removeItem: (key: string) => void kept.delete(key),
  };
}

const request = assessmentRequestSchema.parse({ inputs: exampleHouse.inputs, overrides: {}, locale: "id" });
const assessment = { assumptionSetVersion: "v2", candidates: [] } as unknown as Assessment;

describe("the not-saved result kept for the tab", () => {
  it("is read back as it was remembered", () => {
    const storage = fakeStorage();
    expect(rememberUnsaved(storage, { request, assessment })).toBe(true);
    expect(readUnsaved(storage)).toEqual({ request, assessment });
  });

  it("leaves every other key alone, including when forgetting", () => {
    const storage = fakeStorage({ "suryapas.plan.v1": "{}" });
    rememberUnsaved(storage, { request, assessment });
    forgetUnsaved(storage);
    expect([...storage.kept.keys()]).toEqual(["suryapas.plan.v1"]);
  });

  it("reads as nothing when the text is damaged or has the wrong shape", () => {
    expect(readUnsaved(fakeStorage({ [UNSAVED_KEY]: "{" }))).toBeNull();
    expect(readUnsaved(fakeStorage({ [UNSAVED_KEY]: JSON.stringify({ request, assessment: {} }) }))).toBeNull();
    expect(readUnsaved(fakeStorage({ [UNSAVED_KEY]: JSON.stringify({ request: {}, assessment }) }))).toBeNull();
    expect(readUnsaved(null)).toBeNull();
  });

  it("reports false when storage refuses", () => {
    const refusing = { ...fakeStorage(), setItem: () => { throw new Error("full"); } };
    expect(rememberUnsaved(refusing, { request, assessment })).toBe(false);
  });
});
