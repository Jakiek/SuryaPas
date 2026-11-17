import { describe, expect, it } from "vitest";
import exampleHouse from "../../../data/example-house.json";
import { emptyDraft, type PlanDraft } from "../plan/draft";
import { hasSavedInputs, resumeStep } from "./resume";

const house = exampleHouse.inputs;

/** The example house as the flow would hold it once every step is answered. */
function completeDraft(step: PlanDraft["step"]): PlanDraft {
  return { ...emptyDraft(), step, ...(house as unknown as Partial<PlanDraft>) } as PlanDraft;
}

describe("hasSavedInputs", () => {
  it("is false for an untouched draft", () => {
    expect(hasSavedInputs(emptyDraft())).toBe(false);
  });

  it("is true once any answer is entered", () => {
    const base = emptyDraft();
    expect(hasSavedInputs({ ...base, location: { latitude: -7.8, longitude: 110.4 } })).toBe(true);
    expect(hasSavedInputs({ ...base, roof: { ...base.roof, slope: "flat" } })).toBe(true);
    expect(hasSavedInputs({ ...base, electricity: { ...base.electricity, monthlySpendRp: [null, 650_000] } })).toBe(true);
    expect(hasSavedInputs({ ...base, lifestyle: { ...base.lifestyle, daytimeAc: false } })).toBe(true);
  });
});

describe("resumeStep", () => {
  it("resumes the step the visitor was on when everything before it is complete", () => {
    expect(resumeStep(completeDraft(3))).toBe(3);
    expect(resumeStep(completeDraft(4))).toBe(4);
  });

  it("resumes the first incomplete step when the draft says a later one", () => {
    const draft: PlanDraft = { ...emptyDraft(), step: 3, location: { latitude: -7.8, longitude: 110.4 } };
    expect(resumeStep(draft)).toBe(2);
  });

  it("returns to step 1 for a draft with no location", () => {
    expect(resumeStep({ ...emptyDraft(), step: 4 })).toBe(1);
  });

  it("keeps a visitor who went back to an earlier step on that step", () => {
    expect(resumeStep(completeDraft(1))).toBe(1);
  });
});
