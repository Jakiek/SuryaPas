// Loaded into the SERVER process of the end-to-end tests (node --require, set
// by playwright.config.ts). It replaces the server's `fetch` so that the three
// outside services answer from recorded fixtures and nothing else can leave the
// machine:
//
//   NASA POWER   the hourly and monthly Yogyakarta files recorded in
//                src/lib/sun/fixtures. Two regions are made to fail on purpose,
//                so the "sun data slow or down" case (SPEC 2.5) can be tested.
//   Photon       a few recorded-shape answers for the addresses the tests type.
//   Supabase     answers 500 to everything. Only the second test server points
//                at it, to make saving fail (SPEC 2.5 "Saving fails").
//   anything else  refused, and named on stderr.
//
// It is plain CommonJS because `node --require` cannot load TypeScript, and it
// lives here, not in src/, because it is test machinery and no product code.

// `node --require` runs this file as CommonJS, so it cannot use import.
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("node:fs");
const path = require("node:path");

const fixtureDir = path.join(process.cwd(), "src/lib/sun/fixtures");
const hourlyBody = fs.readFileSync(path.join(fixtureDir, "nasa-hourly-yogyakarta-2025-utc.json"), "utf8");
const monthlyBody = fs.readFileSync(path.join(fixtureDir, "nasa-monthly-yogyakarta-2006-2025.json"), "utf8");

/** Where the test server's sun request is made to fail, by the 0.5 degree cell centre NASA is asked about. */
const NASA_DOWN = { latitude: [-5.6, -4.6], longitude: [119, 120] }; // Makassar: answers 503
const NASA_SLOW = { latitude: [3, 4], longitude: [98, 99] }; // Medan: never answers

const inBox = (value, [low, high]) => value >= low && value <= high;
const inRegion = (params, region) =>
  inBox(Number(params.get("latitude")), region.latitude) && inBox(Number(params.get("longitude")), region.longitude);

const PHOTON_PLACES = {
  malioboro: [
    { name: "Grand Inna Malioboro", street: "Jalan Malioboro", city: "Yogyakarta", state: "Special Region of Yogyakarta", lon: 110.366873, lat: -7.790843 },
    { name: "KHAS Malioboro Hotel", street: "Jalan Gadean", city: "Yogyakarta", state: "Special Region of Yogyakarta", lon: 110.3633, lat: -7.79826 },
  ],
  kaliurang: [
    { name: "Jalan Kaliurang Kilometer 5", city: "Sleman", state: "Special Region of Yogyakarta", lon: 110.3877, lat: -7.7596 },
  ],
  makassar: [{ name: "Pantai Losari", street: "Jalan Penghibur", city: "Makassar", state: "South Sulawesi", lon: 119.4079, lat: -5.1442 }],
  medan: [{ name: "Istana Maimun", street: "Jalan Brigjend Katamso", city: "Medan", state: "North Sumatra", lon: 98.6838, lat: 3.5752 }],
};

function photonBody(query) {
  const key = Object.keys(PHOTON_PLACES).find((name) => query.toLowerCase().includes(name));
  const features = (key ? PHOTON_PLACES[key] : []).map(({ lon, lat, ...properties }) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [lon, lat] },
    properties: { ...properties, countrycode: "ID" },
  }));
  return JSON.stringify({ type: "FeatureCollection", features });
}

const json = (body, status = 200) => new Response(body, { status, headers: { "content-type": "application/json" } });

/** An answer that never comes, until the caller gives up (the service's time limit aborts it). */
function neverAnswers(signal) {
  return new Promise((_resolve, reject) => {
    const abort = () => reject(new DOMException("aborted", "AbortError"));
    if (signal?.aborted) abort();
    signal?.addEventListener("abort", abort);
  });
}

const realFetch = globalThis.fetch;

globalThis.fetch = async function fixtureFetch(input, init) {
  const url = new URL(typeof input === "string" || input instanceof URL ? String(input) : input.url);
  const signal = init?.signal ?? (typeof input === "object" && "signal" in input ? input.signal : undefined);

  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return realFetch(input, init);

  if (url.hostname === "power.larc.nasa.gov") {
    if (inRegion(url.searchParams, NASA_DOWN)) return json("{}", 503);
    if (inRegion(url.searchParams, NASA_SLOW)) return neverAnswers(signal);
    if (url.pathname.includes("/hourly/")) return json(hourlyBody);
    if (url.pathname.includes("/monthly/")) return json(monthlyBody);
  }

  if (url.hostname === "photon.komoot.io") return json(photonBody(url.searchParams.get("q") ?? ""));

  // The second test server's database: every call is an error. It answers 500
  // and not 503 because the Supabase client retries a 503 with growing pauses,
  // which makes each save take 14 seconds.
  if (url.hostname === "supabase.test") return json('{"message":"database unavailable"}', 500);

  console.error(`[e2e] outside request refused: ${url.origin}${url.pathname}`);
  throw new TypeError(`network blocked in the end-to-end tests: ${url.origin}`);
};
