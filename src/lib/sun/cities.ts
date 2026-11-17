// Major cities spread across the archipelago. Each one has a bundled sun series
// in data/sun-fallback/<id>.json, built by scripts/build-sun-fallback.mjs.
// The fallback picks the nearest of these to the user's pin.
//
// Each city also carries its own legal time zone (SPEC 3.4), so its series can
// be read on its own clock where a city stands for itself, as Yogyakarta does
// for the example house. cities.test.ts checks every zone against the province
// lookup in src/lib/timezone/, which this file cannot import (it is server-only
// and the build script loads this file with plain Node).
//
// This file imports nothing, because the build script loads it directly with Node.
export interface FallbackCity {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** The city's legal clock: 7 (WIB), 8 (WITA) or 9 (WIT) hours ahead of UTC. */
  utcOffsetHours: 7 | 8 | 9;
}

export const FALLBACK_CITIES: readonly FallbackCity[] = [
  { id: "medan", name: "Medan", lat: 3.5952, lon: 98.6722, utcOffsetHours: 7 },
  { id: "jakarta", name: "Jakarta", lat: -6.2088, lon: 106.8456, utcOffsetHours: 7 },
  { id: "bandung", name: "Bandung", lat: -6.9175, lon: 107.6191, utcOffsetHours: 7 },
  { id: "yogyakarta", name: "Yogyakarta", lat: -7.7956, lon: 110.3695, utcOffsetHours: 7 },
  { id: "surabaya", name: "Surabaya", lat: -7.2575, lon: 112.7521, utcOffsetHours: 7 },
  { id: "denpasar", name: "Denpasar", lat: -8.6705, lon: 115.2126, utcOffsetHours: 8 },
  { id: "pontianak", name: "Pontianak", lat: -0.0263, lon: 109.3425, utcOffsetHours: 7 },
  { id: "balikpapan", name: "Balikpapan", lat: -1.2379, lon: 116.8529, utcOffsetHours: 8 },
  { id: "makassar", name: "Makassar", lat: -5.1477, lon: 119.4327, utcOffsetHours: 8 },
  { id: "manado", name: "Manado", lat: 1.4748, lon: 124.8421, utcOffsetHours: 8 },
  { id: "kupang", name: "Kupang", lat: -10.1772, lon: 123.607, utcOffsetHours: 8 },
  { id: "jayapura", name: "Jayapura", lat: -2.5337, lon: 140.7181, utcOffsetHours: 9 },
];
