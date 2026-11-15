"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoneyRounded } from "@/lib/format";
import { CHART_WIDTH, PAYBACK_CHART, paybackChartShapes } from "./chartGeometry";
import { Hatch, INK_SOFT, NIGHT, PAPER, RULE, SUN, svgSafeId } from "./Hatch";
import type { OptionView } from "./view";

type PaybackChartProps = {
  option: OptionView;
  /** The one-sentence finding; also the chart's accessible name. */
  caption: string;
};

const AXIS_ROOM = 20; // space under the baseline for the year numbers

// Cost against savings (SPEC 2.3 item 5): the running total of savings as a
// navy line, the upfront cost from low to high as a hatched band, and the
// payback years as a solid yellow column where the line crosses the band.
export function PaybackChart({ option, caption }: PaybackChartProps) {
  const t = useTranslations("result.payback");
  const locale = useLocale();
  const captionId = useId();
  const hatchId = svgSafeId(useId(), "cost");
  const shapes = paybackChartShapes(option.cumulativeSavingsRp, option.upfrontCostRp, option.paybackYears);
  const baseline = PAYBACK_CHART.height;
  const horizon = option.cumulativeSavingsRp.length - 1;
  const note = { fontSize: 11, fontWeight: 800, fill: NIGHT, stroke: PAPER, strokeWidth: 3, paintOrder: "stroke" as const };

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${baseline + AXIS_ROOM}`}
        role="img"
        aria-labelledby={captionId}
        className="block h-auto w-full overflow-visible"
      >
        <Hatch id={hatchId} lineOpacity={0.35} />
        {shapes.paybackColumn && (
          <rect
            x={shapes.paybackColumn.x}
            width={shapes.paybackColumn.width}
            y={PAYBACK_CHART.top}
            height={baseline - PAYBACK_CHART.top}
            fill={SUN}
          />
        )}
        {shapes.gridlines.map((line) => (
          <line key={line.rupiah} x1={0} x2={CHART_WIDTH} y1={line.y} y2={line.y} stroke={RULE} strokeWidth={1} />
        ))}
        <rect
          x={0}
          width={CHART_WIDTH}
          y={shapes.costBand.y}
          height={shapes.costBand.height}
          fill={`url(#${hatchId})`}
          stroke={NIGHT}
          strokeWidth={1}
        />
        {/* Axis labels after the band, with a white halo, so the hatching never covers them. */}
        {shapes.gridlines.map((line) => (
          <text key={line.rupiah} x={0} y={line.y - 4} fontSize={10} fontWeight={700} fill={INK_SOFT} stroke={PAPER} strokeWidth={3} paintOrder="stroke">
            {formatMoneyRounded(line.rupiah, locale, 0).text}
          </text>
        ))}
        <line x1={0} x2={CHART_WIDTH} y1={baseline} y2={baseline} stroke={NIGHT} strokeWidth={2.5} />
        <path d={shapes.savingsLine} fill="none" stroke={NIGHT} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />

        <text x={CHART_WIDTH} y={shapes.costBand.y + shapes.costBand.height + 14} textAnchor="end" {...note}>
          {t("cost")}
        </text>
        <text x={shapes.savingsLabel.x} y={shapes.savingsLabel.y} textAnchor="end" {...note}>
          {t("savings")}
        </text>
        {shapes.paybackColumn && (
          <text
            x={Math.min(Math.max(shapes.paybackColumn.x + shapes.paybackColumn.width / 2, 40), CHART_WIDTH - 40)}
            y={baseline - 8}
            textAnchor="middle"
            fontSize={11}
            fontWeight={800}
            fill={NIGHT}
          >
            {t("paysBack")}
          </text>
        )}
        {shapes.yearTicks.map((tick) => (
          <text
            key={tick.year}
            x={tick.x}
            y={baseline + 15}
            textAnchor={tick.year === 0 ? "start" : tick.year === horizon ? "end" : "middle"}
            fontSize={10.5}
            fontWeight={700}
            fill={INK_SOFT}
          >
            {tick.year === 0 ? t("yearZero") : tick.year}
          </text>
        ))}
      </svg>
      <figcaption id={captionId} className="mt-3 max-w-[34em]">
        {caption}
      </figcaption>
    </figure>
  );
}
