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
  const typical = Array.from({ length: 26 }, (_, year) => year * 4_000_000);
  // Low cost saves a little more each year, high cost a little less (upkeep follows the cost).
  const lowCostRp = typical.map((rupiah) => rupiah * 1.05);
  const highCostRp = typical.map((rupiah) => rupiah * 0.95);
  const cost = { low: 20_000_000, high: 40_000_000 };
  const yearWidth = CHART_WIDTH / 25;

  it("spans the marked years with the column and the cost range with the band", () => {
    const shapes = paybackChartShapes({ typicalRp: typical, band: null, cost, markedYears: { fromYear: 5, toYear: 10 } });
    expect(shapes.paybackColumn?.x).toBeCloseTo(5 * yearWidth, 6);
    expect(shapes.paybackColumn?.width).toBeCloseTo(5 * yearWidth, 6);
    expect(shapes.costBand.height).toBeGreaterThan(0);
    expect(shapes.yearTicks.map((tick) => tick.year)).toEqual([0, 5, 10, 15, 20, 25]);
  });

  it("marks no column when told none, and keeps a one-year column visible", () => {
    expect(paybackChartShapes({ typicalRp: typical, band: null, cost, markedYears: null }).paybackColumn).toBeNull();
    const narrow = paybackChartShapes({ typicalRp: typical, band: null, cost, markedYears: { fromYear: 7, toYear: 7 } });
    expect(narrow.paybackColumn?.width).toBeGreaterThanOrEqual(3);
  });

  it("draws the savings as a band between the low-cost and high-cost series, with the typical line inside it", () => {
    const shapes = paybackChartShapes({ typicalRp: typical, band: { lowCostRp, highCostRp }, cost, markedYears: null });
    expect(shapes.savingsBand).not.toBeNull();
    // One point per year along each edge, joined, then closed: 26 + 26 points.
    const band = shapes.savingsBand ?? "";
    expect(band.endsWith("Z")).toBe(true);
    expect(band.match(/[ML]/g)).toHaveLength(52);
    // The band starts on the low-cost series (upper edge) and turns back along the high-cost series.
    const firstUpperY = Number(band.split("L")[1].split(" ")[1]);
    const lastLowerY = Number(band.split("L").pop()!.replace("Z", "").split(" ")[1]);
    const lineYs = shapes.savingsLine.split("L").map((part) => Number(part.replace("M", "").split(" ")[1]));
    expect(firstUpperY).toBeLessThanOrEqual(lineYs[1]);
    expect(lastLowerY).toBeGreaterThanOrEqual(lineYs[0]);
  });

  it("has no band when the result carries only the typical line, or when the series do not match it", () => {
    expect(paybackChartShapes({ typicalRp: typical, band: null, cost, markedYears: null }).savingsBand).toBeNull();
    const mismatched = paybackChartShapes({ typicalRp: typical, band: { lowCostRp: [0, 1], highCostRp: [0, 1] }, cost, markedYears: null });
    expect(mismatched.savingsBand).toBeNull();
  });

  it("scales to the band's upper edge so the band never leaves the chart", () => {
    const shapes = paybackChartShapes({ typicalRp: typical, band: { lowCostRp: lowCostRp.map((value) => value * 3), highCostRp }, cost, markedYears: null });
    const ys = (shapes.savingsBand ?? "").match(/-?\d+\.\d/g)!.map(Number);
    expect(Math.min(...ys.filter((_, index) => index % 2 === 1))).toBeGreaterThanOrEqual(PAYBACK_CHART.top - 0.1);
  });

  it("draws a negative running total on the baseline", () => {
    const losing = Array.from({ length: 26 }, (_, year) => -year * 1_000_000);
    const shapes = paybackChartShapes({
      typicalRp: losing,
      band: { lowCostRp: losing, highCostRp: losing.map((value) => value * 1.2) },
      cost: { low: 10_000_000, high: 20_000_000 },
      markedYears: null,
    });
    expect(shapes.savingsLine).toContain(` ${PAYBACK_CHART.height.toFixed(1)}`);
    expect(shapes.savingsLine).not.toContain("NaN");
    expect(shapes.savingsBand).not.toContain("NaN");
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
