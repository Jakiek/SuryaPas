import { describe, expect, it } from "vitest";
import exampleHouse from "../../../data/example-house.json";
import { assess, CURRENT_ASSUMPTIONS, type EngineInputs, type SunSeries } from "../../engine";
import { loadFallbackFile } from "../../lib/sun/fallback";
import {
  candidateFor,
  compareWithRecommended,
  horizonYears,
  lowCostOnlyYear,
  MAX_PICKER_PANELS,
  pickerSlots,
  recommendedLosesMoney,
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

describe("payback verdicts follow the typical cost, size by size (example house)", () => {
  // Engine paybacks for the example house (low / typical / high cost):
  // 2 panels 7 / 10 / 15, 4 panels 13 / 20 / none, 6 panels 19 / none / none, 8 panels none.
  it("pays back at every cost: no payback verdict", async () => {
    const view = await viewFor(HOUSE);
    expect(verdictsFor(view, candidateFor(view, 2))).toEqual([]);
    expect(lowCostOnlyYear(candidateFor(view, 2))).toBeNull();
  });

  it("pays back at the typical cost but not the highest: a note, and the headline keeps its year", async () => {
    const view = await viewFor(HOUSE);
    expect(verdictsFor(view, candidateFor(view, 4))).toEqual(["highCostDoesNotPayBack"]);
    expect(lowCostOnlyYear(candidateFor(view, 4))).toBeNull();
  });

  it("does not pay back at the typical cost though the lowest price would: the size verdict, with that year for the note", async () => {
    const view = await viewFor(HOUSE);
    const six = candidateFor(view, 6);
    expect(six.withoutBattery.paybackYears).toEqual({ low: 19, typical: null, high: null });
    expect(verdictsFor(view, six)).toEqual(["sizeDoesNotPayBack"]);
    expect(lowCostOnlyYear(six)).toBe(19);
  });

  it("does not pay back at any cost: no low-cost year to add", async () => {
    const view = await viewFor(HOUSE);
    expect(lowCostOnlyYear(candidateFor(view, 8))).toBeNull();
  });
});

describe("a recommended size that loses money", () => {
  it("is detected from the recommended size's net savings, and not for the example house", async () => {
    expect(recommendedLosesMoney(await viewFor(HOUSE))).toBe(false);
    const subsidised = await viewFor({
      ...HOUSE,
      electricity: { billing: "prepaid", connectedVa: 450, subsidised: true, monthlySpendRp: [60_000] },
    });
    expect(recommended(subsidised).withoutBattery.netSavingsRp).toBeLessThan(0);
    expect(recommendedLosesMoney(subsidised)).toBe(true);
  });

  it("is false when the roof is too small to recommend anything", async () => {
    expect(recommendedLosesMoney(await viewFor({ ...HOUSE, roof: { ...HOUSE.roof, areaM2: 4 } }))).toBe(false);
  });
});

describe("a result saved by engine 1.0.0 (no cumulative series by cost)", () => {
  it("is read without the band and keeps its other numbers", async () => {
    const sun = await loadFallbackFile("yogyakarta");
    const assessment = assess(HOUSE, { ghiWm2: sun.series, source: "live" }, CURRENT_ASSUMPTIONS);
    const old = JSON.parse(JSON.stringify(assessment)) as typeof assessment;
    for (const candidate of old.candidates) {
      delete (candidate.withoutBattery.money as { cumulativeSavingsByCostRp?: unknown }).cumulativeSavingsByCostRp;
      if (candidate.withBattery) delete (candidate.withBattery.money as { cumulativeSavingsByCostRp?: unknown }).cumulativeSavingsByCostRp;
    }
    const view = toResultView(old);
    expect(view.candidates[0].withoutBattery.cumulativeSavingsByCostRp).toBeUndefined();
    expect(view.candidates[0].withoutBattery.cumulativeSavingsRp).toEqual(assessment.candidates[0].withoutBattery.money.cumulativeSavingsRp);
  });

  it("carries the band when the engine gives it", async () => {
    const view = await viewFor(HOUSE);
    const option = view.candidates[0].withoutBattery;
    expect(option.cumulativeSavingsByCostRp?.typical).toEqual(option.cumulativeSavingsRp);
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
