import { describe, expect, it } from "vitest";
import hourlyResponse from "./fixtures/nasa-hourly-yogyakarta-2025-utc.json";
import monthlyResponse from "./fixtures/nasa-monthly-yogyakarta-2006-2025.json";
import {
  LONG_TERM_YEARS,
  longTermMean,
  longTermYears,
  MIN_USABLE_YEARS,
  scaleToLongTerm,
  seriesIrradiation,
  yearlyIrradiation,
} from "./longTerm";
import { parseNasaHourly, SunDataError } from "./nasa";
import { buildNasaMonthlyUrl, parseNasaMonthly, type MonthlyRecord } from "./nasaMonthly";

/** Twelve months with the same mean day, kWh/m²/day. */
const everyMonth = (meanDay: number) => Array<number>(12).fill(meanDay);

/** A record of the years firstYear..lastYear, each with the same twelve months. */
function recordOf(firstYear: number, lastYear: number, months: (number | null)[]): MonthlyRecord {
  const record: MonthlyRecord = {};
  for (let year = firstYear; year <= lastYear; year++) record[year] = [...months];
  return record;
}

describe("the years used", () => {
  it("are the twenty ending with the hourly year itself", () => {
    expect(LONG_TERM_YEARS).toBe(20);
    expect(longTermYears(2025)).toEqual({ firstYear: 2006, lastYear: 2025 });
  });
});

