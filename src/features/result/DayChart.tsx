"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { DayBand } from "@/components";
import { formatDecimal } from "@/lib/format";
import { CHART_WIDTH, DAY_CHART, dayChartShapes } from "./chartGeometry";
import { Hatch, INK_SOFT, NIGHT, PAPER, RULE, SUN, svgSafeId } from "./Hatch";

type DayChartProps = {
  /** 24 hourly averages of the home's use. */
  loadKwh: number[];
  /** 24 hourly averages of solar output for the size on show. */
  solarKwh: number[];
  /** Fixed top of the scale, so the hump visibly grows as panels are added. */
  maxKw: number;
  /** The one-sentence finding (docs/DESIGN.md "Charts"); also the chart's accessible name. */
  caption: string;
};

// The typical day (SPEC 2.3 item 3): home use as a navy line, solar as a hump
// that is solid yellow where the home uses it and hatched where it goes to the
// grid unpaid. The day band sits beneath at the same width, so hour h is at
// h/24 of both.
export function DayChart({ loadKwh, solarKwh, maxKw, caption }: DayChartProps) {
  const t = useTranslations("result.day");
  const locale = useLocale();
  const captionId = useId();
  const hatchId = svgSafeId(useId(), "surplus");
  const shapes = dayChartShapes(loadKwh, solarKwh, maxKw);
  const halo = { stroke: PAPER, strokeWidth: 3, paintOrder: "stroke" as const };

  return (
    <figure className="mt-4">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${DAY_CHART.height}`}
        role="img"
        aria-labelledby={captionId}
        className="block h-auto w-full overflow-visible"
      >
        <Hatch id={hatchId} background="var(--color-sun-soft)" lineOpacity={0.55} />
        {shapes.gridlines.map((line) => (
          <g key={line.kw}>
            <line x1={0} x2={CHART_WIDTH} y1={line.y} y2={line.y} stroke={RULE} strokeWidth={1} />
            <text x={0} y={line.y - 4} fontSize={10} fontWeight={700} fill={INK_SOFT}>
              {t("axis", { value: formatDecimal(line.kw, locale, 1) })}
            </text>
          </g>
        ))}
        <path d={shapes.solarArea} fill={`url(#${hatchId})`} stroke={NIGHT} strokeWidth={1.5} strokeLinejoin="round" />
        <path d={shapes.usedArea} fill={SUN} />
        <path d={shapes.loadLine} fill="none" stroke={NIGHT} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

        <text
          x={shapes.labels.used.x}
          y={shapes.labels.used.y}
          textAnchor="middle"
          fontSize={11}
          fontWeight={800}
          fill={NIGHT}
          {...(shapes.labels.used.inside ? {} : halo)}
        >
          {t("used")}
        </text>
        {shapes.labels.surplus.show && (
          <text x={shapes.labels.surplus.x} y={shapes.labels.surplus.y} textAnchor="middle" fontSize={11} fontWeight={800} fill={NIGHT} {...halo}>
            {t("surplus")}
          </text>
        )}
        <text x={shapes.labels.load.x} y={shapes.labels.load.y} textAnchor="middle" fontSize={11} fontWeight={800} fill={NIGHT} {...halo}>
          {t("load")}
        </text>
      </svg>
      <DayBand />
      <figcaption id={captionId} className="mt-3 max-w-[34em]">
        {caption}
      </figcaption>
    </figure>
  );
}
