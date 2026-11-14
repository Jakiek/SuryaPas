import { describe, expect, it } from "vitest";
import { FALLBACK_CITIES } from "./cities";
import { distanceKm, loadFallbackFile, nearestCity } from "./fallback";
import { HOURS_PER_YEAR } from "./nasa";

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

  it("refuses an unknown city", async () => {
    await expect(loadFallbackFile("atlantis")).rejects.toThrow();
  });
});
