import { describe, expect, it } from "vitest";
import { isInsideIndonesia } from "./indonesia";

// [name, latitude, longitude]
const inside: [string, number, number][] = [
  ["Jakarta", -6.2088, 106.8456],
  ["Jayapura", -2.5337, 140.7181],
  ["Yogyakarta", -7.7956, 110.3695],
  ["Denpasar", -8.6705, 115.2126],
  ["Kupang (west Timor)", -10.1772, 123.607],
  // The small inhabited islands a country-level outline loses.
  ["Pulau Pramuka", -5.7436, 106.6153],
  ["Pulau Pari", -5.8667, 106.6167],
  ["Pulau Tidung", -5.8044, 106.5],
  ["Pulau Untung Jawa", -5.9833, 106.7],
  ["Gili Trawangan", -8.3517, 116.038],
  ["Pulau Bunaken", 1.6167, 124.7667],
  ["Pulau Miangas", 5.561, 126.589],
  ["Pulau Derawan", 2.2833, 118.2467],
  ["Wanci (Wangi-wangi)", -5.3226, 123.6118],
  ["Pulau Penyengat", 0.929, 104.429],
  // The harbour is about 250 m outside some coarser coastlines: the 2 km margin.
  ["Sabang harbour", 5.8947, 95.3193],
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

  // The easternmost vertex of a Miangas islet is at 5.564 N, 126.588 E, and no
  // other land is within 90 km. A point due east of it is exactly as far from
  // the outline as the step we take. One degree of longitude at 5.564 N is
  // 111.32 km x cos(5.564 deg) = 111.32 x 0.99529 = 110.80 km, so:
  //   1 km = 1 / 110.80 = 0.009025 deg  -> 126.588 + 0.009025 = 126.597025
  //   5 km = 5 / 110.80 = 0.045126 deg  -> 126.588 + 0.045126 = 126.633126
  it("a point 1 km off the coast is inside (the margin is 2 km)", () => {
    expect(isInsideIndonesia(5.564, 126.597025)).toBe(true);
  });

  it("a point 5 km off the coast is outside", () => {
    expect(isInsideIndonesia(5.564, 126.633126)).toBe(false);
  });
});
