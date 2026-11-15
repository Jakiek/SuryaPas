import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1, applyOverrides, valueOf } from "./index";

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

describe("assumption set version 1", () => {
  it("gives every adjustable entry a range that contains its own value", () => {
    for (const [key, entry] of Object.entries(ASSUMPTIONS_V1.entries)) {
      if (!entry.adjustable) continue;
      expect(entry.min, key).toBeDefined();
      expect(entry.max, key).toBeDefined();
      expect(entry.value, key).toBeGreaterThanOrEqual(entry.min as number);
      expect(entry.value, key).toBeLessThanOrEqual(entry.max as number);
    }
  });
});
