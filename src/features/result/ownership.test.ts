import { describe, expect, it } from "vitest";
import exampleHouse from "../../../data/example-house.json";
import { buildRequest } from "../plan/submit";
import { emptyDraft } from "../plan/draft";
import { inputsFingerprint } from "./ownership";

describe("inputsFingerprint", () => {
  it("matches between the saved inputs and the draft that produced them", async () => {
    const inputs = exampleHouse.inputs;
    const draft = { ...emptyDraft(), step: 4 as const, ...structuredClone(inputs) };
    const request = buildRequest(draft as Parameters<typeof buildRequest>[0], "id");

    expect(request).not.toBeNull();
    expect(await inputsFingerprint(request!.inputs)).toBe(await inputsFingerprint(inputs));
  });

  it("differs when any answer differs, and ignores key order", async () => {
    const inputs = exampleHouse.inputs;
    const moved = { ...inputs, roof: { ...inputs.roof, areaM2: 49 } };
    expect(await inputsFingerprint(moved)).not.toBe(await inputsFingerprint(inputs));

    const reordered = { lifestyle: inputs.lifestyle, electricity: inputs.electricity, roof: inputs.roof, location: inputs.location };
    expect(await inputsFingerprint(reordered)).toBe(await inputsFingerprint(inputs));
  });

  it("does not contain the coordinates", async () => {
    const fingerprint = await inputsFingerprint(exampleHouse.inputs);
    expect(fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });
});
