// Checks the engine's solar yield against PVGIS, an independent model (task T07).
//
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/validate-pvgis.mjs           # offline: saved responses
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/validate-pvgis.mjs --fetch   # ask PVGIS and NASA again
//
// Two halves:
//   - The engine half runs the real engine (src/engine/) on the bundled NASA POWER series
//     in data/sun-fallback/, so it needs no network.
//   - The PVGIS half reads the responses saved in scripts/validate-pvgis-data/. With --fetch it
//     asks PVGIS 5.3 (and NASA POWER's monthly API, for a long-term mean) again and overwrites them.
//     Only city coordinates and system parameters are sent.
//
// It prints the tables that docs/VALIDATION.md shows, and says whether the orientation table in the
// current assumption set is the one these PVGIS runs give.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { registerHooks } from "node:module";

// ------------------------------------------------------------ loading the engine
// The engine is TypeScript with extensionless imports ("../assumptions"), as the Next.js bundler
// expects. Node runs TypeScript itself but wants full file names, so this hook tries ".ts" and
// "/index.ts" when a relative import is not found as written.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (!specifier.startsWith(".")) throw error;
      for (const suffix of [".ts", "/index.ts"]) {
        try {
          return nextResolve(specifier + suffix, context);
        } catch {
          // try the next suffix
        }
      }
      throw error;
    }
  },
});

const engine = await import("../src/engine/index.ts");
const { FALLBACK_CITIES } = await import("../src/lib/sun/cities.ts");
const { ASSUMPTIONS_V1, CURRENT_ASSUMPTIONS, solarPerKwp, valueOf } = engine;

// ------------------------------------------------------------ settings

const DATA_DIR = new URL("./validate-pvgis-data/", import.meta.url);
const SUN_DIR = new URL("../data/sun-fallback/", import.meta.url);

const PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc";
// The only PVGIS 5.3 database that covers Indonesia (see docs/VALIDATION.md). Named, not left to the default.
const PVGIS_DATABASE = "PVGIS-ERA5";
// PVGIS's own default for "system loss": inverter, cables, dirt, mismatch. Temperature, angle of
// incidence and spectrum PVGIS models separately, from the weather data.
const SYSTEM_LOSS_PERCENT = 14;

const NASA_MONTHLY_URL = "https://power.larc.nasa.gov/api/temporal/monthly/point";
const LONG_TERM_FIRST_YEAR = 2005; // PVGIS-ERA5 in PVGIS 5.3 covers 2005 to 2023
const LONG_TERM_LAST_YEAR = 2023;

const YIELD_CITIES = ["medan", "yogyakarta", "makassar"];
// The orientation table is derived at one site north of the equator and one south of it.
const ORIENTATION_SITES = ["medan", "yogyakarta"];

// The roof step offers "gentle" and "steep" as pictures, and no document gives them an angle.
// These are the pictures' angles (mock/atap.html: about 26° and 46°), rounded to 5°. This is an
// a choice recorded in SPEC 3.2 step 3; change it here and rerun to get the table for other angles.
const SLOPE_DEGREES = { gentle: 25, steep: 45 };
const TILT_SWEEP_DEGREES = [5, 10, 15, 20, 25, 30, 35, 40, 45];

// PVGIS "aspect": 0 is south, 90 west, 180 north, -90 east.
const ASPECT_OF_FACING = { S: 0, W: 90, N: 180, E: -90 };

const PAUSE_BETWEEN_REQUESTS_MS = 300; // PVGIS allows 30 calls a second; we stay far below
const DAYS_PER_YEAR = 365;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const cityById = (id) => FALLBACK_CITIES.find((city) => city.id === id);

// ------------------------------------------------------------ PVGIS requests

function pvgisUrl(city, tiltDegrees, facing) {
  const query = new URLSearchParams({
    lat: String(city.lat),
    lon: String(city.lon),
    peakpower: "1", // 1 kWp, so the answer is kWh per kWp
    loss: String(SYSTEM_LOSS_PERCENT),
    angle: String(tiltDegrees),
    aspect: String(ASPECT_OF_FACING[facing] ?? 0),
    raddatabase: PVGIS_DATABASE,
    outputformat: "json",
  });
  return `${PVGIS_URL}?${query.toString()}`;
}

