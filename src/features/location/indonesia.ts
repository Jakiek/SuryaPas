// The Indonesia check (SPEC 2.2 step 1 and 2.5): is a pin inside the
// bundled country outline? The outline is a simplified Natural Earth shape,
// see data/indonesia-outline.md for its source and licence.

import outline from "../../../data/indonesia-outline.json";

// GeoJSON order: a coordinate is [longitude, latitude]. A ring is a closed
// list of coordinates; a polygon is an outer ring followed by its holes.
type Coordinate = [number, number];
type Ring = Coordinate[];
type Polygon = Ring[];

const indonesia = outline.geometry.coordinates as Polygon[];

/**
 * Ray casting: draw a line from the point to the east and count how many
 * edges of the ring it crosses. An odd count means the point is inside.
 */
function ringContains(ring: Ring, longitude: number, latitude: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lonI, latI] = ring[i];
    const [lonJ, latJ] = ring[j];
    // Does this edge straddle the point's latitude, and does the crossing
    // lie east of the point?
    const straddles = latI > latitude !== latJ > latitude;
    if (!straddles) continue;
    const crossingLongitude = ((lonJ - lonI) * (latitude - latI)) / (latJ - latI) + lonI;
    if (longitude < crossingLongitude) inside = !inside;
  }
  return inside;
}

/** Inside the outer ring and not inside a hole (a lake or an enclave). */
function polygonContains(polygon: Polygon, longitude: number, latitude: number): boolean {
  const [outer, ...holes] = polygon;
  if (!ringContains(outer, longitude, latitude)) return false;
  return !holes.some((hole) => ringContains(hole, longitude, latitude));
}

/** True when the point is inside any of Indonesia's islands. */
export function isInsideIndonesia(latitude: number, longitude: number): boolean {
  return indonesia.some((polygon) => polygonContains(polygon, longitude, latitude));
}
