// Builds the bundled sun series in data/sun-fallback/, one file per city.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-sun-fallback.mjs [year]
//
// For each city it asks NASA POWER for the same series the live service would
// fetch (the centre of the city's 0.5° cell, the latest complete year), using
// the same parsing code, and writes data/sun-fallback/<id>.json.
// Needs network. Run it once a year, or when the city list changes.
//
// The imports below use ".ts" because Node runs these two files directly.
import { mkdir, writeFile } from "node:fs/promises";
import { FALLBACK_CITIES } from "../src/lib/sun/cities.ts";
import { gridCellFor } from "../src/lib/sun/grid.ts";
import { fetchNasaYear, latestCompleteYear } from "../src/lib/sun/nasa.ts";

const OUTPUT_DIR = new URL("../data/sun-fallback/", import.meta.url);
const TIMEOUT_MS = 60_000; // generous: this is a batch job, not a live request
const MAX_GAP_HOURS = 3; // same rule as the live service
const ATTEMPTS = 4;
const PAUSE_BETWEEN_REQUESTS_MS = 2_000; // be polite to a free public API

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithRetry(options) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchNasaYear(options);
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      console.warn(`  attempt ${attempt} failed (${error.message}); retrying`);
      await sleep(attempt * 5_000);
    }
  }
}

const year = Number(process.argv[2]) || latestCompleteYear(new Date());
await mkdir(OUTPUT_DIR, { recursive: true });

for (const city of FALLBACK_CITIES) {
  const cell = gridCellFor(city.lat, city.lon);
  console.log(`${city.name}: cell ${cell.cellId}, year ${year}`);
  const series = await fetchWithRetry({
    lat: cell.centreLat,
    lon: cell.centreLon,
    year,
    fetchFn: fetch,
    timeoutMs: TIMEOUT_MS,
    maxGapHours: MAX_GAP_HOURS,
  });
  // Values rounded to 0.01 W/m², which is the precision NASA gives.
  const rounded = series.map((value) => Math.round(value * 100) / 100);
  const yearlyKwhPerM2 = rounded.reduce((sum, value) => sum + value, 0) / 1000;
  console.log(`  ${rounded.length} values, ${yearlyKwhPerM2.toFixed(0)} kWh/m² a year`);

  // Header fields on separate lines, the series on one line: readable and compact.
  const text = [
    "{",
    `  "cityId": ${JSON.stringify(city.id)},`,
    `  "name": ${JSON.stringify(city.name)},`,
    `  "cellCentreLat": ${cell.centreLat},`,
    `  "cellCentreLon": ${cell.centreLon},`,
    `  "year": ${year},`,
    `  "series": ${JSON.stringify(rounded)}`,
    "}",
    "",
  ].join("\n");
  await writeFile(new URL(`${city.id}.json`, OUTPUT_DIR), text);
  await sleep(PAUSE_BETWEEN_REQUESTS_MS);
}
console.log("done");