/** Every PVGIS run this script uses: a flat roof at each city, and the tilt sweep at the two orientation sites. */
function plannedPvgisRuns() {
  const runs = YIELD_CITIES.map((id) => ({ cityId: id, tilt: 0, facing: "flat" }));
  for (const id of ORIENTATION_SITES) {
    for (const tilt of TILT_SWEEP_DEGREES) {
      for (const facing of ["N", "E", "S", "W"]) runs.push({ cityId: id, tilt, facing });
    }
  }
  return runs;
}

function nasaMonthlyUrl(lat, lon, lastYear) {
  const query = new URLSearchParams({
    parameters: "ALLSKY_SFC_SW_DWN",
    community: "RE",
    latitude: String(lat),
    longitude: String(lon),
    start: String(LONG_TERM_FIRST_YEAR),
    end: String(lastYear),
    format: "JSON",
  });
  return `${NASA_MONTHLY_URL}?${query.toString()}`;
}

const ATTEMPTS = 4;

/** GET with a few retries: both services sometimes drop a connection. A 4xx answer is not retried. */
async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      if (response.status >= 400 && response.status < 500) {
        throw Object.assign(new Error(`${response.status} from ${url}: ${text.slice(0, 200)}`), { final: true });
      }
      if (!response.ok) throw new Error(`${response.status} from ${url}`);
      return JSON.parse(text);
    } catch (error) {
      if (error.final || attempt === ATTEMPTS) throw error;
      console.error(`  attempt ${attempt} failed (${error.cause?.code ?? error.message}); retrying`);
      await sleep(attempt * 3_000);
    }
  }
}

/** Asks PVGIS and NASA POWER again and saves what they said, with the date. */
async function fetchAndSave() {
  await mkdir(DATA_DIR, { recursive: true });
  const fetchedAt = new Date().toISOString();

  const runs = [];
  let meta = null;
  for (const run of plannedPvgisRuns()) {
    const url = pvgisUrl(cityById(run.cityId), run.tilt, run.facing);
    console.error(`PVGIS ${run.cityId} ${run.tilt}° ${run.facing}`);
    const body = await getJson(url);
    // "meta" describes the fields and is the same in every response, so it is kept once.
    meta ??= body.meta;
    runs.push({ ...run, url, inputs: body.inputs, outputs: body.outputs });
    await sleep(PAUSE_BETWEEN_REQUESTS_MS);
  }
  await writeFile(new URL("pvgis-responses.json", DATA_DIR), JSON.stringify({ fetchedAt, meta, runs }, null, 1) + "\n");

  // NASA POWER monthly means at the cell centre the engine's series came from, so the
  // single year the engine uses can be set beside a long-term mean from the same source.
  const nasa = [];
  for (const id of YIELD_CITIES) {
    const sun = await readSunFile(id);
    const url = nasaMonthlyUrl(sun.cellCentreLat, sun.cellCentreLon, sun.year);
    console.error(`NASA POWER monthly ${id}`);
    const body = await getJson(url);
    nasa.push({ cityId: id, url, header: body.header, parameter: body.properties.parameter });
    await sleep(PAUSE_BETWEEN_REQUESTS_MS);
  }
  await writeFile(new URL("nasa-monthly.json", DATA_DIR), JSON.stringify({ fetchedAt, responses: nasa }, null, 1) + "\n");
}

// ------------------------------------------------------------ reading saved data

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

const readSunFile = (cityId) => readJson(new URL(`${cityId}.json`, SUN_DIR));

function findRun(runs, cityId, tilt, facing) {
  const run = runs.find((r) => r.cityId === cityId && r.tilt === tilt && r.facing === facing);
  if (!run) throw new Error(`no saved PVGIS run for ${cityId} ${tilt}° ${facing}; rerun with --fetch`);
  return run.outputs.totals.fixed;
}

