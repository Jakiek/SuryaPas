import { describe, expect, it } from "vitest";
import {
  areaWarning,
  footprintAreaM2,
  usableAreaM2,
  type Corner,
} from "./roofGeometry";

// A rectangle 10 m east-west and 6 m north-south near Yogyakarta, built
// from metres per degree: 111,320 m of latitude, and 111,320 × cos(lat) of
// longitude. Its true area is 60 m².
const LATITUDE = -7.8;
const METRES_PER_DEGREE = 111_320;
const dLat = 6 / METRES_PER_DEGREE;
const dLon = 10 / (METRES_PER_DEGREE * Math.cos((LATITUDE * Math.PI) / 180));
const rectangle: Corner[] = [
  [110.37, LATITUDE],
  [110.37 + dLon, LATITUDE],
  [110.37 + dLon, LATITUDE + dLat],
  [110.37, LATITUDE + dLat],
];

describe("footprintAreaM2", () => {
  it("measures a 10 m by 6 m rectangle within 2% of 60 m²", () => {
    const measured = footprintAreaM2(rectangle)!;
    expect(Math.abs(measured - 60) / 60).toBeLessThan(0.02);
  });

  it("gives the same area whichever way round the corners run", () => {
    expect(footprintAreaM2([...rectangle].reverse())).toBeCloseTo(footprintAreaM2(rectangle)!, 6);
  });

  it("gives nothing for fewer than three corners", () => {
    expect(footprintAreaM2(rectangle.slice(0, 2))).toBeNull();
  });
});

describe("areaWarning", () => {
  it("warns below 5 m² and above 500 m², and stays quiet between", () => {
    expect(areaWarning(4.9)).toBe("tooSmall");
    expect(areaWarning(5)).toBeNull();
    expect(areaWarning(500)).toBeNull();
    expect(areaWarning(500.1)).toBe("tooLarge");
    expect(areaWarning(null)).toBeNull();
  });
});

describe("usableAreaM2", () => {
  it("is the area times the usable fraction", () => {
    expect(usableAreaM2(48, 0.65)).toBeCloseTo(31.2, 6);
  });
});
