// The Indonesia check (SPEC 2.2 step 1): is a pin inside the bundled country
// outline, or within 2 km of it? The outline is geoBoundaries' Indonesia at
// district level, which keeps the small inhabited islands, simplified; see
// data/indonesia-outline.md for source, licence and the command.
// The 2 km margin exists because a simplified coastline cuts off harbours
// and houses built over the water.

import outline from "../../../data/indonesia-outline.json";

// A coordinate is [longitude, latitude]. A ring is a closed list of them;
// the outline holds one exterior ring per island.
type Coordinate = [number, number];
type Ring = Coordinate[];

/** SPEC 2.2 step 1: a pin this close to the outline counts as inside. */
export const COAST_MARGIN_KM = 2;

// Kilometres in one degree of latitude; a degree of longitude is this times
// cos(latitude). Good to well under 1% in Indonesia.
const KM_PER_DEGREE = 111.32;

interface Island {
  ring: Ring;
  west: number;
  south: number;
  east: number;
  north: number;
}

// Each island keeps its bounding box, so most islands are rejected by four
// comparisons before any edge is looked at.
/**
 * The file stores a ring as [lon0, lat0, dLon1, dLat1, ...] in thousandths
 * of a degree, each vertex a step from the one before (see
 * data/indonesia-outline.build.mjs). Turns that back into a closed ring.
 */
function decodeRing(flat: number[]): Ring {
  const ring: Ring = [];
  let longitude = 0;
  let latitude = 0;
  for (let i = 0; i < flat.length; i += 2) {
    longitude += flat[i];
    latitude += flat[i + 1];
    ring.push([longitude / outline.unitsPerDegree, latitude / outline.unitsPerDegree]);
  }
  ring.push(ring[0]);
  return ring;
}

const islands: Island[] = outline.islands.map((flat) => {
  const ring = decodeRing(flat);
  const longitudes = ring.map(([longitude]) => longitude);
  const latitudes = ring.map(([, latitude]) => latitude);
  return {
    ring,
    west: Math.min(...longitudes),
    east: Math.max(...longitudes),
    south: Math.min(...latitudes),
    north: Math.max(...latitudes),
  };
});

/**
 * Ray casting: draw a line from the point to the east and count how many
 * edges of the ring it crosses. An odd count means the point is inside.
 */
function ringContains(ring: Ring, longitude: number, latitude: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lonI, latI] = ring[i];
    const [lonJ, latJ] = ring[j];
    const straddles = latI > latitude !== latJ > latitude;
    if (!straddles) continue;
    const crossingLongitude = ((lonJ - lonI) * (latitude - latI)) / (latJ - latI) + lonI;
    if (longitude < crossingLongitude) inside = !inside;
  }
  return inside;
}

/** Distance in km from the point to the segment a-b, in a flat local map. */
function distanceToSegmentKm(
  point: Coordinate,
  a: Coordinate,
  b: Coordinate,
  kmPerDegreeLongitude: number,
): number {
  // Local flat coordinates in km with the point at the origin.
  const ax = (a[0] - point[0]) * kmPerDegreeLongitude;
  const ay = (a[1] - point[1]) * KM_PER_DEGREE;
  const bx = (b[0] - point[0]) * kmPerDegreeLongitude;
  const by = (b[1] - point[1]) * KM_PER_DEGREE;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  // Where along the segment the closest spot lies: 0 at a, 1 at b.
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  return Math.hypot(ax + along * dx, ay + along * dy);
}

function isNearRing(ring: Ring, longitude: number, latitude: number): boolean {
  const kmPerDegreeLongitude = KM_PER_DEGREE * Math.cos((latitude * Math.PI) / 180);
  for (let i = 1; i < ring.length; i++) {
    const distance = distanceToSegmentKm([longitude, latitude], ring[i - 1], ring[i], kmPerDegreeLongitude);
    if (distance <= COAST_MARGIN_KM) return true;
  }
  return false;
}

/** True when the point is inside Indonesia or within 2 km of its outline. */
export function isInsideIndonesia(latitude: number, longitude: number): boolean {
  // The box grows by the margin, in degrees, before it is compared.
  const marginLatitude = COAST_MARGIN_KM / KM_PER_DEGREE;
  const marginLongitude = marginLatitude / Math.cos((latitude * Math.PI) / 180);

  const closeIslands = islands.filter(
    (island) =>
      latitude >= island.south - marginLatitude &&
      latitude <= island.north + marginLatitude &&
      longitude >= island.west - marginLongitude &&
      longitude <= island.east + marginLongitude,
  );
  return closeIslands.some(
    (island) => ringContains(island.ring, longitude, latitude) || isNearRing(island.ring, longitude, latitude),
  );
}
