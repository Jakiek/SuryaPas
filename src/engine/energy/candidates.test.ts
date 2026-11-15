import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "../assumptions";
import type { RoofInput } from "../types";
import { kwpOfPanels, listCandidateSizes } from "./candidates";

const roof = (areaM2: number): RoofInput => ({ areaM2, usableFraction: 0.65, facing: "E", slope: "gentle", shade: "none" });

describe("kwpOfPanels", () => {
  it("four 550 W panels are 2.2 kWp", () => {
    expect(kwpOfPanels(4, ASSUMPTIONS_V1)).toBeCloseTo(2.2, 10);
  });
});

describe("listCandidateSizes", () => {
  it("a 48 m² roof holds 2 to 12 panels: 48 × 0.65 = 31.2 m², ÷ 2.6 m² each = 12", () => {
    const sizes = listCandidateSizes(roof(48), ASSUMPTIONS_V1);
    expect(sizes.minPanels).toBe(2); // 1 kWp needs two 0.55 kWp panels
    expect(sizes.maxPanels).toBe(12);
    expect(sizes.panelCounts).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it("a 4 m² roof is too small, and says the smallest system needs 8 m²", () => {
    const sizes = listCandidateSizes(roof(4), ASSUMPTIONS_V1);
    expect(sizes.panelCounts).toEqual([]);
    expect(sizes.requiredAreaM2).toBeCloseTo(8, 10); // 2 panels × 2.6 m² ÷ 0.65
  });
});
