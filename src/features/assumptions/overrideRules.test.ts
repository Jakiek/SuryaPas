import { describe, expect, it } from "vitest";
import { CURRENT_ASSUMPTIONS, applyOverrides, type AssumptionEntry, type AssumptionKey } from "../../engine/assumptions";
import { checkOverride, limitsOf } from "./overrideRules";

const typicalCost = CURRENT_ASSUMPTIONS.entries["capex.perKwp.typical"];
const overheadShare = CURRENT_ASSUMPTIONS.entries["bill.overheadShare"];

describe("checkOverride", () => {
  it("accepts a value inside the entry's own range", () => {
    expect(checkOverride("18.000.000", typicalCost, "id")).toEqual({ kind: "ok", value: 18_000_000 });
  });

  it("rejects a value below the range and reports the limits", () => {
    const result = checkOverride("1.000", typicalCost, "id");
    expect(result).toEqual({ kind: "outOfRange", limits: { min: typicalCost.min, max: typicalCost.max } });
  });

  it("rejects a share above its maximum", () => {
    expect(checkOverride("0.9", overheadShare, "en").kind).toBe("outOfRange");
  });

  it("tells empty text and non-numbers apart from out-of-range numbers", () => {
    expect(checkOverride("  ", typicalCost, "en").kind).toBe("empty");
    expect(checkOverride("lots", typicalCost, "en").kind).toBe("notANumber");
  });

  it("falls back to what the value is when an entry carries no limits", () => {
    const share: AssumptionEntry = { ...overheadShare, min: undefined, max: undefined };
    expect(limitsOf(share)).toEqual({ min: 0, max: 1 });
    const price: AssumptionEntry = { ...typicalCost, min: undefined, max: undefined };
    expect(limitsOf(price)).toEqual({ min: 0, max: undefined });
  });

  it("only accepts values that the engine itself accepts", () => {
    // Every adjustable entry: the edges of its range pass this screen's check and applyOverrides.
    const keys = Object.keys(CURRENT_ASSUMPTIONS.entries) as AssumptionKey[];
    for (const key of keys) {
      const entry = CURRENT_ASSUMPTIONS.entries[key];
      if (!entry.adjustable) continue;
      const { min, max } = limitsOf(entry);
      for (const edge of [min, max]) {
        if (edge === undefined) continue;
        expect(checkOverride(String(edge), entry, "en").kind, `${key} at ${edge}`).toBe("ok");
        expect(() => applyOverrides(CURRENT_ASSUMPTIONS, { [key]: edge })).not.toThrow();
      }
    }
  });
});
