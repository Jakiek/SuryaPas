// Builds data/indonesia-provinces.json from the geoBoundaries Indonesia ADM1
// file (see indonesia-provinces.md for where to download it and the licence).
//
//   node data/indonesia-provinces.build.mjs <geoBoundaries-IDN-ADM1.geojson> 0.003 data/indonesia-provinces.json
//
// Same method as indonesia-outline.build.mjs, with one addition: every
// province is tagged with its legal UTC offset (SPEC 3.4, "Requested in UTC").
//  1. Takes the exterior ring of every polygon of every province.
//  2. Simplifies each ring with Douglas-Peucker (tolerance in degrees; 0.003
//     is about 330 m). A ring never shrinks below a triangle.
//  3. Writes each ring as whole thousandths of a degree, the first vertex
//     absolute and the rest as steps from the previous one:
//     [lon0, lat0, dLon1, dLat1, ...].
import fs from "node:fs";

const [source, toleranceArgument, target] = process.argv.slice(2);
const tolerance = Number(toleranceArgument);
const UNITS_PER_DEGREE = 1000;

// SPEC 3.4: the legal time zone of each province, keyed by its ISO 3166-2 code
// (the shapeISO property of the source). The source has the 34 provinces that
// existed before the 2022 splits of Papua, so Papua and West Papua are WIT.
const WIB = 7; // Sumatra, Java, West and Central Kalimantan
const WITA = 8; // Bali, Nusa Tenggara, South/East/North Kalimantan, all of Sulawesi
const WIT = 9; // Maluku, North Maluku, Papua
const OFFSET_BY_ISO = {
  "ID-AC": WIB, "ID-SU": WIB, "ID-SB": WIB, "ID-RI": WIB, "ID-KR": WIB, "ID-JA": WIB,
  "ID-SS": WIB, "ID-BB": WIB, "ID-BE": WIB, "ID-LA": WIB, // Sumatra
  "ID-BT": WIB, "ID-JK": WIB, "ID-JB": WIB, "ID-JT": WIB, "ID-YO": WIB, "ID-JI": WIB, // Java
  "ID-KB": WIB, "ID-KT": WIB, // West and Central Kalimantan
  "ID-KS": WITA, "ID-KI": WITA, "ID-KU": WITA, // South, East, North Kalimantan
  "ID-BA": WITA, "ID-NB": WITA, "ID-NT": WITA, // Bali, West and East Nusa Tenggara
  "ID-SA": WITA, "ID-ST": WITA, "ID-SN": WITA, "ID-SG": WITA, "ID-GO": WITA, "ID-SR": WITA, // Sulawesi
  "ID-MA": WIT, "ID-MU": WIT, "ID-PA": WIT, "ID-PB": WIT, // Maluku, North Maluku, Papua
};

const collection = JSON.parse(fs.readFileSync(source, "utf8"));

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

const provinces = collection.features.map((feature) => {
  const iso = feature.properties.shapeISO;
  const utcOffsetHours = OFFSET_BY_ISO[iso];
  if (utcOffsetHours === undefined) throw new Error(`No time zone listed for ${iso} ${feature.properties.shapeName}`);
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  return { name: feature.properties.shapeName, iso, utcOffsetHours, islands: polygons.map((polygon) => encode(polygon[0])) };
});

const output = {
  name: "Indonesia provinces",
  source: "geoBoundaries gbOpen IDN ADM1 (BPS Statistics Indonesia, World Food Programme, OCHA ROAP), release 9469f09",
  licence: "CC BY 3.0 IGO",
  simplification: `exterior rings only; Douglas-Peucker tolerance ${tolerance} degrees; every island kept`,
  unitsPerDegree: UNITS_PER_DEGREE,
  provinces,
};
fs.writeFileSync(target, JSON.stringify(output));
console.log(`${provinces.length} provinces, ${provinces.reduce((n, p) => n + p.islands.length, 0)} islands, ${fs.statSync(target).size} bytes`);
