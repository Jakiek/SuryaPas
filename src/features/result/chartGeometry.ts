// The shapes of the two result charts (SPEC 2.3 items 3 and 5; docs/DESIGN.md
// "Charts"), as SVG path strings. Pure functions of the engine's numbers, so
// they can be tested without a browser.
//
// Coordinates are in the SVG's own units. Both charts are 340 wide, the
// design's phone width; the SVG scales to fit its column.

export const CHART_WIDTH = 340;
const HOURS_PER_DAY = 24;

/** A straight-line scale: maps [domainMin, domainMax] onto [rangeMin, rangeMax]. */
export function linearScale(domainMin: number, domainMax: number, rangeMin: number, rangeMax: number) {
  const span = domainMax - domainMin || 1;
  return (value: number) => rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
}

function pathThrough(points: [number, number][]): string {
  return points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
}

/** A closed area from the baseline up to the points and back down. */
function areaUnder(points: [number, number][], baselineY: number): string {
  if (points.length === 0) return "";
  const first = points[0][0];
  const last = points[points.length - 1][0];
  return `M${first.toFixed(1)} ${baselineY}` + pathThrough(points).replace(/^M/, "L") + `L${last.toFixed(1)} ${baselineY}Z`;
}

/** "Nice" round steps for gridlines: 1, 2 or 5 times a power of ten, giving at most `maxLines`. */
export function niceStep(top: number, maxLines: number): number {
  const rough = top / maxLines;
  const power = 10 ** Math.floor(Math.log10(rough));
  for (const multiple of [1, 2, 5, 10]) {
    if (multiple * power >= rough) return multiple * power;
  }
  return 10 * power;
}

// ---------- One day ----------

export const DAY_CHART = { height: 150, top: 8 } as const;
/** Samples per hour along the curves; four gives smooth shapes at 340 wide. */
const SAMPLES_PER_HOUR = 4;

/**
 * The value at clock time `t` (0 to 24) from 24 hourly averages, drawn
 * through the middle of each hour and joined by straight lines. Midnight
 * wraps round, so the curve's two ends meet.
 */
export function hourlyValueAt(hourly: number[], t: number): number {
  const position = t - 0.5; // hour h is drawn at h + 0.5
  const below = Math.floor(position);
  const fraction = position - below;
  const at = (hour: number) => hourly[((hour % HOURS_PER_DAY) + HOURS_PER_DAY) % HOURS_PER_DAY];
  return at(below) * (1 - fraction) + at(below + 1) * fraction;
}

export interface DayChartShapes {
  /** The whole solar hump (filled with hatching: the surplus shows where it rises above use). */
  solarArea: string;
  /** Solar used in the home: the part of the hump under the home's line (solid sun). */
  usedArea: string;
  /** The home's use: a line. */
  loadLine: string;
  /** Gridlines, one per step of kW. */
  gridlines: { kw: number; y: number }[];
  /** Where the three written labels go. */
  labels: {
    used: { x: number; y: number; inside: boolean };
    surplus: { x: number; y: number; show: boolean };
    load: { x: number; y: number };
  };
}

/**
 * @param loadKwh  24 hourly averages of the home's use (kWh in an hour = average kW)
 * @param solarKwh 24 hourly averages of solar output for the selected size
 * @param maxKw    top of the vertical scale; fixed while the panel count changes
 */
export function dayChartShapes(loadKwh: number[], solarKwh: number[], maxKw: number): DayChartShapes {
  const x = linearScale(0, HOURS_PER_DAY, 0, CHART_WIDTH);
  const y = linearScale(0, maxKw, DAY_CHART.height, DAY_CHART.top);
  const baseline = DAY_CHART.height;

  const times: number[] = [];
  for (let step = 0; step <= HOURS_PER_DAY * SAMPLES_PER_HOUR; step++) times.push(step / SAMPLES_PER_HOUR);

  const solarAt = (t: number) => hourlyValueAt(solarKwh, t);
  const loadAt = (t: number) => hourlyValueAt(loadKwh, t);
  const solarPoints = times.map((t): [number, number] => [x(t), y(solarAt(t))]);
  const usedPoints = times.map((t): [number, number] => [x(t), y(Math.min(solarAt(t), loadAt(t)))]);
  const loadPoints = times.map((t): [number, number] => [x(t), y(loadAt(t))]);

  // Labels. "Used" sits inside the solid part at noon when there is room for
  // a line of 11 px text; otherwise above both the hump and the home's line,
  // so it never sits on the line.
  const NOON = 12;
  const usedAtNoon = Math.min(solarAt(NOON), loadAt(NOON));
  const usedHeightPx = baseline - y(usedAtNoon);
  const LABEL_ROOM_PX = 16;
  const inside = usedHeightPx >= LABEL_ROOM_PX;
  const largestSurplusPx = Math.max(...times.map((t) => y(loadAt(t)) - y(solarAt(t))));
  // "Surplus" is written only when the hatched part is tall enough to point at.
  const SURPLUS_ROOM_PX = 6;
  const EVENING_LABEL_AT = 21.2;

  const kwStep = niceStep(maxKw, 4);
  const gridlines: { kw: number; y: number }[] = [];
  for (let kw = kwStep; kw < maxKw; kw += kwStep) gridlines.push({ kw, y: y(kw) });

  return {
    solarArea: areaUnder(solarPoints, baseline),
    usedArea: areaUnder(usedPoints, baseline),
    loadLine: pathThrough(loadPoints),
    gridlines,
    labels: {
      used: inside
        ? { x: x(NOON), y: y(usedAtNoon / 2) + 4, inside: true }
        : { x: x(NOON), y: y(Math.max(solarAt(NOON), loadAt(NOON))) - 9, inside: false },
      surplus: { x: x(NOON), y: y(solarAt(NOON)) - 7, show: inside && largestSurplusPx >= SURPLUS_ROOM_PX },
      load: { x: x(EVENING_LABEL_AT), y: y(loadAt(EVENING_LABEL_AT)) - 10 },
    },
  };
}

