// The landing page's argument (SPEC 2.1): the example house shown twice, once
// at the recommended panel count and once with far too many. Every figure is
// read from the engine's output for the example house; none is typed here.
//
// "Far too many" is the largest count the example roof holds (SPEC 2.1 does
// not give a rule; our reading). It is read
// from the engine's candidate list, so it follows the assumption set.

import { dayChartMaxKw } from "../result/chartGeometry";
import { assessExampleHouse, EXAMPLE_INPUTS, EXAMPLE_PLACE } from "../result/exampleHouse";
import { toResultView, candidateFor, type OptionView } from "../result/view";

/** What one side of the comparison needs, copied from the engine's output. */
export interface ExampleSide {
  panels: number;
  kwp: number;
  /** 24 values: average kWh of solar output in each hour of the day. */
  solarByHourKwh: number[];
  generationKwh: number;
  selfConsumedKwh: number;
  /** Share of the solar output the home uses itself, 0 to 1. */
  selfConsumedShare: number;
  upfrontCostRp: OptionView["upfrontCostRp"];
  paybackYears: OptionView["paybackYears"];
}

export interface ExampleComparison {
  place: string;
  connectedVa: number;
  /** The first month of the example's bill, in rupiah. */
  monthlySpendRp: number;
  /** 24 values: average kWh the home uses in each hour of the day. */
  loadByHourKwh: number[];
  /** Fixed top of the day chart's scale, shared by both sides so the two humps compare. */
  chartMaxKw: number;
  fits: ExampleSide;
  tooMany: ExampleSide;
}

export async function compareExampleHouse(): Promise<ExampleComparison> {
  const view = toResultView(await assessExampleHouse());
  const recommended = view.recommendedPanels;
  if (recommended === null) throw new Error("the example house has no recommended size");
  const largest = view.candidates[view.candidates.length - 1];

  function sideFor(panels: number): ExampleSide {
    const candidate = candidateFor(view, panels);
    const option = candidate.withoutBattery;
    return {
      panels,
      kwp: candidate.kwp,
      solarByHourKwh: view.averageSolarByHourPerKwp.map((perKwp) => perKwp * candidate.kwp),
      generationKwh: option.generationKwh,
      selfConsumedKwh: option.selfConsumedKwh,
      selfConsumedShare: option.selfConsumedShare,
      upfrontCostRp: option.upfrontCostRp,
      paybackYears: option.paybackYears,
    };
  }

  return {
    place: EXAMPLE_PLACE,
    connectedVa: EXAMPLE_INPUTS.electricity.connectedVa,
    monthlySpendRp: EXAMPLE_INPUTS.electricity.monthlySpendRp[0],
    loadByHourKwh: view.averageLoadByHourKwh,
    chartMaxKw: dayChartMaxKw(view.averageLoadByHourKwh, view.averageSolarByHourPerKwp, largest.kwp),
    fits: sideFor(recommended),
    tooMany: sideFor(largest.panels),
  };
}
