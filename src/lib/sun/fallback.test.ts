import { describe, expect, it } from "vitest";
import { FALLBACK_CITIES } from "./cities";
import { distanceKm, loadFallbackFile, loadNearestFallback, nearestCity, readStoredFallbackFile } from "./fallback";
import { rotateUtcToLegalTime } from "./legalTime";
import { HOURS_PER_YEAR } from "./nasa";

/** The year's mean day: 24 values, W/m², by hour of the series. */
function meanDay(series: number[]): number[] {
  const day = Array.from({ length: 24 }, () => 0);
  series.forEach((watts, hour) => (day[hour % 24] += watts / (series.length / 24)));
  return day;
}

describe("nearest city", () => {
  it("measures a known distance: Jakarta to Bandung is about 115 km", () => {
    const km = distanceKm(-6.2088, 106.8456, -6.9175, 107.6191);
    expect(km).toBeGreaterThan(105);
    expect(km).toBeLessThan(125);
  });

  it("picks the city closest to the pin", () => {
    expect(nearestCity(-7.72, 110.4).id).toBe("yogyakarta"); // Sleman
    expect(nearestCity(-8.4, 115.2).id).toBe("denpasar"); // Ubud
    expect(nearestCity(-2.2, 140.2).id).toBe("jayapura");
    expect(nearestCity(5.55, 95.32).id).toBe("medan"); // Banda Aceh
  });

  it("picks a city for a pin that is far from all of them", () => {
    expect(nearestCity(-3.7, 128.2).id).toBeTruthy(); // Ambon
  });
});

describe("the bundled files", () => {
  it("has one file per city, each with 8,760 non-negative values", async () => {
    expect(FALLBACK_CITIES.length).toBeGreaterThanOrEqual(12);
    for (const city of FALLBACK_CITIES) {
      const file = await loadFallbackFile(city.id);
      expect(file.cityId).toBe(city.id);
      expect(file.series).toHaveLength(HOURS_PER_YEAR);
      expect(file.series.every((value) => value >= 0 && Number.isFinite(value))).toBe(true);
    }
  });

  it("has the cities the task names", () => {
    const ids = FALLBACK_CITIES.map((city) => city.id);
    for (const id of [
      "medan", "jakarta", "bandung", "yogyakarta", "surabaya", "denpasar",
      "pontianak", "balikpapan", "makassar", "manado", "kupang", "jayapura",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("holds, in every file, a year whose total is the recorded long-term mean", async () => {
    for (const city of FALLBACK_CITIES) {
      const { year, longTerm, series } = await loadFallbackFile(city.id);
      // The twenty years ending with the hourly year, as SPEC 3.4 says.
      expect(longTerm.firstYear).toBe(year - 19);
      expect(longTerm.lastYear).toBe(year);
      expect(longTerm.yearsUsed.length).toBeGreaterThanOrEqual(10);
      // The factor is the mean ÷ the year's own total (both rounded to 0.01 kWh/m²).
      expect(longTerm.factor).toBeCloseTo(longTerm.meanKwhPerM2 / longTerm.hourlyYearKwhPerM2, 4);
      // The scaled series adds up to the mean. Rounding: each of about 4,400
      // daylight hours is rounded to 0.01 W/m², and the mean to 0.01 kWh/m².
      const yearlyKwhPerM2 = series.reduce((sum, watts) => sum + watts, 0) / 1000;
      expect(Math.abs(yearlyKwhPerM2 - longTerm.meanKwhPerM2)).toBeLessThan(0.05);
    }
  });

  it("is in UTC in every file (SPEC 3.4)", async () => {
    for (const city of FALLBACK_CITIES) {
      const file = await readStoredFallbackFile(city.id);
      expect(file.timeStandard, city.id).toBe("UTC");
      const day = meanDay(file.series);
      // 00:00 UTC is 07:00 to 09:00 on every Indonesian clock: the sun is up.
      // A series in local time would be dark here.
      expect(day[0], city.id).toBeGreaterThan(100);
      // 14:00 UTC is 21:00 to 23:00 on every Indonesian clock: dark.
      expect(day[14], city.id).toBe(0);
      // The brightest hour lies between 02:00 and 06:00 UTC (solar noon runs
      // from about 02:40 UTC at Jayapura to 05:25 UTC at Medan), and it is the
      // hour holding the cell's solar noon or the one before it (afternoon
      // cloud makes the late morning brighter).
      const brightest = day.indexOf(Math.max(...day));
      expect(brightest, city.id).toBeGreaterThanOrEqual(2);
      expect(brightest, city.id).toBeLessThanOrEqual(5);
      const solarNoonUtc = 12 - file.cellCentreLon / 15; // 15° of longitude per hour
      expect([Math.floor(solarNoonUtc) - 1, Math.floor(solarNoonUtc)], city.id).toContain(brightest);
    }
  });

  it("gives a city's series on that city's own clock for a caller that uses it for the city itself", async () => {
    for (const city of FALLBACK_CITIES) {
      const stored = await readStoredFallbackFile(city.id);
      const onCityClock = await loadFallbackFile(city.id);
      expect(onCityClock.utcOffsetHours).toBe(city.utcOffsetHours);
      expect(onCityClock.series).toEqual(rotateUtcToLegalTime(stored.series, city.utcOffsetHours));
    }
  });

  it("hands the sun service the nearest city's series in UTC", async () => {
    const fallback = await loadNearestFallback(-7.72, 110.4); // Sleman
    expect(fallback.city.id).toBe("yogyakarta");
    expect(fallback.seriesUtc).toEqual((await readStoredFallbackFile("yogyakarta")).series);
  });

  it("refuses an unknown city", async () => {
    await expect(loadFallbackFile("atlantis")).rejects.toThrow();
  });
});
