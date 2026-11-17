// Bundled sun series for major cities, used when NASA POWER is slow or down.
// Each series is scaled to its city's long-term mean by the build script, the
// same way the live service scales a fetched one. Like every stored series it
// is in UTC (SPEC 3.4); it is moved to a home's clock only when it is used.
import { FALLBACK_CITIES, type FallbackCity } from "./cities";
import { rotateUtcToLegalTime } from "./legalTime";
import type { LongTermScaling } from "./longTerm";
import { HOURS_PER_YEAR, TIME_STANDARD } from "./nasa";

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
  /** "UTC" (SPEC 3.4): readStoredFallbackFile refuses any other. A string
   *  here because a JSON import types it so. */
  timeStandard: string;
  /** 8,760 hourly values in W/m², already scaled, in UTC. */
  series: number[];
}

/** A city's bundled file with its series moved to that city's own clock. */
export interface FallbackFileOnCityClock extends Omit<FallbackFile, "timeStandard"> {
  /** The city's legal clock, hours ahead of UTC; `series` is in that clock time. */
  utcOffsetHours: 7 | 8 | 9;
}

/** What the sun service takes from the fallback: the nearest city's series, in UTC. */
export interface FallbackSun {
  city: FallbackCity;
  year: number;
  /** 8,760 hourly values in W/m², in UTC. */
  seriesUtc: number[];
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

/** A city's bundled file exactly as stored: its series in UTC. */
export async function readStoredFallbackFile(cityId: string): Promise<FallbackFile> {
  const loadFile = fileLoaders[cityId];
  if (!loadFile) throw new Error(`no fallback file for city ${cityId}`);
  const file = (await loadFile()).default;
  if (file.series.length !== HOURS_PER_YEAR) {
    throw new Error(`fallback file ${cityId} does not hold ${HOURS_PER_YEAR} values`);
  }
  // A file built before T20 held NASA's "LST" hours; rotating it as UTC would
  // put the sun an offset too late, so it is refused.
  if (file.timeStandard !== TIME_STANDARD) {
    throw new Error(`fallback file ${cityId} is not in ${TIME_STANDARD}`);
  }
  return file;
}

/**
 * A city's bundled file with its series on that city's own clock, for a
 * caller that uses a city's series for the city itself: the example house in
 * Yogyakarta (SPEC 5.1), and tests. The sun service does not use this; it
 * moves the UTC series to the clock of the pin, which may differ from the
 * nearest city's (a pin in Banyuwangi, WIB, is nearest Denpasar, WITA).
 */
export async function loadFallbackFile(cityId: string): Promise<FallbackFileOnCityClock> {
  const stored = await readStoredFallbackFile(cityId);
  const city = FALLBACK_CITIES.find((candidate) => candidate.id === cityId);
  if (!city) throw new Error(`no fallback city ${cityId}`);
  return {
    cityId: stored.cityId,
    name: stored.name,
    cellCentreLat: stored.cellCentreLat,
    cellCentreLon: stored.cellCentreLon,
    year: stored.year,
    fetchedAt: stored.fetchedAt,
    longTerm: stored.longTerm,
    utcOffsetHours: city.utcOffsetHours,
    series: rotateUtcToLegalTime(stored.series, city.utcOffsetHours),
  };
}

/** The bundled series of the city nearest to the point, in UTC. */
export async function loadNearestFallback(lat: number, lon: number): Promise<FallbackSun> {
  const city = nearestCity(lat, lon);
  const file = await readStoredFallbackFile(city.id);
  return { city, year: file.year, seriesUtc: file.series };
}
