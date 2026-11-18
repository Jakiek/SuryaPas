// The legal time zone of a pin in Indonesia (SPEC 3.4, "Requested in UTC").
//
// The sun series is fetched in UTC and later rotated to the home's clock, so
// the server needs to know whether the home is on WIB (UTC+7), WITA (UTC+8)
// or WIT (UTC+9). The zone follows the province, so we find the province.
//
// `server-only` keeps the 270 KB province file out of the browser bundle.
import "server-only";
import provinceFile from "../../../data/indonesia-provinces.json";

export type LegalUtcOffsetHours = 7 | 8 | 9;

/** The pin is farther than the 2 km margin (SPEC 2.2) from every province. */
export class PinOutsideIndonesiaError extends Error {
  constructor(latitude: number, longitude: number) {
    super(`The pin (${latitude}, ${longitude}) is not in Indonesia, so it has no legal time zone.`);
    this.name = "PinOutsideIndonesiaError";
  }
}

// SPEC 2.2: a pin within 2 km of the outline counts as inside.
const MARGIN_KM = 2;
const KM_PER_DEGREE_OF_LATITUDE = 111.32;

type Point = { longitude: number; latitude: number };
// The smallest box that holds an island, used to skip islands far from the pin.
type BoundingBox = { minLongitude: number; maxLongitude: number; minLatitude: number; maxLatitude: number };
type Island = BoundingBox & { ring: Point[] };
type Province = { name: string; utcOffsetHours: LegalUtcOffsetHours; islands: Island[] };

/** Turns the file's compact ring [lon0, lat0, dLon1, dLat1, ...] into points. */
function decodeRing(flat: number[], unitsPerDegree: number): Point[] {
  const ring: Point[] = [];
  let longitude = 0;
  let latitude = 0;
  for (let i = 0; i < flat.length; i += 2) {
    longitude += flat[i];
    latitude += flat[i + 1];
    ring.push({ longitude: longitude / unitsPerDegree, latitude: latitude / unitsPerDegree });
  }
  return ring;
}

function toIsland(ring: Point[]): Island {
  const longitudes = ring.map((point) => point.longitude);
  const latitudes = ring.map((point) => point.latitude);
  return {
    ring,
    minLongitude: Math.min(...longitudes),
    maxLongitude: Math.max(...longitudes),
    minLatitude: Math.min(...latitudes),
    maxLatitude: Math.max(...latitudes),
  };
}

// Decoded once, when the module first loads, not on every request.
const provinces: Province[] = provinceFile.provinces.map((province) => ({
  name: province.name,
  utcOffsetHours: province.utcOffsetHours as LegalUtcOffsetHours,
  islands: province.islands.map((flat) => toIsland(decodeRing(flat, provinceFile.unitsPerDegree))),
}));

/** Ray casting: count how many ring edges a ray going east from the pin crosses; odd means inside. */
function isInsideRing(pin: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const edgeStraddlesPinLatitude = a.latitude > pin.latitude !== b.latitude > pin.latitude;
    if (!edgeStraddlesPinLatitude) continue;
    const longitudeWhereEdgeMeetsPinLatitude =
      a.longitude + ((pin.latitude - a.latitude) / (b.latitude - a.latitude)) * (b.longitude - a.longitude);
    if (pin.longitude < longitudeWhereEdgeMeetsPinLatitude) inside = !inside;
  }
  return inside;
}

/** Distance in km from the pin to the segment a-b, on a flat map centred on the pin (fine at 2 km). */
function distanceToSegmentKm(pin: Point, a: Point, b: Point): number {
  const kmPerDegreeOfLongitude = KM_PER_DEGREE_OF_LATITUDE * Math.cos((pin.latitude * Math.PI) / 180);
  const toKm = (point: Point) => ({
    x: (point.longitude - pin.longitude) * kmPerDegreeOfLongitude,
    y: (point.latitude - pin.latitude) * KM_PER_DEGREE_OF_LATITUDE,
  });
  const start = toKm(a);
  const end = toKm(b);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  // How far along a-b the closest point is, from 0 (at a) to 1 (at b); the pin is the origin.
  const unclampedAlong = lengthSquared === 0 ? 0 : -(start.x * dx + start.y * dy) / lengthSquared;
  // Clamped to the segment: past either end, the closest point is that end.
  const along = Math.max(0, Math.min(1, unclampedAlong));
  return Math.hypot(start.x + along * dx, start.y + along * dy);
}

function distanceToRingKm(pin: Point, ring: Point[]): number {
  let nearest = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    nearest = Math.min(nearest, distanceToSegmentKm(pin, ring[j], ring[i]));
  }
  return nearest;
}

/** Cheap test that skips islands whose bounding box (grown by the margin) cannot hold the pin. */
function isNearBoundingBox(pin: Point, island: Island): boolean {
  const marginLatitude = MARGIN_KM / KM_PER_DEGREE_OF_LATITUDE;
  const marginLongitude = marginLatitude / Math.cos((pin.latitude * Math.PI) / 180);
  return (
    pin.latitude >= island.minLatitude - marginLatitude &&
    pin.latitude <= island.maxLatitude + marginLatitude &&
    pin.longitude >= island.minLongitude - marginLongitude &&
    pin.longitude <= island.maxLongitude + marginLongitude
  );
}

/** The province whose area holds the pin, if any. */
function provinceContaining(pin: Point): Province | undefined {
  return provinces.find((province) =>
    province.islands.some((island) => isNearBoundingBox(pin, island) && isInsideRing(pin, island.ring)),
  );
}

/** The province whose coast is nearest the pin, if one is within the margin. */
function provinceWithinMargin(pin: Point): Province | undefined {
  let nearest: Province | undefined;
  let nearestKm = MARGIN_KM;
  for (const province of provinces) {
    for (const island of province.islands) {
      if (!isNearBoundingBox(pin, island)) continue;
      const distanceKm = distanceToRingKm(pin, island.ring);
      if (distanceKm <= nearestKm) {
        nearest = province;
        nearestKm = distanceKm;
      }
    }
  }
  return nearest;
}

/**
 * The legal UTC offset of the pin: 7 (WIB), 8 (WITA) or 9 (WIT).
 * Inside a province: that province's zone. In no province but within 2 km of
 * one: the nearest province's zone. Farther out: throws PinOutsideIndonesiaError.
 */
export function legalUtcOffsetHours(latitude: number, longitude: number): LegalUtcOffsetHours {
  const pin = { latitude, longitude };
  const province = provinceContaining(pin) ?? provinceWithinMargin(pin);
  if (!province) throw new PinOutsideIndonesiaError(latitude, longitude);
  return province.utcOffsetHours;
}
