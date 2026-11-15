import { describe, expect, it } from "vitest";
import { emptyDraft } from "./draft";
import { firstInvalidStep } from "./validate";

describe("firstInvalidStep", () => {
  it("points at the location when step 4 was restored over an empty draft", () => {
    const draft = emptyDraft();
    draft.step = 4;
    expect(firstInvalidStep(draft)).toBe(1);
  });

  it("is null when every step passes", () => {
    const draft = emptyDraft();
    draft.location = { latitude: -7.78, longitude: 110.37 };
    draft.roof = { ...draft.roof, areaM2: 48, facing: "E", slope: "gentle", shade: "none" };
    draft.electricity = { billing: "postpaid", connectedVa: 2200, subsidised: false, monthlySpendRp: [650000] };
    draft.lifestyle = { homeOnWeekdays: true, daytimeAc: false, workFromHome: true, electricVehicle: false };
    expect(firstInvalidStep(draft)).toBeNull();
  });
});