describe("one year's irradiation from its months", () => {
  it("is each month's mean day times its days, February counted as 28", () => {
    // 1×31 + 2×28 + 3×31 + 4×30 + 5×31 + 6×30 + 7×31 + 8×31 + 9×30 + 10×31 + 11×30 + 12×31
    // = 31 + 56 + 93 + 120 + 155 + 180 + 217 + 248 + 270 + 310 + 330 + 372 = 2,382
    expect(yearlyIrradiation([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).toBe(2382);
  });

  it("is 365 days of a flat mean day", () => {
    expect(yearlyIrradiation(everyMonth(2))).toBe(730);
  });

  it("is unknown when a month is missing", () => {
    const months: (number | null)[] = everyMonth(2);
    months[5] = null;
    expect(yearlyIrradiation(months)).toBeNull();
  });
});

describe("the irradiation of an hourly series", () => {
  it("adds the hours: W/m² over one hour is Wh/m², ÷ 1000 is kWh/m²", () => {
    expect(seriesIrradiation([0, 100, 200, 100, 0])).toBeCloseTo(0.4, 12);
  });
});

describe("scaling a tiny series, worked by hand", () => {
  // Long-term record: every month of 2006–2025 has a mean day of 0.002 kWh/m²,
  // so every year is 0.002 × 365 = 0.73 kWh/m², and so is their mean.
  const record = recordOf(2006, 2025, everyMonth(0.002));

  it("raises a dull year: factor 0.73 ÷ 0.4 = 1.825", () => {
    // The "year" is five hours that add up to 0 + 100 + 200 + 100 + 0 = 400 Wh/m² = 0.4 kWh/m².
    const { series, scaling } = scaleToLongTerm([0, 100, 200, 100, 0], record, 2025);
    expect(scaling.meanKwhPerM2).toBeCloseTo(0.73, 12);
    expect(scaling.hourlyYearKwhPerM2).toBeCloseTo(0.4, 12);
    expect(scaling.factor).toBeCloseTo(1.825, 12);
    // Every hour × 1.825: 100 → 182.5, 200 → 365. Night stays 0.
    expect(series[0]).toBe(0);
    expect(series[1]).toBeCloseTo(182.5, 9);
    expect(series[2]).toBeCloseTo(365, 9);
    expect(series[3]).toBeCloseTo(182.5, 9);
    expect(series[4]).toBe(0);
    // The scaled year holds the long-term amount.
    expect(seriesIrradiation(series)).toBeCloseTo(0.73, 12);
  });

  it("lowers a bright year: factor 0.73 ÷ 0.8 = 0.9125", () => {
    const { series, scaling } = scaleToLongTerm([0, 200, 400, 200, 0], record, 2025);
    expect(scaling.factor).toBeCloseTo(0.9125, 12);
    expect(series[1]).toBeCloseTo(182.5, 9);
    expect(series[2]).toBeCloseTo(365, 9);
  });

  it("records the years it used", () => {
    const { scaling } = scaleToLongTerm([0, 100, 200, 100, 0], record, 2025);
    expect(scaling.firstYear).toBe(2006);
    expect(scaling.lastYear).toBe(2025);
    expect(scaling.yearsUsed).toHaveLength(20);
    expect(scaling.yearsUsed[0]).toBe(2006);
    expect(scaling.yearsUsed[19]).toBe(2025);
  });

  it("does not change the input series", () => {
    const input = [0, 100, 200, 100, 0];
    scaleToLongTerm(input, record, 2025);
    expect(input).toEqual([0, 100, 200, 100, 0]);
  });
});

describe("which years count", () => {
  it("leaves out a year with a missing month", () => {
    // Every year is 730 kWh/m² except 2016, which is very bright (9 kWh/m²/day)
    // but has no June. Counted, it would pull the mean above 730; left out,
    // the mean of the other nineteen is exactly 730.
    const record = recordOf(2006, 2025, everyMonth(2));
    const brightButIncomplete: (number | null)[] = everyMonth(9);
    brightButIncomplete[5] = null;
    record[2016] = brightButIncomplete;

    const mean = longTermMean(record, 2025);
    expect(mean.yearsUsed).toHaveLength(19);
    expect(mean.yearsUsed).not.toContain(2016);
    expect(mean.meanKwhPerM2).toBeCloseTo(730, 9);
  });

  it("ignores years outside the twenty, and years the record lacks", () => {
    const record = recordOf(2010, 2025, everyMonth(2)); // 2006–2009 absent
    record[2005] = everyMonth(50); // before the window
    record[2026] = everyMonth(50); // after it
    const mean = longTermMean(record, 2025);
    expect(mean.yearsUsed).toHaveLength(16);
    expect(mean.meanKwhPerM2).toBeCloseTo(730, 9);
  });

  it(`accepts exactly ${MIN_USABLE_YEARS} usable years`, () => {
    const record = recordOf(2016, 2025, everyMonth(2));
    expect(longTermMean(record, 2025).yearsUsed).toHaveLength(10);
  });

  it(`fails with fewer than ${MIN_USABLE_YEARS} usable years`, () => {
    const record = recordOf(2006, 2025, everyMonth(2));
    // Take a month out of eleven years, leaving nine complete ones.
    for (let year = 2006; year <= 2016; year++) record[year] = [null, ...everyMonth(2).slice(1)];
    expect(() => longTermMean(record, 2025)).toThrow(SunDataError);
    expect(() => scaleToLongTerm([0, 100, 0], record, 2025)).toThrow(SunDataError);
  });

  it("fails on a series with no sunlight", () => {
    const record = recordOf(2006, 2025, everyMonth(2));
    expect(() => scaleToLongTerm([0, 0, 0], record, 2025)).toThrow(SunDataError);
  });
});

describe("the monthly request", () => {
  it("asks for the same parameter over the twenty years, by year", () => {
    const url = new URL(buildNasaMonthlyUrl(-7.75, 110.25, 2006, 2025));
    expect(url.origin + url.pathname).toBe("https://power.larc.nasa.gov/api/temporal/monthly/point");
    expect(url.searchParams.get("parameters")).toBe("ALLSKY_SFC_SW_DWN");
    expect(url.searchParams.get("latitude")).toBe("-7.75");
    expect(url.searchParams.get("longitude")).toBe("110.25");
    expect(url.searchParams.get("start")).toBe("2006");
    expect(url.searchParams.get("end")).toBe("2025");
  });
});

describe("parsing the monthly response", () => {
  const responseWith = (values: Record<string, number>) => ({
    header: { fill_value: -999 },
    properties: { parameter: { ALLSKY_SFC_SW_DWN: values } },
  });

  it("reads twelve months per year and skips the yearly key 13", () => {
    const values: Record<string, number> = {};
    for (let month = 1; month <= 12; month++) values[`2025${String(month).padStart(2, "0")}`] = month;
    values["202513"] = 999;
    expect(parseNasaMonthly(responseWith(values), 2025, 2025)[2025]).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
  });

  it("turns -999 and an absent month into null", () => {
    // As NASA answered on 2026-11-15 for 2026: data to July, -999 after, December absent.
    const values: Record<string, number> = {};
    for (let month = 1; month <= 11; month++) {
      values[`2026${String(month).padStart(2, "0")}`] = month <= 7 ? 5 : -999;
    }
    const months = parseNasaMonthly(responseWith(values), 2026, 2026)[2026];
    expect(months).toEqual([5, 5, 5, 5, 5, 5, 5, null, null, null, null, null]);
  });

  it("refuses a response without the parameter", () => {
    expect(() => parseNasaMonthly({ properties: { parameter: {} } }, 2006, 2025)).toThrow(SunDataError);
    expect(() => parseNasaMonthly(null, 2006, 2025)).toThrow(SunDataError);
  });
});

// The two fixtures are real NASA POWER responses for the same 0.5° cell
// (-7.75, 110.25, Yogyakarta): the hourly year 2025, recorded 2026-11-14, and
// the monthly record 2006–2025, recorded 2026-11-15.
describe("a recorded Yogyakarta cell", () => {
  const hourly = parseNasaHourly(hourlyResponse, 2025, 3);
  const record = parseNasaMonthly(monthlyResponse, 2006, 2025);

  it("measures the same quantity in both records: 2025 agrees within 0.1%", () => {
    // Like for like: the hourly year and the monthly record's own 2025.
    const fromHours = seriesIrradiation(hourly);
    const fromMonths = yearlyIrradiation(record[2025]) as number;
    expect(Math.abs(fromHours - fromMonths) / fromMonths).toBeLessThan(0.001);
  });

  it("scales 2025 up by about 7%, to the twenty-year mean", () => {
    const { series, scaling } = scaleToLongTerm(hourly, record, 2025);
    expect(scaling.yearsUsed).toHaveLength(20);
    // docs/VALIDATION.md: 2025 was 6.9% below NASA's mean here.
    expect(scaling.factor).toBeGreaterThan(1.06);
    expect(scaling.factor).toBeLessThan(1.08);
    expect(seriesIrradiation(series)).toBeCloseTo(scaling.meanKwhPerM2, 6);
  });
});