/**
 * NASA POWER's yearly irradiation, kWh/m², for each year in the response.
 * The monthly API gives each year's mean day in kWh/m²/day under the key "YYYY13".
 */
function nasaYearlyTotals(parameter) {
  const totals = {};
  for (const [key, meanDay] of Object.entries(parameter.ALLSKY_SFC_SW_DWN)) {
    if (key.endsWith("13") && meanDay >= 0) totals[Number(key.slice(0, 4))] = meanDay * DAYS_PER_YEAR;
  }
  return totals;
}

// ------------------------------------------------------------ the engine half

const FLAT_ROOF = { areaM2: 100, usableFraction: 0.65, facing: "none", slope: "flat", shade: "none" };

/** The engine's yearly kWh per kWp on a flat, unshaded roof, from the bundled sun series. */
function engineFlatYield(sun, assumptions) {
  const hourly = solarPerKwp(sun.series, FLAT_ROOF, sun.cellCentreLat, assumptions);
  return hourly.reduce((sum, kwh) => sum + kwh, 0);
}

// ------------------------------------------------------------ formatting

const fmt0 = (x) => x.toLocaleString("en-US", { maximumFractionDigits: 0 });
const fmt3 = (x) => x.toFixed(3);
const pct = (ours, theirs) => {
  const difference = ((ours - theirs) / theirs) * 100;
  return `${difference >= 0 ? "+" : "−"}${Math.abs(difference).toFixed(1)}%`;
};
const round2 = (x) => Math.round(x * 100) / 100;
const mean = (values) => values.reduce((sum, v) => sum + v, 0) / values.length;

function table(header, rows) {
  const lines = [`| ${header.join(" | ")} |`, `| ${header.map(() => "---").join(" | ")} |`];
  for (const row of rows) lines.push(`| ${row.join(" | ")} |`);
  return lines.join("\n");
}

// ------------------------------------------------------------ main

if (process.argv.includes("--fetch")) await fetchAndSave();

const pvgis = await readJson(new URL("pvgis-responses.json", DATA_DIR));
const nasa = await readJson(new URL("nasa-monthly.json", DATA_DIR));
const prV1 = valueOf(ASSUMPTIONS_V1, "pv.performanceRatio");
const prCurrent = valueOf(CURRENT_ASSUMPTIONS, "pv.performanceRatio");

console.log(`PVGIS responses fetched ${pvgis.fetchedAt}; NASA POWER monthly fetched ${nasa.fetchedAt}`);
console.log(`PVGIS database: ${[...new Set(pvgis.runs.map((r) => r.inputs.meteo_data.radiation_db))].join(", ")}, ` +
  `years ${pvgis.runs[0].inputs.meteo_data.year_min}–${pvgis.runs[0].inputs.meteo_data.year_max}, ` +
  `system loss ${SYSTEM_LOSS_PERCENT}%, ${pvgis.runs[0].inputs.pv_module.technology}, ${pvgis.runs[0].inputs.mounting_system.fixed.type}`);
console.log(`Assumption sets: v${ASSUMPTIONS_V1.version} (performance ratio ${prV1}) and current v${CURRENT_ASSUMPTIONS.version} (${prCurrent})\n`);

const standardDeviation = (values) => {
  const average = mean(values);
  return Math.sqrt(mean(values.map((v) => (v - average) ** 2)));
};
// PVGIS writes a loss it could not work out as "?(0)": it used zero.
const lossText = (value) => (Number.isFinite(Number(value)) ? `${Number(value)}%` : `${value} (not modelled)`);

