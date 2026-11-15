import { describe, expect, it } from "vitest";
import {
  CHART_WIDTH,
  DAY_CHART,
  dayChartMaxKw,
  dayChartShapes,
  hourlyValueAt,
  niceStep,
  PAYBACK_CHART,
  paybackChartShapes,
} from "./chartGeometry";
import { lerpShape } from "./ease";

const FLAT_LOAD = Array.from({ length: 24 }, () => 0.5);
// A square pulse of sun from 06:00 to 18:00 (SPEC 3.5's hand-worked shape).
const SQUARE_SUN = Array.from({ length: 24 }, (_, hour) => (hour >= 6 && hour < 18 ? 1 : 0));

describe("hourlyValueAt", () => {
  it("passes through the middle of each hour and wraps at midnight", () => {
    const hourly = Array.from({ length: 24 }, (_, hour) => hour);
    expect(hourlyValueAt(hourly, 3.5)).toBe(3);
    expect(hourlyValueAt(hourly, 4)).toBe(3.5);
    expect(hourlyValueAt(hourly, 0)).toBe(11.5); // halfway between 23 and 0
  });
});

describe("dayChartShapes", () => {
  it("draws inside the chart and keeps the scale it is given", () => {
    const shapes = dayChartShapes(FLAT_LOAD, SQUARE_SUN, 2);
    // Load of 0.5 kW on a 0–2 kW scale sits a quarter of the way up.
    const quarterUp = DAY_CHART.height - (DAY_CHART.height - DAY_CHART.top) / 4;
    expect(shapes.loadLine.startsWith(`M0.0 ${quarterUp.toFixed(1)}`)).toBe(true);
    expect(shapes.loadLine.endsWith(`L${CHART_WIDTH.toFixed(1)} ${quarterUp.toFixed(1)}`)).toBe(true);
    expect(shapes.gridlines.map((line) => line.kw)).toEqual([0.5, 1, 1.5]);
  });

  it("puts the used label inside when the used part is tall enough, and shows the surplus", () => {
    const shapes = dayChartShapes(FLAT_LOAD, SQUARE_SUN, 2);
    expect(shapes.labels.used.inside).toBe(true);
    expect(shapes.labels.surplus.show).toBe(true);
  });

  it("moves the used label above a small system and drops the surplus label", () => {
    const tiny = SQUARE_SUN.map((value) => value * 0.1);
    const shapes = dayChartShapes(FLAT_LOAD, tiny, 4);
    expect(shapes.labels.used.inside).toBe(false);
    expect(shapes.labels.surplus.show).toBe(false);
  });

  it("scales to the largest system so the hump grows past the line", () => {
    expect(dayChartMaxKw(FLAT_LOAD, SQUARE_SUN, 3)).toBeCloseTo(3.3, 10);
    expect(dayChartMaxKw([2, ...FLAT_LOAD.slice(1)], SQUARE_SUN, 1)).toBeCloseTo(2.2, 10);
  });
});

describe("paybackChartShapes", () => {
  const cumulative = Array.from({ length: 26 }, (_, year) => year * 4_000_000);

  it("spans the payback years with the column and the cost range with the band", () => {
    const shapes = paybackChartShapes(cumulative, { low: 20_000_000, high: 40_000_000 }, { low: 5, high: 10 });
    const yearWidth = CHART_WIDTH / 25;
    expect(shapes.paybackColumn?.x).toBeCloseTo(5 * yearWidth, 6);
    expect(shapes.paybackColumn?.width).toBeCloseTo(5 * yearWidth, 6);
    expect(shapes.costBand.height).toBeGreaterThan(0);
    expect(shapes.yearTicks.map((tick) => tick.year)).toEqual([0, 5, 10, 15, 20, 25]);
  });

  it("runs the column to the horizon when only the low cost pays back, and drops it when none does", () => {
    const open = paybackChartShapes(cumulative, { low: 20_000_000, high: 40_000_000 }, { low: 5, high: null });
    expect((open.paybackColumn?.x ?? 0) + (open.paybackColumn?.width ?? 0)).toBeCloseTo(CHART_WIDTH, 6);
    const never = paybackChartShapes(cumulative, { low: 200_000_000, high: 400_000_000 }, { low: null, high: null });
    expect(never.paybackColumn).toBeNull();
  });

  it("draws a negative running total on the baseline", () => {
    const losing = Array.from({ length: 26 }, (_, year) => -year * 1_000_000);
    const shapes = paybackChartShapes(losing, { low: 10_000_000, high: 20_000_000 }, { low: null, high: null });
    expect(shapes.savingsLine).toContain(` ${PAYBACK_CHART.height.toFixed(1)}`);
    expect(shapes.savingsLine).not.toContain("NaN");
  });
});

describe("niceStep", () => {
  it("picks 1, 2 or 5 times a power of ten", () => {
    expect(niceStep(3.5, 4)).toBe(1);
    expect(niceStep(130_000_000, 4)).toBe(50_000_000);
    expect(niceStep(60_000_000, 4)).toBe(20_000_000);
  });
});

describe("lerpShape", () => {
  it("moves numbers part of the way and jumps over what cannot move", () => {
    const from = { kwp: 1, payback: { low: 5, high: null as number | null }, series: [0, 10] };
    const to = { kwp: 2, payback: { low: 9, high: 12 as number | null }, series: [0, 20] };
    expect(lerpShape(from, to, 0.5)).toEqual({ kwp: 1.5, payback: { low: 7, high: 12 }, series: [0, 15] });
    expect(lerpShape(from, to, 1)).toEqual(to);
  });
});
