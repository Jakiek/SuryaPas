import { describe, expect, it } from "vitest";
import { assess, CURRENT_ASSUMPTIONS } from "../../engine";
import { loadFallbackFile } from "../../lib/sun/fallback";
import { formatMoneyRange, formatYearsRange } from "../../lib/format";
import { EXAMPLE_INPUTS } from "../result/exampleHouse";
import { compareExampleHouse } from "./exampleComparison";
import { sideText } from "./comparisonText";

// The landing page's figures must be the engine's own. This test runs the
// engine itself on the example house, takes the two candidates, and checks
// that the comparison (and the text written from it) matches.
async function engineOutput() {
  const sun = await loadFallbackFile("yogyakarta");
  return assess(EXAMPLE_INPUTS, { ghiWm2: sun.series, source: "live" }, CURRENT_ASSUMPTIONS);
}

describe("the landing comparison of the example house", () => {
  it("shows the recommended count and the largest the roof holds", async () => {
    const engine = await engineOutput();
    const comparison = await compareExampleHouse();
    const largest = engine.candidates[engine.candidates.length - 1];

    expect(comparison.fits.panels).toBe(engine.recommendedPanels);
    expect(comparison.tooMany.panels).toBe(largest.panels);
    // "Far too many" has to be more, and has to waste more, or the page argues nothing.
    expect(comparison.tooMany.panels).toBeGreaterThan(comparison.fits.panels);
    expect(comparison.tooMany.selfConsumedShare).toBeLessThan(comparison.fits.selfConsumedShare);
  });

  it("carries the engine's figures for each count, unchanged", async () => {
    const engine = await engineOutput();
    const comparison = await compareExampleHouse();

    for (const side of [comparison.fits, comparison.tooMany]) {
      const candidate = engine.candidates.find((c) => c.panels === side.panels)!;
      const { energy, money } = candidate.withoutBattery;
      expect(side.kwp).toBe(candidate.kwp);
      expect(side.generationKwh).toBe(energy.generationKwh);
      expect(side.selfConsumedKwh).toBe(energy.selfConsumedKwh);
      expect(side.selfConsumedShare).toBe(money.selfConsumedShare);
      expect(side.upfrontCostRp).toEqual(money.upfrontCostRp);
      expect(side.paybackYears).toEqual(money.paybackYears);
      expect(side.solarByHourKwh).toEqual(engine.averageSolarByHourPerKwp.map((perKwp) => perKwp * candidate.kwp));
    }
    expect(comparison.loadByHourKwh).toEqual(engine.averageLoadByHourKwh);
  });

  for (const locale of ["id", "en"]) {
    it(`writes those figures as the design's number formats in ${locale}`, async () => {
      const engine = await engineOutput();
      const comparison = await compareExampleHouse();

      for (const side of [comparison.fits, comparison.tooMany]) {
        const money = engine.candidates.find((c) => c.panels === side.panels)!.withoutBattery.money;
        const text = sideText(side, locale);
        const wastedPercent = Math.round((1 - money.selfConsumedShare) * 100);

        expect(text.cost).toBe(formatMoneyRange(money.upfrontCostRp.low, money.upfrontCostRp.high, locale).text);
        // A whole percent, written by Intl, equal to 100% minus the engine's share used on site.
        expect(text.wasted.replace(/\D/g, "")).toBe(String(wastedPercent));
        if (money.paybackYears.typical === null) {
          expect(text.payback).toBeNull();
        } else {
          const high = money.paybackYears.high;
          const low = money.paybackYears.low ?? money.paybackYears.typical;
          expect(text.payback).toBe(
            high === null
              ? `${formatYearsRange(low, low, locale).figure}+ ${formatYearsRange(low, low, locale).unit}`
              : formatYearsRange(low, high, locale).text,
          );
        }
      }
    });
  }
});
