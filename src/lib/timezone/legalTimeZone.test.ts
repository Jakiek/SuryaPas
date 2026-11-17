import { describe, expect, it, vi } from "vitest";

// "server-only" throws outside the Next.js server build; tests are plain Node.
vi.mock("server-only", () => ({}));

import { legalUtcOffsetHours, PinOutsideIndonesiaError } from "./legalTimeZone";

// Each row: place, latitude, longitude, expected UTC offset (SPEC 3.4).
const placesOnLand: [string, number, number, 7 | 8 | 9][] = [
  ["Banda Aceh", 5.55, 95.32, 7],
  ["Medan", 3.59, 98.67, 7],
  ["Jakarta", -6.2, 106.85, 7],
  ["Yogyakarta", -7.8, 110.37, 7],
  ["Surabaya", -7.25, 112.75, 7],
  ["Malang", -7.98, 112.63, 7],
  ["Banyuwangi", -8.22, 114.37, 7],
  ["Pontianak", -0.03, 109.33, 7],
  ["Palangka Raya", -2.21, 113.92, 7],
  ["Denpasar", -8.65, 115.22, 8],
  ["Mataram", -8.58, 116.12, 8],
  ["Kupang", -10.17, 123.61, 8],
  ["Banjarmasin", -3.32, 114.59, 8],
  ["Balikpapan", -1.24, 116.83, 8],
  ["Makassar", -5.15, 119.43, 8],
  ["Manado", 1.47, 124.84, 8],
  ["Melonguane, Talaud islands", 4.0, 126.67, 8],
  ["Ternate", 0.79, 127.38, 9],
  ["Sanana, Sula islands", -2.06, 125.97, 9],
  ["Ambon", -3.7, 128.18, 9],
  ["Jayapura", -2.53, 140.72, 9],
];

// Pairs of towns a few kilometres either side of a zone border, both on land.
const acrossBorders: [string, number, number, 7 | 8 | 9][] = [
  // Central Kalimantan (WIB) against South Kalimantan (WITA).
  ["Buntok, Central Kalimantan", -1.71, 114.83, 7],
  ["Barabai, South Kalimantan", -2.58, 115.38, 8],
  ["Tamiang Layang, Central Kalimantan", -2.12, 115.1, 7],
  ["Kandangan, South Kalimantan", -2.77, 115.26, 8],
  // Bali (WITA) against East Java (WIB), across the Bali Strait.
  ["Negara, Bali", -8.36, 114.62, 8],
  ["Gilimanuk, Bali", -8.17, 114.44, 8],
  ["Ketapang, Banyuwangi, East Java", -8.13, 114.39, 7],
  ["Genteng, Banyuwangi, East Java", -8.37, 114.15, 7],
];

describe("legalUtcOffsetHours", () => {
  it.each(placesOnLand)("%s", (_place, latitude, longitude, expected) => {
    expect(legalUtcOffsetHours(latitude, longitude)).toBe(expected);
  });

  it.each(acrossBorders)("%s (near a zone border)", (_place, latitude, longitude, expected) => {
    expect(legalUtcOffsetHours(latitude, longitude)).toBe(expected);
  });

  // The south coast of Java at Parangtritis is at about 8.029 S; the margin of
  // SPEC 2.2 is 2 km, about 0.018 degrees.
  it("takes the nearest province's zone for a pin 1 km offshore", () => {
    expect(legalUtcOffsetHours(-8.038, 110.33)).toBe(7);
  });

  it("throws for a pin 3 km offshore, past the 2 km margin", () => {
    expect(() => legalUtcOffsetHours(-8.06, 110.33)).toThrow(PinOutsideIndonesiaError);
  });

  it("throws for a pin far out in the Indian Ocean", () => {
    expect(() => legalUtcOffsetHours(-15, 105)).toThrow(PinOutsideIndonesiaError);
  });

  it("throws for a pin in Singapore, outside Indonesia", () => {
    expect(() => legalUtcOffsetHours(1.3, 103.85)).toThrow(PinOutsideIndonesiaError);
  });
});
