import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1, ASSUMPTIONS_V2, CURRENT_ASSUMPTIONS, applyOverrides, valueOf } from "./index";
import type { AssumptionKey } from "./index";

describe("applyOverrides", () => {
  it("changes an adjustable value and leaves the original set untouched", () => {
    const changed = applyOverrides(ASSUMPTIONS_V1, { "capex.perKwp.typical": 14_000_000 });
    expect(valueOf(changed, "capex.perKwp.typical")).toBe(14_000_000);
    expect(valueOf(ASSUMPTIONS_V1, "capex.perKwp.typical")).toBe(16_000_000);
  });

  it("refuses to change a fixed value", () => {
    expect(() => applyOverrides(ASSUMPTIONS_V1, { "panel.wattPeak": 9999 })).toThrow();
  });

  it("refuses a value outside the allowed range", () => {
    expect(() => applyOverrides(ASSUMPTIONS_V1, { "capex.perKwp.typical": -1 })).toThrow();
    expect(() => applyOverrides(ASSUMPTIONS_V1, { "bill.overheadShare": 0.9 })).toThrow();
  });
});

describe.each([ASSUMPTIONS_V1, ASSUMPTIONS_V2])("assumption set version $version", (assumptions) => {
  it("gives every adjustable entry a range that contains its own value", () => {
    for (const [key, entry] of Object.entries(assumptions.entries)) {
      if (!entry.adjustable) continue;
      expect(entry.min, key).toBeDefined();
      expect(entry.max, key).toBeDefined();
      expect(entry.value, key).toBeGreaterThanOrEqual(entry.min as number);
      expect(entry.value, key).toBeLessThanOrEqual(entry.max as number);
    }
  });
});

describe("assumption set version 2 (PVGIS check, T07)", () => {
  it("is the version new assessments use", () => {
    expect(CURRENT_ASSUMPTIONS).toBe(ASSUMPTIONS_V2);
  });

  it("changes only the performance ratio and the orientation table", () => {
    expect(valueOf(ASSUMPTIONS_V2, "pv.performanceRatio")).toBe(0.75);
    expect(ASSUMPTIONS_V2.orientation.note.label).toBe("sourced");
    expect(ASSUMPTIONS_V2.orientation.table).toEqual({
      gentle: { towardEquator: 0.97, eastWest: 0.95, awayFromEquator: 0.9 },
      steep: { towardEquator: 0.85, eastWest: 0.84, awayFromEquator: 0.72 },
    });

    for (const key of Object.keys(ASSUMPTIONS_V1.entries) as AssumptionKey[]) {
      if (key === "pv.performanceRatio") continue;
      expect(ASSUMPTIONS_V2.entries[key], key).toEqual(ASSUMPTIONS_V1.entries[key]);
    }
    expect(ASSUMPTIONS_V2.powerClasses).toEqual(ASSUMPTIONS_V1.powerClasses);
    expect(ASSUMPTIONS_V2.batterySizesKwh).toEqual(ASSUMPTIONS_V1.batterySizesKwh);
  });

  it("leaves version 1 as it was released", () => {
    expect(ASSUMPTIONS_V1.version).toBe("1");
    expect(valueOf(ASSUMPTIONS_V1, "pv.performanceRatio")).toBe(0.78);
    expect(ASSUMPTIONS_V1.orientation.table.steep.awayFromEquator).toBe(0.88);
  });
});