const yieldRows = [];
const sunRows = [];
const lossRows = [];
const gapRows = [];
for (const id of YIELD_CITIES) {
  const city = cityById(id);
  const sun = await readSunFile(id);
  const flat = findRun(pvgis.runs, id, 0, "flat");
  const pvgisYield = flat.E_y;
  const pvgisSun = flat["H(i)_y"]; // on a flat roof, in-plane irradiation is horizontal irradiation
  const engineV1 = engineFlatYield(sun, ASSUMPTIONS_V1);
  const engineNow = engineFlatYield(sun, CURRENT_ASSUMPTIONS);
  yieldRows.push([city.name, fmt0(engineNow), fmt0(pvgisYield), pct(engineNow, pvgisYield), fmt0(engineV1), pct(engineV1, pvgisYield)]);

  // Sunlight: the engine's single year, NASA's long-term mean, and ERA5's long-term mean.
  const nasaGhi = sun.series.reduce((sum, w) => sum + w, 0) / 1000;
  const nasaYears = nasaYearlyTotals(nasa.responses.find((r) => r.cityId === id).parameter);
  const longTerm = [];
  for (let year = LONG_TERM_FIRST_YEAR; year <= LONG_TERM_LAST_YEAR; year++) longTerm.push(nasaYears[year]);
  const nasaLongTerm = mean(longTerm);
  sunRows.push([
    city.name, fmt0(nasaGhi), fmt0(nasaYears[sun.year]), fmt0(nasaLongTerm),
    `${((standardDeviation(longTerm) / nasaLongTerm) * 100).toFixed(1)}%`, fmt0(pvgisSun),
  ]);

  // Losses: the share of that sunlight that reaches the socket.
  const pvgisRatio = pvgisYield / pvgisSun;
  lossRows.push([
    city.name, fmt3(pvgisRatio), lossText(flat.l_aoi), lossText(flat.l_spec), lossText(flat.l_tg),
    `−${SYSTEM_LOSS_PERCENT}%`, lossText(flat.l_total),
  ]);

  // The gap, split into three factors that multiply to it:
  //   engine ÷ PVGIS = (engine's year ÷ NASA mean) × (NASA mean ÷ ERA5 mean) × (engine ratio ÷ PVGIS ratio)
  gapRows.push([
    city.name, pct(nasaGhi, nasaLongTerm), pct(nasaLongTerm, pvgisSun), pct(prCurrent, pvgisRatio), pct(engineNow, pvgisYield),
  ]);
}

console.log("Table 1. Yearly yield, flat roof, no shade (kWh per kWp)\n");
console.log(table(
  ["City", `Engine v${CURRENT_ASSUMPTIONS.version}`, "PVGIS", "Difference", `Engine v${ASSUMPTIONS_V1.version}`, `Difference v${ASSUMPTIONS_V1.version}`],
  yieldRows,
));

console.log("\nTable 2. Yearly irradiation on a horizontal surface (kWh/m²)\n");
console.log(table(
  [
    "City", "NASA hourly, engine's year", "NASA monthly, same year", `NASA ${LONG_TERM_FIRST_YEAR}–${LONG_TERM_LAST_YEAR} mean`,
    "NASA year-to-year spread (1 s.d.)", `ERA5 ${LONG_TERM_FIRST_YEAR}–${LONG_TERM_LAST_YEAR} mean (PVGIS)`,
  ],
  sunRows,
));

console.log("\nTable 3. PVGIS losses on a flat roof\n");
console.log(table(["City", "Yield ÷ irradiation", "Angle of incidence", "Spectrum", "Temperature and low light", "System loss (input)", "Total"], lossRows));

console.log(`\nTable 4. Where the gap comes from (engine v${CURRENT_ASSUMPTIONS.version} against PVGIS)\n`);
console.log(table(
  ["City", "Year: engine's year vs NASA mean", "Database: NASA mean vs ERA5 mean", `Losses: ${prCurrent} vs PVGIS ratio`, "Total gap"],
  gapRows,
));

// Table 5: orientation factors, as a ratio to the flat result at the same site.
// "Toward the equator" is south at Medan and north at Yogyakarta.
function factorsAt(id, tilt) {
  const city = cityById(id);
  const flat = findRun(pvgis.runs, id, 0, "flat").E_y;
  const towardFacing = city.lat < 0 ? "N" : "S";
  const awayFacing = city.lat < 0 ? "S" : "N";
  const ratio = (facing) => findRun(pvgis.runs, id, tilt, facing).E_y / flat;
  return {
    towardEquator: ratio(towardFacing),
    east: ratio("E"),
    west: ratio("W"),
    awayFromEquator: ratio(awayFacing),
  };
}

