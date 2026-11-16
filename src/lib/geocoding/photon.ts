// Address search through Photon, the OpenStreetMap geocoder run by komoot
// (https://photon.komoot.io). It is built for search-as-you-type and needs
// no key. Its terms ask for fair use and warn that heavy use is throttled;
// this app sends one request per pause in typing (the browser debounces),
// and only from the server route, so the user's text never goes anywhere
// else. This file is pure: it builds the request and reads the answer; the
// route does the fetching.

export interface Place {
  label: string;
  lat: number;
  lon: number;
}

/** SPEC 5.1: "up to five places". */
export const MAX_PLACES = 5;

// Photon filters by a box, not by country, so the box is Indonesia's
// bounding box (west, south, east, north) and the country code is checked
// again on every result.
const INDONESIA_BOUNDING_BOX = "95,-11.5,141.5,6.5";
const INDONESIA_COUNTRY_CODE = "ID";

// Ask for more than we show: some results fall in the box but in a
// neighbouring country and are dropped below.
const REQUESTED_RESULTS = 10;

export function buildPhotonUrl(text: string): string {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", text);
  url.searchParams.set("limit", String(REQUESTED_RESULTS));
  url.searchParams.set("bbox", INDONESIA_BOUNDING_BOX);
  return url.toString();
}

// The parts of a Photon result that make a readable address.
interface PhotonProperties {
  name?: string;
  street?: string;
  locality?: string;
  district?: string;
  city?: string;
  county?: string;
  state?: string;
  countrycode?: string;
}

interface PhotonFeature {
  properties?: PhotonProperties;
  geometry?: { type?: string; coordinates?: unknown };
}

/**
 * "Grand Inna Malioboro, Jalan Malioboro, Suryatmajan, Yogyakarta, Special
 * Region of Yogyakarta". The district stays in: without it "Pulau Pramuka"
 * (an island) and "Jalan Pulau Pramuka" (a street) would read the same.
 */
function labelOf(properties: PhotonProperties): string {
  const town = properties.city ?? properties.county;
  const parts = [properties.name, properties.street, properties.district, town, properties.state];
  const seen = new Set<string>();
  const unique = parts.filter((part): part is string => {
    if (!part || seen.has(part)) return false;
    seen.add(part);
    return true;
  });
  return unique.join(", ");
}

function placeOf(feature: PhotonFeature): Place | null {
  const properties = feature.properties;
  const coordinates = feature.geometry?.coordinates;
  if (!properties || properties.countrycode !== INDONESIA_COUNTRY_CODE) return null;
  if (feature.geometry?.type !== "Point" || !Array.isArray(coordinates)) return null;

  // GeoJSON order is [longitude, latitude].
  const [lon, lat] = coordinates;
  if (typeof lon !== "number" || typeof lat !== "number") return null;

  const label = labelOf(properties);
  return label ? { label, lat, lon } : null;
}

/** Turns Photon's GeoJSON into at most five places in Indonesia. */
export function parsePhotonResponse(body: unknown): Place[] {
  const features = (body as { features?: unknown })?.features;
  if (!Array.isArray(features)) return [];

  const places: Place[] = [];
  for (const feature of features) {
    const place = placeOf(feature as PhotonFeature);
    if (place) places.push(place);
    if (places.length === MAX_PLACES) break;
  }
  return places;
}
