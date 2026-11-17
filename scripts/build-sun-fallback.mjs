// Builds the bundled sun series in data/sun-fallback/, one file per city.
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-sun-fallback.mjs                 # offline
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-sun-fallback.mjs --fetch [year]  # ask NASA again
//
// Two steps, so the second can be rerun offline:
//
//   1. Fetch (only with --fetch; needs network, no key). For each city, the same
//      two requests the live service makes, under one time limit: the hourly
//      series at the centre of the city's 0.5° cell for the year (unless given,
//      the latest that ended at least six months ago, as the service uses), and NASA POWER's monthly record for the
//      twenty years ending with it. Only the cell's coordinates are sent. What
//      came back is saved in data/sun-fallback/source/<id>.json with the date:
//      the hourly series as the service parses it (unscaled, W/m², in UTC) and
//      the monthly response as NASA sent it.
//   2. Build (always). Scale each saved hourly series to the long-term mean
//      with the service's own code (SPEC 3.4), and write
//      data/sun-fallback/<id>.json with the factor and the years used.
//
// Every file is in UTC, like every stored series (SPEC 3.4), and says so in
// its "timeStandard" field. The sun service moves a series to the home's
// clock when it is used.
//
// Run --fetch once a year, or when the city list changes.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { registerHooks } from "node:module";

// The sun files are TypeScript with extensionless imports ("./nasa"), as the
// Next.js bundler expects. Node runs TypeScript itself but wants full file
// names, so this hook tries ".ts" when a relative import is not found as written.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith(".")) throw error;
      return nextResolve(`${specifier}.ts`, context);
    }
  },
});

const { FALLBACK_CITIES } = await import("../src/lib/sun/cities.ts");
const { gridCellFor } = await import("../src/lib/sun/grid.ts");
const { buildNasaUrl, fetchNasaYear, latestAvailableYear, withTimeLimit, SunDataError, TIME_STANDARD } = await import(
  "../src/lib/sun/nasa.ts"
);
const { buildNasaMonthlyUrl, parseNasaMonthly } = await import("../src/lib/sun/nasaMonthly.ts");
const { longTermYears, scaleToLongTerm } = await import("../src/lib/sun/longTerm.ts");

const OUTPUT_DIR = new URL("../data/sun-fallback/", import.meta.url);
const SOURCE_DIR = new URL("../data/sun-fallback/source/", import.meta.url);
const TIMEOUT_MS = 90_000; // generous: this is a batch job, not a live request
const MAX_GAP_HOURS = 3; // same rule as the live service
const ATTEMPTS = 4;
const PAUSE_BETWEEN_CITIES_MS = 2_000; // be polite to a free public API

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Values rounded to 0.01 W/m², which is the precision NASA gives.
const roundWatts = (value) => Math.round(value * 100) / 100;
const roundTo = (value, decimals) => Number(value.toFixed(decimals));

// ------------------------------------------------------------ step 1: fetch

/** Both requests for one city under one time limit, as the live service does. */
async function fetchCity(cell, year) {
  const { firstYear, lastYear } = longTermYears(year);
  const monthlyUrl = buildNasaMonthlyUrl(cell.centreLat, cell.centreLon, firstYear, lastYear);
  return withTimeLimit(TIMEOUT_MS, async (signal) => {
    const getMonthly = async () => {
      const response = await fetch(monthlyUrl, { signal });
      if (!response.ok) throw new SunDataError(`NASA POWER monthly answered ${response.status}`);
      return response.json();
    };
    const [hourly, monthly] = await Promise.all([
      fetchNasaYear({ lat: cell.centreLat, lon: cell.centreLon, year, fetchFn: fetch, signal, maxGapHours: MAX_GAP_HOURS }),
      getMonthly(),
    ]);
    return { hourlyUrl: buildNasaUrl(cell.centreLat, cell.centreLon, year), hourly, monthlyUrl, monthly };
  });
}

async function fetchWithRetry(cell, year) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetchCity(cell, year);
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      console.warn(`  attempt ${attempt} failed (${error.message}); retrying`);
      await sleep(attempt * 5_000);
    }
  }
}

