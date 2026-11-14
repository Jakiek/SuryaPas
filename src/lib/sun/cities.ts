// Major cities spread across the archipelago. Each one has a bundled sun series
// in data/sun-fallback/<id>.json, built by scripts/build-sun-fallback.mjs.
// The fallback picks the nearest of these to the user's pin.
//
// This file imports nothing, because the build script loads it directly with Node.
export interface FallbackCity {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export const FALLBACK_CITIES: readonly FallbackCity[] = [
  { id: "medan", name: "Medan", lat: 3.5952, lon: 98.6722 },
  { id: "jakarta", name: "Jakarta", lat: -6.2088, lon: 106.8456 },
  { id: "bandung", name: "Bandung", lat: -6.9175, lon: 107.6191 },
  { id: "yogyakarta", name: "Yogyakarta", lat: -7.7956, lon: 110.3695 },
  { id: "surabaya", name: "Surabaya", lat: -7.2575, lon: 112.7521 },
  { id: "denpasar", name: "Denpasar", lat: -8.6705, lon: 115.2126 },
  { id: "pontianak", name: "Pontianak", lat: -0.0263, lon: 109.3425 },
  { id: "balikpapan", name: "Balikpapan", lat: -1.2379, lon: 116.8529 },
  { id: "makassar", name: "Makassar", lat: -5.1477, lon: 119.4327 },
  { id: "manado", name: "Manado", lat: 1.4748, lon: 124.8421 },
  { id: "kupang", name: "Kupang", lat: -10.1772, lon: 123.607 },
  { id: "jayapura", name: "Jayapura", lat: -2.5337, lon: 140.7181 },
];
