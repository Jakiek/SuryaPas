import { describe, expect, it } from "vitest";
import exampleHouse from "../../../data/example-house.json";
import { assess, CURRENT_ASSUMPTIONS, type EngineInputs, type SunSeries } from "../../engine";
import { loadFallbackFile } from "../../lib/sun/fallback";
import {
  candidateFor,
  compareWithRecommended,
  horizonYears,
  MAX_PICKER_PANELS,
  pickerSlots,
  toResultView,
  verdictsFor,
  type ResultView,
} from "./view";

const HOUSE = exampleHouse.inputs as EngineInputs;

async function viewFor(inputs: EngineInputs, source: SunSeries["source"] = "live"): Promise<ResultView> {
  const sun = await loadFallbackFile("yogyakarta");
  return toResultView(assess(inputs, { ghiWm2: sun.series, source }, CURRENT_ASSUMPTIONS));
}

function recommended(view: ResultView) {
  return candidateFor(view, view.recommendedPanels!);
}

describe("toResultView", () => {
  it("copies the engine's numbers unchanged", async () => {
    const sun = await loadFallbackFile("yogyakarta");
    const assessment = assess(HOUSE, { ghiWm2: sun.series, source: "live" }, CURRENT_ASSUMPTIONS);
    const view = toResultView(assessment);

    expect(view.recommendedPanels).toBe(assessment.recommendedPanels);
    view.candidates.forEach((candidate, index) => {
      const engine = assessment.candidates[index];
      expect(candidate.kwp).toBe(engine.kwp);
      expect(candidate.withoutBattery.upfrontCostRp).toEqual(engine.withoutBattery.money.upfrontCostRp);
      expect(candidate.withoutBattery.paybackYears).toEqual(engine.withoutBattery.money.paybackYears);
      expect(candidate.withoutBattery.netSavingsRp).toBe(engine.withoutBattery.money.netSavingsRp);
      expect(candidate.withoutBattery.exportedKwh).toBe(engine.withoutBattery.energy.exportedKwh);
      expect(candidate.withBattery?.batteryKwh).toBe(engine.withBattery?.batteryKwh);
      expect(candidate.withBattery?.upfrontCostRp).toEqual(engine.withBattery?.money.upfrontCostRp);
    });
    expect(horizonYears(view)).toBe(CURRENT_ASSUMPTIONS.entries["finance.horizonYears"].value);
  });
});

describe("honest verdicts, each for an input that triggers it", () => {
  it("the example house gets none", async () => {
    const view = await viewFor(HOUSE);
    expect(verdictsFor(view, recommended(view))).toEqual([]);
  });

  it("a subsidised 450 VA home: does not pay back", async () => {
    const view = await viewFor({
      ...HOUSE,
      electricity: { billing: "prepaid", connectedVa: 450, subsidised: true, monthlySpendRp: [60_000] },
    });
    expect(view.flags.doesNotPayBack).toBe(true);
    expect(verdictsFor(view, recommended(view))).toContain("doesNotPayBack");
  });

  it("heavy shade: an installer must visit", async () => {
    const view = await viewFor({ ...HOUSE, roof: { ...HOUSE.roof, shade: "heavy" } });
    expect(verdictsFor(view, recommended(view))).toContain("heavyShade");
  });

  it("fallback sun data: approximate", async () => {
    const view = await viewFor(HOUSE, "fallback");
    expect(verdictsFor(view, recommended(view))).toEqual(["approximate"]);
  });

  it("a 4 m² roof: too small, with the area the smallest system needs", async () => {
    const view = await viewFor({ ...HOUSE, roof: { ...HOUSE.roof, areaM2: 4 } });
    expect(view.candidates).toEqual([]);
    expect(view.recommendedPanels).toBeNull();
    // 2 panels × 2.6 m² ÷ 0.65 usable = 8 m² of roof.
    expect(view.roofTooSmall?.requiredAreaM2).toBeCloseTo(8, 6);
    expect(pickerSlots(view)).toEqual([]);
  });

  it("judges the size the user picked, not only the recommended one", async () => {
    const view = await viewFor(HOUSE);
    const largest = view.candidates[view.candidates.length - 1];
    expect(largest.withoutBattery.paybackYears.typical).toBeNull();
    expect(verdictsFor(view, largest)).toEqual(["sizeDoesNotPayBack"]);
  });
});

describe("pickerSlots", () => {
  it("runs from one to the most the roof holds, with counts below the smallest system disabled", async () => {
    const view = await viewFor(HOUSE);
    const slots = pickerSlots(view);
    expect(slots[0]).toEqual({ panels: 1, selectable: false });
    expect(slots[1]).toEqual({ panels: 2, selectable: true });
    expect(slots[slots.length - 1].panels).toBe(view.candidates[view.candidates.length - 1].panels);
  });

  it("shows at most twelve, and keeps a recommendation above twelve in view", async () => {
    const big = await viewFor({
      ...HOUSE,
      roof: { ...HOUSE.roof, areaM2: 200 },
      electricity: { ...HOUSE.electricity, connectedVa: 16_500, monthlySpendRp: [6_000_000] },
      lifestyle: { homeOnWeekdays: true, daytimeAc: true, workFromHome: true, electricVehicle: false },
    });
    const slots = pickerSlots(big);
    expect(slots.length).toBeLessThanOrEqual(MAX_PICKER_PANELS);
    expect(slots.map((slot) => slot.panels)).toContain(big.recommendedPanels);
  });
});

describe("compareWithRecommended", () => {
  it("says whether a count is the recommended one, fewer or more", async () => {
    const view = await viewFor(HOUSE);
    const pas = view.recommendedPanels!;
    expect(compareWithRecommended(view, pas)).toBe("recommended");
    expect(compareWithRecommended(view, pas + 1)).toBe("more");
    expect(compareWithRecommended(view, pas - 1)).toBe("fewer");
  });
});