async function fetchAndSaveSources(year) {
  await mkdir(SOURCE_DIR, { recursive: true });
  for (const city of FALLBACK_CITIES) {
    const cell = gridCellFor(city.lat, city.lon);
    console.log(`fetch ${city.name}: cell ${cell.cellId}, hourly ${year}, monthly ${longTermYears(year).firstYear}–${year}`);
    const fetched = await fetchWithRetry(cell, year);
    // Header fields on separate lines, each response on one line.
    const text = [
      "{",
      `  "cityId": ${JSON.stringify(city.id)},`,
      `  "fetchedAt": ${JSON.stringify(new Date().toISOString())},`,
      `  "cellCentreLat": ${cell.centreLat},`,
      `  "cellCentreLon": ${cell.centreLon},`,
      `  "year": ${year},`,
      `  "timeStandard": ${JSON.stringify(TIME_STANDARD)},`,
      `  "hourlyUrl": ${JSON.stringify(fetched.hourlyUrl)},`,
      `  "monthlyUrl": ${JSON.stringify(fetched.monthlyUrl)},`,
      `  "monthlyResponse": ${JSON.stringify(fetched.monthly)},`,
      `  "hourlySeries": ${JSON.stringify(fetched.hourly.map(roundWatts))}`,
      "}",
      "",
    ].join("\n");
    await writeFile(new URL(`${city.id}.json`, SOURCE_DIR), text);
    await sleep(PAUSE_BETWEEN_CITIES_MS);
  }
}

// ------------------------------------------------------------ step 2: build

async function buildCity(city) {
  const source = JSON.parse(await readFile(new URL(`${city.id}.json`, SOURCE_DIR), "utf8"));
  // A source saved before T20 holds NASA's "LST" hours; building from it would
  // label them UTC. Fetch again instead.
  if (source.timeStandard !== TIME_STANDARD) {
    throw new Error(`${city.id}: source is not in ${TIME_STANDARD}; run with --fetch`);
  }
  const { firstYear, lastYear } = longTermYears(source.year);
  const record = parseNasaMonthly(source.monthlyResponse, firstYear, lastYear);
  const { series, scaling } = scaleToLongTerm(source.hourlySeries, record, source.year);
  const rounded = series.map(roundWatts);

  const longTerm = {
    firstYear: scaling.firstYear,
    lastYear: scaling.lastYear,
    yearsUsed: scaling.yearsUsed,
    meanKwhPerM2: roundTo(scaling.meanKwhPerM2, 2),
    hourlyYearKwhPerM2: roundTo(scaling.hourlyYearKwhPerM2, 2),
    factor: roundTo(scaling.factor, 6),
  };
  const yearlyKwhPerM2 = rounded.reduce((sum, value) => sum + value, 0) / 1000;
  console.log(
    `${city.name.padEnd(11)} ${source.year}: ${longTerm.hourlyYearKwhPerM2.toFixed(0)} kWh/m²; ` +
      `${firstYear}–${lastYear} mean of ${scaling.yearsUsed.length} years: ${longTerm.meanKwhPerM2.toFixed(0)}; ` +
      `factor ${longTerm.factor.toFixed(4)}; scaled series ${yearlyKwhPerM2.toFixed(2)} kWh/m²`,
  );

  // Header fields on separate lines, the series on one line: readable and compact.
  const text = [
    "{",
    `  "cityId": ${JSON.stringify(city.id)},`,
    `  "name": ${JSON.stringify(city.name)},`,
    `  "cellCentreLat": ${source.cellCentreLat},`,
    `  "cellCentreLon": ${source.cellCentreLon},`,
    `  "year": ${source.year},`,
    `  "fetchedAt": ${JSON.stringify(source.fetchedAt)},`,
    `  "timeStandard": ${JSON.stringify(source.timeStandard)},`,
    `  "longTerm": ${JSON.stringify(longTerm)},`,
    `  "series": ${JSON.stringify(rounded)}`,
    "}",
    "",
  ].join("\n");
  await writeFile(new URL(`${city.id}.json`, OUTPUT_DIR), text);
}

// ------------------------------------------------------------ main

if (process.argv.includes("--fetch")) {
  const yearArgument = process.argv.slice(2).find((arg) => /^\d{4}$/.test(arg));
  await fetchAndSaveSources(Number(yearArgument) || latestAvailableYear(new Date()));
}
await mkdir(OUTPUT_DIR, { recursive: true });
for (const city of FALLBACK_CITIES) await buildCity(city);
console.log("done");
