import { describe, expect, it } from "vitest";
import { CURRENT_ASSUMPTIONS, type AssumptionKey } from "../../engine/assumptions";
import { fractionToPercent, percentToFraction } from "./percent";

describe("percent conversion", () => {
  it("shows a fraction as percent", () => {
    expect(fractionToPercent(0.05)).toBe(5);
    expect(fractionToPercent(0.005)).toBe(0.5);
    expect(fractionToPercent(0.07)).toBe(7);
  });

  it("stores a typed percent as the exact fraction", () => {
    expect(percentToFraction(5)).toBe(0.05);
    expect(percentToFraction(0.5)).toBe(0.005);
    expect(percentToFraction(7)).toBe(0.07);
  });

  it("round-trips every share in the set without changing what is stored", () => {
    for (const key of Object.keys(CURRENT_ASSUMPTIONS.entries) as AssumptionKey[]) {
      const entry = CURRENT_ASSUMPTIONS.entries[key];
      for (const value of [entry.value, entry.min, entry.max]) {
        if (value === undefined) continue;
        expect(percentToFraction(fractionToPercent(value)), `${key} ${value}`).toBe(value);
      }
    }
  });
});