/** The top of the day chart's scale: the highest of the home's use and the largest system's output, plus room. */
export function dayChartMaxKw(loadKwh: number[], solarPerKwp: number[], largestKwp: number): number {
  const HEADROOM = 1.1;
  const highest = Math.max(...loadKwh, ...solarPerKwp.map((value) => value * largestKwp));
  return highest * HEADROOM;
}

// ---------- Payback ----------

export const PAYBACK_CHART = { height: 150, top: 10 } as const;

/** What the payback chart is drawn from. All series run from year 0 to the horizon. */
export interface PaybackChartInput {
  /** Cumulative savings at the typical cost: the line. */
  typicalRp: number[];
  /**
   * Cumulative savings at the low cost (the band's upper edge) and at the high
   * cost (its lower edge), or null when the result has only the typical line
   * (saved by engine 1.0.0). Valid while capex.perKwp is ordered low ≤ typical ≤ high.
   */
  band: { lowCostRp: number[]; highCostRp: number[] } | null;
  /** The upfront cost at the low and the high cost: the hatched band. */
  cost: { low: number; high: number };
  /** The years to mark with the solid column; null when the page says the system does not pay back. */
  markedYears: { fromYear: number; toYear: number } | null;
}

export interface PaybackChartShapes {
  /** The typical-cost line. */
  savingsLine: string;
  /** The low-to-high-cost band as a closed shape; null when there is only the line. */
  savingsBand: string | null;
  /** The upfront cost from low to high, as a band. */
  costBand: { y: number; height: number };
  /** The years marked as paying back; null when none are. */
  paybackColumn: { x: number; width: number } | null;
  gridlines: { rupiah: number; y: number }[];
  yearTicks: { year: number; x: number }[];
  /** Where "total savings" is written: above the end of the savings, band included. */
  savingsLabel: { x: number; y: number };
}

export function paybackChartShapes({ typicalRp, band, cost, markedYears }: PaybackChartInput): PaybackChartShapes {
  const horizon = typicalRp.length - 1;
  const HEADROOM = 1.1;
  // A band whose series do not match the line's length cannot be drawn against it.
  const usableBand = band !== null && band.lowCostRp.length === typicalRp.length && band.highCostRp.length === typicalRp.length ? band : null;
  const upperEdgeRp = usableBand ? usableBand.lowCostRp : typicalRp;
  const top = Math.max(...upperEdgeRp, cost.high) * HEADROOM;
  const x = linearScale(0, horizon, 0, CHART_WIDTH);
  // A running total below zero is drawn on the baseline; the caption says what it means.
  const y = (rupiah: number) => linearScale(0, top, PAYBACK_CHART.height, PAYBACK_CHART.top)(Math.max(rupiah, 0));

  const MIN_COLUMN_PX = 3;
  const paybackColumn =
    markedYears === null
      ? null
      : { x: x(markedYears.fromYear), width: Math.max(x(markedYears.toYear) - x(markedYears.fromYear), MIN_COLUMN_PX) };

  const step = niceStep(top, 4);
  const gridlines: { rupiah: number; y: number }[] = [];
  for (let rupiah = step; rupiah < top; rupiah += step) gridlines.push({ rupiah, y: y(rupiah) });

  const YEAR_TICK = 5;
  const yearTicks: { year: number; x: number }[] = [];
  for (let year = 0; year <= horizon; year += YEAR_TICK) yearTicks.push({ year, x: x(year) });

  const pointsOf = (series: number[]) => series.map((rupiah, year): [number, number] => [x(year), y(rupiah)]);
  // The band: along its upper edge from year 0 to the horizon, back along its lower edge, closed.
  const savingsBand = usableBand
    ? pathThrough([...pointsOf(usableBand.lowCostRp), ...pointsOf(usableBand.highCostRp).reverse()]) + "Z"
    : null;

  const labelYear = horizon - 1;
  return {
    savingsLine: pathThrough(pointsOf(typicalRp)),
    savingsBand,
    costBand: { y: y(cost.high), height: y(cost.low) - y(cost.high) },
    paybackColumn,
    gridlines,
    yearTicks,
    savingsLabel: { x: x(labelYear), y: y(upperEdgeRp[labelYear]) - 12 },
  };
}
