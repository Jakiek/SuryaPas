// Builds data/indonesia-outline.json from the geoBoundaries Indonesia ADM2
// file (see indonesia-outline.md for where to download it and the licence).
//
//   node data/indonesia-outline.build.mjs <geoBoundaries-IDN-ADM2.geojson> 0.005 data/indonesia-outline.json
//
// What it does, so a reader can follow it:
//  1. Takes the exterior ring of every polygon of every district. Holes are
//     dropped (a pin on a lake counts as inside), and no island is dropped.
//  2. Simplifies each ring with Douglas-Peucker: a vertex is removed when the
//     line without it moves less than the tolerance (in degrees; 0.005 is
//     about 550 m). A ring that would shrink below a triangle keeps three
//     vertices, so the smallest islets stay as shapes.
//  3. Writes each ring as whole thousandths of a degree, the first vertex
//     absolute and the rest as steps from the previous one, without the
//     repeated closing vertex: [lon0, lat0, dLon1, dLat1, ...]. This is what
//     keeps 8,000 islands small.
import fs from "node:fs";

const [source, toleranceArgument, target] = process.argv.slice(2);
const tolerance = Number(toleranceArgument);
const UNITS_PER_DEGREE = 1000;

const collection = JSON.parse(fs.readFileSync(source, "utf8"));
const polygons = collection.features.flatMap((feature) =>
  feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates,
);

/** Distance in degrees from point p to the segment a-b. */
function distanceToSegment([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const along = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + along * dx), py - (ay + along * dy));
}

function simplify(points) {
  if (points.length < 3) return points;
  const first = points[0];
  const last = points[points.length - 1];
  let farthest = 0;
  let farthestIndex = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = distanceToSegment(points[i], first, last);
    if (distance > farthest) {
      farthest = distance;
      farthestIndex = i;
    }
  }
  if (farthest <= tolerance) return [first, last];
  return [...simplify(points.slice(0, farthestIndex + 1)).slice(0, -1), ...simplify(points.slice(farthestIndex))];
}

function encode(ring) {
  let simplified = simplify(ring);
  if (simplified.length < 4) {
    simplified = [ring[0], ring[Math.floor(ring.length / 3)], ring[Math.floor((2 * ring.length) / 3)], ring[0]];
  }
  const units = simplified.slice(0, -1).map(([lon, lat]) => [Math.round(lon * UNITS_PER_DEGREE), Math.round(lat * UNITS_PER_DEGREE)]);
  const flat = [...units[0]];
  for (let i = 1; i < units.length; i++) {
    flat.push(units[i][0] - units[i - 1][0], units[i][1] - units[i - 1][1]);
  }
  return flat;
}

const islands = polygons.map((polygon) => encode(polygon[0]));
const outline = {
  name: "Indonesia",
  source: "geoBoundaries gbOpen IDN ADM2 (BPS Statistics Indonesia, World Food Programme, OCHA ROAP), built 2023-12-12",
  licence: "CC BY 3.0 IGO",
  simplification: `exterior rings only; Douglas-Peucker tolerance ${tolerance} degrees; every island kept`,
  unitsPerDegree: UNITS_PER_DEGREE,
  islands,
};
fs.writeFileSync(target, JSON.stringify(outline));
console.log(`${islands.length} islands, ${fs.statSync(target).size} bytes`);
