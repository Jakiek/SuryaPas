import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "../assumptions";
import { DAYS_IN_MONTH, HOURS_PER_YEAR, emptyMonthly, hourOfDay, isDaytimeHour, monthOfHour } from "../calendar";
import type { LifestyleInput } from "../types";
import { DAY_SHAPE, NIGHT_SHAPE, buildHourlyLoad, daytimeShare, hourlyFractions } from "./loadProfile";

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const nobodyHome: LifestyleInput = { homeOnWeekdays: false, daytimeAc: false, workFromHome: false, electricVehicle: false };

describe("the day and night shapes", () => {
  it("each share out exactly one whole", () => {
    expect(DAY_SHAPE).toHaveLength(12);
    expect(NIGHT_SHAPE).toHaveLength(12);
    expect(sum(DAY_SHAPE)).toBeCloseTo(1, 10);
    expect(sum(NIGHT_SHAPE)).toBeCloseTo(1, 10);
  });
});

describe("daytimeShare", () => {
  it("is the base, 0.30, when nobody is home", () => {
    expect(daytimeShare(nobodyHome, ASSUMPTIONS_V1, false)).toBeCloseTo(0.3, 10);
  });

  it("adds an amount for each yes: 0.30 + 0.10 + 0.15 + 0.05 = 0.60", () => {
    const busyHome = { homeOnWeekdays: true, daytimeAc: true, workFromHome: true, electricVehicle: false };
    expect(daytimeShare(busyHome, ASSUMPTIONS_V1, false)).toBeCloseTo(0.6, 10);
  });

  it("lowers the share for an electric vehicle charged at night: 0.30 − 0.05 = 0.25", () => {
    expect(daytimeShare({ ...nobodyHome, electricVehicle: true }, ASSUMPTIONS_V1, false)).toBeCloseTo(0.25, 10);
  });

  it("treats weekends as someone home: 0.30 + 0.10 = 0.40", () => {
    expect(daytimeShare(nobodyHome, ASSUMPTIONS_V1, true)).toBeCloseTo(0.4, 10);
  });
});

describe("hourlyFractions", () => {
  it("adds up to one day, with the daytime hours holding exactly the daytime share", () => {
    const fractions = hourlyFractions(0.55);
    const daytime = sum(fractions.filter((_, hour) => isDaytimeHour(hour)));
    expect(fractions).toHaveLength(24);
    expect(sum(fractions)).toBeCloseTo(1, 10);
    expect(daytime).toBeCloseTo(0.55, 10);
  });

  it("puts the evening peak at 19:00 and 20:00", () => {
    const fractions = hourlyFractions(0.3);
    const nightPeak = Math.max(...fractions.filter((_, hour) => !isDaytimeHour(hour)));
    expect(fractions[19]).toBe(nightPeak);
    expect(fractions[20]).toBe(nightPeak);
  });
});

describe("buildHourlyLoad", () => {
  const monthlyKwh = [310, 280, 310, 300, 310, 300, 310, 310, 300, 310, 300, 310]; // 10 kWh a day

  it("covers every hour of the year", () => {
    expect(buildHourlyLoad(monthlyKwh, nobodyHome, ASSUMPTIONS_V1)).toHaveLength(HOURS_PER_YEAR);
  });

  it("adds back up to each month's energy", () => {
    const load = buildHourlyLoad(monthlyKwh, nobodyHome, ASSUMPTIONS_V1);
    const byMonth = emptyMonthly();
    load.forEach((kwh, hour) => (byMonth[monthOfHour(hour)] += kwh));
    byMonth.forEach((kwh, month) => expect(kwh).toBeCloseTo(monthlyKwh[month], 8));
  });

  it("uses 30% of a weekday's 10 kWh in the daytime, and 40% on a weekend", () => {
    const load = buildHourlyLoad(monthlyKwh, nobodyHome, ASSUMPTIONS_V1);
    const daytimeKwhOfDay = (day: number) =>
      sum(load.slice(day * 24, day * 24 + 24).filter((_, h) => isDaytimeHour(hourOfDay(h))));
    expect(daytimeKwhOfDay(0)).toBeCloseTo(3, 8); // 1 January, a Monday in the engine's year
    expect(daytimeKwhOfDay(5)).toBeCloseTo(4, 8); // the first Saturday
  });

  it("matches the calendar: twelve months, 365 days", () => {
    expect(sum(DAYS_IN_MONTH)).toBe(365);
  });
});
