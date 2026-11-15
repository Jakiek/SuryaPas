// Step 2 of the pipeline (SPEC 3.2): from monthly kWh to an hour-by-hour picture of the home's use.
//
// A bill says how much energy a home used, not when. The four lifestyle answers set the
// "daytime share": the fraction of a day's energy used between 06:00 and 18:00.
// That one number decides how much solar the home can use directly.

import { valueOf } from "../assumptions";
import type { AssumptionSet } from "../assumptions";
import {
  DAYS_IN_MONTH,
  DAYS_PER_YEAR,
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOURS_PER_DAY,
  isDaytimeHour,
  isWeekendDay,
} from "../calendar";
import type { LifestyleInput, Monthly } from "../types";

/**
 * How daytime energy is spread over the twelve hours from 06:00 to 18:00. Sums to 1.
 * Use rises through the morning and is highest in the early afternoon, when rooms are warmest.
 * These weights are a judgment, with no measured Indonesian household profile behind them.
 */
export const DAY_SHAPE = [0.055, 0.065, 0.075, 0.08, 0.085, 0.095, 0.1, 0.1, 0.095, 0.09, 0.085, 0.075];

/**
 * How night-time energy is spread over the twelve hours from 18:00 to 06:00. Sums to 1.
 * In order: 18, 19, 20, 21, 22, 23, 00, 01, 02, 03, 04, 05.
 * A strong evening peak, a low overnight base, and a small rise before dawn,
 * matching the shape of the CLASP and Ipsos 2020 survey of Indonesian homes.
 */
export const NIGHT_SHAPE = [0.13, 0.15, 0.15, 0.13, 0.1, 0.07, 0.04, 0.04, 0.04, 0.04, 0.05, 0.06];

/**
 * The fraction of a day's energy used between 06:00 and 18:00.
 * Starts from a base and adds an amount for each "yes", kept between a floor and a cap.
 * On weekends someone is assumed to be home whatever the weekday answer.
 */
export function daytimeShare(lifestyle: LifestyleInput, assumptions: AssumptionSet, isWeekend: boolean): number {
  let share = valueOf(assumptions, "load.daytimeShare.base");
  if (lifestyle.homeOnWeekdays || isWeekend) share += valueOf(assumptions, "load.daytimeShare.homeOnWeekdays");
  if (lifestyle.daytimeAc) share += valueOf(assumptions, "load.daytimeShare.daytimeAc");
  if (lifestyle.workFromHome) share += valueOf(assumptions, "load.daytimeShare.workFromHome");
  if (lifestyle.electricVehicle) share += valueOf(assumptions, "load.daytimeShare.electricVehicle");

  const floor = valueOf(assumptions, "load.daytimeShare.floor");
  const cap = valueOf(assumptions, "load.daytimeShare.cap");
  return Math.min(cap, Math.max(floor, share));
}

/**
 * The fraction of one day's energy used in each hour, 00:00 to 23:00. Sums to 1.
 * Daytime hours share out `share`; night hours share out the rest.
 */
export function hourlyFractions(share: number): number[] {
  const fractions: number[] = [];
  for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
    if (isDaytimeHour(hour)) {
      fractions.push(share * DAY_SHAPE[hour - DAY_START_HOUR]);
    } else {
      // NIGHT_SHAPE starts at 18:00, so 18:00 is index 0 and 00:00 is index 6.
      const hoursAfterSunset = (hour - DAY_END_HOUR + HOURS_PER_DAY) % HOURS_PER_DAY;
      fractions.push((1 - share) * NIGHT_SHAPE[hoursAfterSunset]);
    }
  }
  return fractions;
}

/**
 * The home's use in every hour of the year, in kWh. 8,760 values.
 * Each day in a month uses the same total (the month's energy ÷ its days);
 * weekdays and weekends differ only in when that energy is used.
 */
export function buildHourlyLoad(monthlyKwh: Monthly, lifestyle: LifestyleInput, assumptions: AssumptionSet): number[] {
  const weekdayFractions = hourlyFractions(daytimeShare(lifestyle, assumptions, false));
  const weekendFractions = hourlyFractions(daytimeShare(lifestyle, assumptions, true));

  const load: number[] = [];
  let dayOfYear = 0;
  for (let month = 0; month < DAYS_IN_MONTH.length; month++) {
    const dailyKwh = monthlyKwh[month] / DAYS_IN_MONTH[month];
    for (let day = 0; day < DAYS_IN_MONTH[month]; day++) {
      const fractions = isWeekendDay(dayOfYear) ? weekendFractions : weekdayFractions;
      for (let hour = 0; hour < HOURS_PER_DAY; hour++) {
        load.push(dailyKwh * fractions[hour]);
      }
      dayOfYear++;
    }
  }
  if (dayOfYear !== DAYS_PER_YEAR) {
    throw new Error("Calendar error: the months do not add up to a year.");
  }
  return load;
}
