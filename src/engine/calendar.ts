// The engine's year: 365 days of 24 hours, with no leap day.
// Hour 0 is 1 January, 00:00 to 01:00, local time.

export const HOURS_PER_DAY = 24;
export const DAYS_PER_YEAR = 365;
export const HOURS_PER_YEAR = HOURS_PER_DAY * DAYS_PER_YEAR; // 8,760
export const MONTHS_PER_YEAR = 12;
export const DAYS_PER_WEEK = 7;

/** Days in each month, January to December, in a non-leap year. */
export const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Daytime, for the purpose of "daytime use", is 06:00 to 18:00. Near the equator that is sunrise to sunset all year. */
export const DAY_START_HOUR = 6;
export const DAY_END_HOUR = 18;

/** The month (0 to 11) of each day of the year (0 to 364). */
const MONTH_OF_DAY: number[] = DAYS_IN_MONTH.flatMap((days, month) => Array<number>(days).fill(month));

/** The month, 0 to 11, that an hour of the year falls in. */
export function monthOfHour(hourOfYear: number): number {
  return MONTH_OF_DAY[Math.floor(hourOfYear / HOURS_PER_DAY)];
}

/** The hour of the day, 0 to 23. */
export function hourOfDay(hourOfYear: number): number {
  return hourOfYear % HOURS_PER_DAY;
}

/** True between 06:00 and 18:00. */
export function isDaytimeHour(hour: number): boolean {
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

/**
 * True on Saturdays and Sundays.
 * The engine's year always starts on a Monday. Real years start on different weekdays,
 * but which days are weekends barely moves a yearly total, and a fixed start keeps results repeatable.
 */
export function isWeekendDay(dayOfYear: number): boolean {
  const SATURDAY = 5; // Monday is 0
  return dayOfYear % DAYS_PER_WEEK >= SATURDAY;
}

/** Twelve zeros, for adding up by month. */
export function emptyMonthly(): number[] {
  return Array<number>(MONTHS_PER_YEAR).fill(0);
}
