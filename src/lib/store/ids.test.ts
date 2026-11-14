import { describe, expect, it } from "vitest";
import { generateAssessmentId, isWellFormedAssessmentId } from "./ids";

describe("generateAssessmentId", () => {
  it("uses only URL-safe characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(generateAssessmentId()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("carries at least 120 bits: 22 base64url characters hold 132", () => {
    // Each base64url character holds 6 bits. 22 x 6 = 132, of which the
    // generator fills 128 from 16 random bytes.
    const id = generateAssessmentId();
    expect(id).toHaveLength(22);
    expect(id.length * 6).toBeGreaterThanOrEqual(120);
  });

  it("does not repeat across a thousand ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, generateAssessmentId));
    expect(ids.size).toBe(1000);
  });

  it("is never the reserved id 'example'", () => {
    // "example" has 7 characters and generated ids have 22, so they cannot
    // collide; this documents the reason SPEC 5.1 can reserve it safely.
    expect(generateAssessmentId()).not.toBe("example");
  });
});

describe("isWellFormedAssessmentId", () => {
  it("accepts what the generator makes", () => {
    expect(isWellFormedAssessmentId(generateAssessmentId())).toBe(true);
  });

  it("rejects the wrong length, characters or the reserved id", () => {
    expect(isWellFormedAssessmentId("")).toBe(false);
    expect(isWellFormedAssessmentId("example")).toBe(false);
    expect(isWellFormedAssessmentId("A".repeat(21))).toBe(false);
    expect(isWellFormedAssessmentId("A".repeat(23))).toBe(false);
    expect(isWellFormedAssessmentId("A".repeat(21) + "/")).toBe(false);
    expect(isWellFormedAssessmentId("A".repeat(21) + "\n")).toBe(false);
  });
});
