import { describe, expect, it } from "vitest";
import { CURRENT_ASSUMPTIONS, applyOverrides, type AssumptionEntry, type AssumptionKey } from "../../engine/assumptions";
import { checkOverride, costOrderConflict, isShare, limitsOf } from "./overrideRules";
import { fractionToPercent } from "./percent";

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
    expect(checkOverride("90", overheadShare, "en").kind).toBe("outOfRange");
  });

  it("reads a share as percent and returns the stored fraction", () => {
    expect(checkOverride("8", overheadShare, "en")).toEqual({ kind: "ok", value: 0.08 });
    expect(checkOverride("0,5", CURRENT_ASSUMPTIONS.entries["finance.tariffEscalationPerYear"], "id")).toEqual({ kind: "ok", value: 0.005 });
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
        const typed = isShare(entry.unit) ? fractionToPercent(edge) : edge;
        expect(checkOverride(String(typed), entry, "en"), `${key} at ${edge}`).toEqual({ kind: "ok", value: edge });
        expect(() => applyOverrides(CURRENT_ASSUMPTIONS, { [key]: edge })).not.toThrow();
      }
    }
  });
});

describe("costOrderConflict", () => {
  const values: Record<string, number> = { "capex.perKwp.low": 11, "capex.perKwp.typical": 16, "capex.perKwp.high": 20 };
  const current = (key: AssumptionKey) => values[key];

  it("accepts values that keep low <= typical <= high, edges included", () => {
    expect(costOrderConflict("capex.perKwp.typical", 11, current)).toBeNull();
    expect(costOrderConflict("capex.perKwp.typical", 20, current)).toBeNull();
    expect(costOrderConflict("capex.perKwp.low", 5, current)).toBeNull();
  });

  it("names the neighbour a value collides with", () => {
    expect(costOrderConflict("capex.perKwp.low", 17, current)).toEqual({ neighbour: "capex.perKwp.typical", neighbourValue: 16, relation: "atMost" });
    expect(costOrderConflict("capex.perKwp.high", 15, current)).toEqual({ neighbour: "capex.perKwp.typical", neighbourValue: 16, relation: "atLeast" });
  });

  it("ignores entries that are not part of the range", () => {
    expect(costOrderConflict("bill.overheadShare", 99, current)).toBeNull();
  });
});