function siteMeanFactors(tilt) {
  const perSite = ORIENTATION_SITES.map((id) => factorsAt(id, tilt));
  return {
    perSite,
    towardEquator: mean(perSite.map((f) => f.towardEquator)),
    // The engine has one value for east and west, so the two are averaged.
    eastWest: mean(perSite.flatMap((f) => [f.east, f.west])),
    awayFromEquator: mean(perSite.map((f) => f.awayFromEquator)),
  };
}

console.log(`\nTable 5. Orientation factor by tilt, mean of ${ORIENTATION_SITES.map((id) => cityById(id).name).join(" and ")} (PVGIS yield ÷ flat yield)\n`);
const sweepRows = TILT_SWEEP_DEGREES.map((tilt) => {
  const f = siteMeanFactors(tilt);
  const spread = Math.max(...["towardEquator", "awayFromEquator"].map((k) => Math.abs(f.perSite[0][k] - f.perSite[1][k])));
  return [`${tilt}°`, fmt3(f.towardEquator), fmt3(f.eastWest), fmt3(f.awayFromEquator), fmt3(spread)];
});
console.log(table(["Tilt", "Toward the equator", "East or west", "Away from the equator", "Largest gap between the two sites"], sweepRows));

console.log(`\nTable 6. Per site, at the slopes the engine uses\n`);
const siteRows = [];
for (const [slope, tilt] of Object.entries(SLOPE_DEGREES)) {
  for (const id of ORIENTATION_SITES) {
    const f = factorsAt(id, tilt);
    siteRows.push([`${slope} (${tilt}°)`, cityById(id).name, fmt3(f.towardEquator), fmt3(f.east), fmt3(f.west), fmt3(f.awayFromEquator)]);
  }
}
console.log(table(["Slope", "Site", "Toward the equator", "East", "West", "Away from the equator"], siteRows));

// The table the assumption set should hold: means, rounded to two decimals.
const derived = {};
for (const [slope, tilt] of Object.entries(SLOPE_DEGREES)) {
  const f = siteMeanFactors(tilt);
  derived[slope] = { towardEquator: round2(f.towardEquator), eastWest: round2(f.eastWest), awayFromEquator: round2(f.awayFromEquator) };
}

console.log(`\nTable 7. Orientation table derived (gentle ${SLOPE_DEGREES.gentle}°, steep ${SLOPE_DEGREES.steep}°), beside v${ASSUMPTIONS_V1.version}\n`);
const orientationRows = [];
for (const slope of Object.keys(SLOPE_DEGREES)) {
  for (const key of ["towardEquator", "eastWest", "awayFromEquator"]) {
    const old = ASSUMPTIONS_V1.orientation.table[slope][key];
    const now = CURRENT_ASSUMPTIONS.orientation.table[slope][key];
    orientationRows.push([slope, key, old.toFixed(2), derived[slope][key].toFixed(2), now.toFixed(2), (derived[slope][key] - old >= 0 ? "+" : "−") + Math.abs(derived[slope][key] - old).toFixed(2)]);
  }
}
console.log(table(["Slope", "Facing", `v${ASSUMPTIONS_V1.version}`, "Derived", `v${CURRENT_ASSUMPTIONS.version}`, "Change from v1"], orientationRows));

const matches = Object.keys(SLOPE_DEGREES).every((slope) =>
  ["towardEquator", "eastWest", "awayFromEquator"].every((key) => CURRENT_ASSUMPTIONS.orientation.table[slope][key] === derived[slope][key]),
);
console.log(`\nAssumption set v${CURRENT_ASSUMPTIONS.version} holds the derived orientation table: ${matches ? "yes" : "NO"}`);
if (!matches) process.exitCode = 1;
