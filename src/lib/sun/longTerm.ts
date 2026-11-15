// Long-term scaling of the hourly sun series (SPEC 3.4).
//
// The engine sizes a system on one year of hourly sunlight, but a payback over
// 25 years depends on the long-term sun. So every hour of that year is
// multiplied by one factor:
//
//   factor = mean yearly irradiation of the twenty complete years ending with
//            the hourly year ÷ the hourly year's irradiation
//
// The mean comes from NASA POWER's monthly record of the same quantity
// (nasaMonthly.ts). One factor for the whole year keeps that year's real
// hour-by-hour pattern of cloud; only the total changes.
//
// Pure: no I/O, no clock. Both inputs arrive as arguments.

import { SunDataError } from "./nasa";
import type { MonthlyRecord } from "./nasaMonthly";

/** SPEC 3.4: the mean is over the twenty complete years ending with the hourly year. */
export const LONG_TERM_YEARS = 20;
/** SPEC 3.4: with fewer usable years than this, the request counts as failed. */
export const MIN_USABLE_YEARS = 10;

const WH_PER_KWH = 1000;

/**
 * Days in each month of the year the engine uses. February has 28 even in a
 * leap year, because the hourly series leaves out 29 February (the leap-day
 * rule in nasa.ts). So a yearly total here covers the same 365 days as the
 * series it is compared with: like for like.
 */
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** The years the mean is taken over: twenty, ending with the hourly year itself. */
export function longTermYears(hourlyYear: number): { firstYear: number; lastYear: number } {
  return { firstYear: hourlyYear - LONG_TERM_YEARS + 1, lastYear: hourlyYear };
}

/**
 * One year's irradiation in kWh/m²: each month's mean day (kWh/m²/day) times
 * its number of days, added up. Null when any month is missing, because a year
 * with a missing month is left out of the mean (SPEC 3.4).
 */
export function yearlyIrradiation(monthMeanDays: ReadonlyArray<number | null>): number | null {
  if (monthMeanDays.length !== DAYS_IN_MONTH.length) return null;
  let total = 0;
  for (let month = 0; month < DAYS_IN_MONTH.length; month++) {
    const meanDay = monthMeanDays[month];
    if (meanDay === null) return null;
    total += meanDay * DAYS_IN_MONTH[month];
  }
  return total;
}

/**
 * The irradiation of an hourly series in kWh/m². Each value is the mean power
 * over one hour in W/m², which is the energy of that hour in Wh/m².
 */
export function seriesIrradiation(series: ReadonlyArray<number>): number {
  let totalWhPerM2 = 0;
  for (const watts of series) totalWhPerM2 += watts;
  return totalWhPerM2 / WH_PER_KWH;
}

export interface LongTermMean {
  /** Mean yearly irradiation of the usable years, kWh/m². */
  meanKwhPerM2: number;
  /** The years that had all twelve months, oldest first. */
  yearsUsed: number[];
}

/** The mean yearly irradiation of the twenty years ending with the hourly year. */
export function longTermMean(record: MonthlyRecord, hourlyYear: number): LongTermMean {
  const { firstYear, lastYear } = longTermYears(hourlyYear);
  const yearsUsed: number[] = [];
  let sum = 0;
  for (let year = firstYear; year <= lastYear; year++) {
    const months = record[year];
    const total = months ? yearlyIrradiation(months) : null;
    if (total === null) continue; // a year with a missing month is left out
    yearsUsed.push(year);
    sum += total;
  }
  if (yearsUsed.length < MIN_USABLE_YEARS) {
    throw new SunDataError(
      `only ${yearsUsed.length} complete years in ${firstYear}–${lastYear}; need ${MIN_USABLE_YEARS}`,
    );
  }
  return { meanKwhPerM2: sum / yearsUsed.length, yearsUsed };
}

/** What was done to a series, kept beside it so the factor can be checked later. */
export interface LongTermScaling {
  firstYear: number;
  lastYear: number;
  yearsUsed: number[];
  /** Mean yearly irradiation of the years used, kWh/m². */
  meanKwhPerM2: number;
  /** The hourly year's own irradiation before scaling, kWh/m². */
  hourlyYearKwhPerM2: number;
  /** meanKwhPerM2 ÷ hourlyYearKwhPerM2. */
  factor: number;
}

export interface ScaledSeries {
  series: number[];
  scaling: LongTermScaling;
}

/** Multiply every hour by the one factor that brings the year to the long-term mean. */
export function scaleToLongTerm(
  series: ReadonlyArray<number>,
  record: MonthlyRecord,
  hourlyYear: number,
): ScaledSeries {
  const { meanKwhPerM2, yearsUsed } = longTermMean(record, hourlyYear);
  const hourlyYearKwhPerM2 = seriesIrradiation(series);
  if (!(hourlyYearKwhPerM2 > 0)) {
    throw new SunDataError("the hourly year has no sunlight to scale");
  }
  const factor = meanKwhPerM2 / hourlyYearKwhPerM2;
  const { firstYear, lastYear } = longTermYears(hourlyYear);
  return {
    series: series.map((watts) => watts * factor),
    scaling: { firstYear, lastYear, yearsUsed, meanKwhPerM2, hourlyYearKwhPerM2, factor },
  };
}
