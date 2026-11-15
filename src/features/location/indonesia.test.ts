import { describe, expect, it } from "vitest";
import { isInsideIndonesia } from "./indonesia";

// [name, latitude, longitude]
const inside: [string, number, number][] = [
  ["Jakarta", -6.2088, 106.8456],
  ["Jayapura", -2.5337, 140.7181],
  // Weh island, just inland of the harbour. The harbour itself (5.8947,
  // 95.3193) falls about 250 m outside Natural Earth's own coastline.
  ["Sabang", 5.88, 95.32],
  ["Yogyakarta", -7.7956, 110.3695],
  ["Denpasar", -8.6705, 115.2126],
  ["Kupang (west Timor)", -10.1772, 123.607],
];

const outside: [string, number, number][] = [
  ["Kuala Lumpur", 3.139, 101.6869],
  ["Dili", -8.5569, 125.5603],
  ["Port Moresby", -9.4438, 147.1803],
  ["Singapore", 1.3521, 103.8198],
  ["Kota Kinabalu (Malaysian Borneo)", 5.9804, 116.0735],
  ["Perth", -31.9505, 115.8605],
  ["open sea, Indian Ocean", -20, 90],
];

describe("isInsideIndonesia", () => {
  it.each(inside)("%s is inside", (_name, latitude, longitude) => {
    expect(isInsideIndonesia(latitude, longitude)).toBe(true);
  });

  it.each(outside)("%s is outside", (_name, latitude, longitude) => {
    expect(isInsideIndonesia(latitude, longitude)).toBe(false);
  });
});
