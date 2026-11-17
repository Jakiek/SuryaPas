import { describe, expect, it, vi } from "vitest";
import { legalUtcOffsetHours } from "../timezone/legalTimeZone";
import { FALLBACK_CITIES } from "./cities";

// "server-only" throws outside the Next.js server build; tests are plain Node.
vi.mock("server-only", () => ({}));

describe("the fallback cities' clocks", () => {
  it.each(FALLBACK_CITIES.map((city) => [city.name, city] as const))(
    "%s carries the zone the province lookup gives",
    (_name, city) => {
      expect(city.utcOffsetHours).toBe(legalUtcOffsetHours(city.lat, city.lon));
    },
  );
});
