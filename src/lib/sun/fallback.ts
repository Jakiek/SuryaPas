// Bundled sun series for major cities, used when NASA POWER is slow or down.
// Each series is scaled to its city's long-term mean by the build script, the
// same way the live service scales a fetched one, so it is used as it is.
import { FALLBACK_CITIES, type FallbackCity } from "./cities";
import type { LongTermScaling } from "./longTerm";
import { HOURS_PER_YEAR } from "./nasa";

export interface FallbackFile {
  cityId: string;
  name: string;
  /** Centre of the 0.5° cell that was fetched for this city. */
  cellCentreLat: number;
  cellCentreLon: number;
  /** The hourly year, before scaling. */
  year: number;
  /** When NASA POWER was asked for both records. */
  fetchedAt: string;
  /** How the series was scaled to the long-term mean (SPEC 3.4). Factor to 6
   *  decimals and kWh/m² to 2, as the build script writes them. */
  longTerm: LongTermScaling;
  /** 8,760 hourly values in W/m², already scaled. */
  series: number[];
}

export interface FallbackSun {
  city: FallbackCity;
  year: number;
  series: number[];
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in km (haversine formula). */
export function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function nearestCity(lat: number, lon: number): FallbackCity {
  let best = FALLBACK_CITIES[0];
  let bestDistance = Infinity;
  for (const city of FALLBACK_CITIES) {
    const distance = distanceKm(lat, lon, city.lat, city.lon);
    if (distance < bestDistance) {
      best = city;
      bestDistance = distance;
    }
  }
  return best;
}

// One lazy import per file, written out so the bundler can see every path and
// ship the JSON with the server build.
const fileLoaders: Record<string, () => Promise<{ default: FallbackFile }>> = {
  medan: () => import("../../../data/sun-fallback/medan.json"),
  jakarta: () => import("../../../data/sun-fallback/jakarta.json"),
  bandung: () => import("../../../data/sun-fallback/bandung.json"),
  yogyakarta: () => import("../../../data/sun-fallback/yogyakarta.json"),
  surabaya: () => import("../../../data/sun-fallback/surabaya.json"),
  denpasar: () => import("../../../data/sun-fallback/denpasar.json"),
  pontianak: () => import("../../../data/sun-fallback/pontianak.json"),
  balikpapan: () => import("../../../data/sun-fallback/balikpapan.json"),
  makassar: () => import("../../../data/sun-fallback/makassar.json"),
  manado: () => import("../../../data/sun-fallback/manado.json"),
  kupang: () => import("../../../data/sun-fallback/kupang.json"),
  jayapura: () => import("../../../data/sun-fallback/jayapura.json"),
};

export async function loadFallbackFile(cityId: string): Promise<FallbackFile> {
  const loadFile = fileLoaders[cityId];
  if (!loadFile) throw new Error(`no fallback file for city ${cityId}`);
  const file = (await loadFile()).default;
  if (file.series.length !== HOURS_PER_YEAR) {
    throw new Error(`fallback file ${cityId} does not hold ${HOURS_PER_YEAR} values`);
  }
  return file;
}

/** The bundled series of the city nearest to the point. */
export async function loadNearestFallback(lat: number, lon: number): Promise<FallbackSun> {
  const city = nearestCity(lat, lon);
  const file = await loadFallbackFile(city.id);
  return { city, year: file.year, series: file.series };
}
