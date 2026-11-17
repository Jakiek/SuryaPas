// How one side of the comparison is written, through the same formatters the
// result page uses (src/features/result/figures.ts), so the landing page and
// /r/example never write the same engine number two ways.

import { costRangeFigure, dayCaptionFigures, paybackFigure, percentFigure } from "../result/figures";
import type { ExampleSide } from "./exampleComparison";

export interface SideText {
  /** The share of solar output sent to the grid unpaid: "8%". */
  wasted: string;
  /** "Rp18–33 juta". */
  cost: string;
  /** "7–15 tahun" or "13+ tahun"; null when the system does not pay back (the page then says so in words). */
  payback: string | null;
  /** Kilowatt-hours in an average day, for the chart's caption. */
  day: { generated: string; used: string; exported: string };
}

export function sideText(side: ExampleSide, locale: string): SideText {
  const payback = paybackFigure(side.paybackYears, locale);
  return {
    wasted: percentFigure(1 - side.selfConsumedShare, locale).text,
    cost: costRangeFigure(side.upfrontCostRp, locale).text,
    payback:
      payback.kind === "never"
        ? null
        : payback.kind === "atLeast"
          ? `${payback.value.figure}+ ${payback.value.unit}`
          : payback.value.text,
    day: dayCaptionFigures(side.generationKwh, side.selfConsumedKwh, locale),
  };
}
