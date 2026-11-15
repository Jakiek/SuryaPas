// Assumption set, version 1. Values collected on 2026-11-14.
// The research behind each value is in docs/ASSUMPTIONS.md, under the same key.
// To change any value, copy this file to a new version (SPEC 4.2); never edit a released version.

import type { AssumptionEntry, AssumptionSet, ConfidenceLabel } from "./types";

const DATE = "2026-11-14";

const PERMEN_7_2024 = "https://jdih.esdm.go.id/storage/document/Permen%20ESDM%20Nomor%207%20Tahun%202024.pdf";
const PRICE_TABLE = "Five installers' published prices; see docs/ASSUMPTIONS.md";
const BATTERY_BUILD_UP = "Built from component prices; see docs/ASSUMPTIONS.md";

/** A fixed entry: users cannot change it. */
function fixed(value: number, unit: string, label: ConfidenceLabel, source: string, url?: string): AssumptionEntry {
  return { value, unit, label, source, url, date: DATE, adjustable: false };
}

/** An entry users may change on the assumptions screen, within min and max. */
function adjustable(
  value: number,
  unit: string,
  label: ConfidenceLabel,
  source: string,
  range: { min: number; max: number },
  url?: string,
): AssumptionEntry {
  return { value, unit, label, source, url, date: DATE, adjustable: true, min: range.min, max: range.max };
}

export const ASSUMPTIONS_V1: AssumptionSet = {
  version: "1",

  entries: {
    // PLN's minimum monthly bill: this many hours at full connected power.
    "minCharge.hours": fixed(40, "hours", "sourced", "Energy Ministry Regulation 7/2024, Annex II", PERMEN_7_2024),

    // Installed cost of an on-grid system.
    "capex.perKwp.low": adjustable(11_000_000, "Rp/kWp", "thin", PRICE_TABLE, { min: 5_000_000, max: 40_000_000 }),
    "capex.perKwp.typical": adjustable(16_000_000, "Rp/kWp", "thin", PRICE_TABLE, { min: 5_000_000, max: 40_000_000 }),
    "capex.perKwp.high": adjustable(20_000_000, "Rp/kWp", "thin", PRICE_TABLE, { min: 5_000_000, max: 40_000_000 }),

    // A battery costs a fixed part (hybrid inverter, less the ordinary one it replaces) plus a part per kWh.
    "battery.fixedCost": adjustable(14_350_000, "Rp", "thin", BATTERY_BUILD_UP, { min: 0, max: 60_000_000 }),
    "battery.costPerKwh": adjustable(3_600_000, "Rp/kWh", "thin", BATTERY_BUILD_UP, { min: 1_000_000, max: 15_000_000 }),
    "battery.replacementYear": fixed(12, "year", "thin", "Deye LiFePO4 datasheet: 6,000 cycles, 10-year warranty", "https://deye.com/ro/?p=6721"),
    "battery.roundTripEfficiency": fixed(0.9, "share", "judgment", "Typical for lithium iron phosphate"),
    "battery.usableFraction": fixed(0.9, "share", "judgment", "Typical usable depth of discharge"),
    // A battery is offered only if a typical day's surplus fills at least this share of the smallest one.
    "battery.minFillShare": fixed(0.5, "share", "decision", "Product choice"),

    // Running costs.
    "opex.yearlyShareOfCapex": fixed(0.01, "share/year", "thin", "Gunardi and Amir 2024, Universitas Mercu Buana", "https://publikasi.mercubuana.ac.id/index.php/jte/article/download/19109/9745"),
    "inverter.replacementYear": fixed(12, "year", "decision", "Within the 10 to 15 years typical of a string inverter"),
    "inverter.replacementShareOfCapex": fixed(0.15, "share", "thin", "Median of three sources; see docs/ASSUMPTIONS.md"),

    // The hardware.
    "panel.wattPeak": fixed(550, "Wp", "sourced", "Sunova SS-550-72MDH datasheet", "https://download.axilogi.com/Sunova/SS-535-550-72MDH.pdf"),
    "panel.areaM2": fixed(2.6, "m²", "sourced", "Same datasheet: 2,279 × 1,134 mm", "https://download.axilogi.com/Sunova/SS-535-550-72MDH.pdf"),
    "system.minKwp": fixed(1.0, "kWp", "thin", "Smallest on-grid package most installers list"),
    // Default only: the roof step lets the user change it, and the engine reads the roof input.
    "roof.usableFraction": fixed(0.65, "share", "decision", "Agreed default, range 0.60 to 0.70"),

    // From sunlight to electricity.
    "pv.performanceRatio": fixed(0.78, "share", "judgment", "To be calibrated against PVGIS (T07)"),
    "pv.degradationPerYear": fixed(0.005, "share/year", "decision", "Typical panel warranty"),
    "shade.none": fixed(1.0, "multiplier", "judgment", "No shade"),
    "shade.some": fixed(0.9, "multiplier", "judgment", "Shade in the morning or afternoon"),
    "shade.heavy": fixed(0.7, "multiplier", "judgment", "Heavy shade; a site visit is needed"),

    // How much of a day's electricity is used between 06:00 and 18:00.
    "load.daytimeShare.base": fixed(0.3, "share", "judgment", "Nobody home in the daytime"),
    "load.daytimeShare.homeOnWeekdays": fixed(0.1, "share", "judgment", "Added when someone is home"),
    "load.daytimeShare.daytimeAc": fixed(0.15, "share", "judgment", "Added when air conditioning runs in the daytime"),
    "load.daytimeShare.workFromHome": fixed(0.05, "share", "judgment", "Added when someone works from home"),
    "load.daytimeShare.electricVehicle": fixed(-0.05, "share", "judgment", "An electric vehicle is assumed to charge at night"),
    "load.daytimeShare.floor": fixed(0.15, "share", "judgment", "Lower limit"),
    "load.daytimeShare.cap": fixed(0.75, "share", "judgment", "Upper limit"),

    // Share of what a household pays that is tax or fees and buys no energy.
    "bill.overheadShare": adjustable(0.05, "share", "judgment", "Street-lighting tax, 2.4% to 10% by region", { min: 0, max: 0.15 }),

    // Money over time.
    "finance.horizonYears": fixed(25, "years", "decision", "Typical panel life"),
    "finance.tariffEscalationPerYear": adjustable(0, "share/year", "decision", "Tariffs were flat through 2026", { min: 0, max: 0.1 }),

    // Climate.
    "grid.emissionKgCo2PerKwh": fixed(0.87, "kg CO₂/kWh", "thin", "Java-Bali grid, Energy Ministry Decree 163.K/HK.02/MEM.S/2021 (2019 data)"),
  },

  // PLN residential tariffs, October to December 2026. Listed from the smallest class up.
  // Subsidised postpaid homes pay a three-block tariff plus a fixed charge; this table approximates them (SPEC 3.2 step 1).
  powerClasses: {
    note: { label: "sourced", source: "Energy Ministry Regulation 7/2024, Annex II; press reports of the current quarter", url: PERMEN_7_2024, date: DATE },
    classes: {
      R1_450_subsidised: { maxVa: 450, subsidised: true, tariffRpPerKwh: 415, hasMinimumCharge: false },
      R1_900_subsidised: { maxVa: 900, subsidised: true, tariffRpPerKwh: 605, hasMinimumCharge: false },
      R1_900_nonsubsidised: { maxVa: 900, subsidised: false, tariffRpPerKwh: 1352, hasMinimumCharge: true },
      R1_1300: { maxVa: 1300, subsidised: false, tariffRpPerKwh: 1444.7, hasMinimumCharge: true },
      R1_2200: { maxVa: 2200, subsidised: false, tariffRpPerKwh: 1444.7, hasMinimumCharge: true },
      R2_3500_5500: { maxVa: 5500, subsidised: false, tariffRpPerKwh: 1699.53, hasMinimumCharge: true },
      R3_6600_up: { maxVa: Infinity, subsidised: false, tariffRpPerKwh: 1699.53, hasMinimumCharge: true },
    },
  },

  // A flat roof receives the horizontal irradiance as measured, so its factor is 1 and is not listed.
  orientation: {
    note: { label: "judgment", source: "Provisional; T07 replaces these with values derived from PVGIS", date: DATE },
    table: {
      gentle: { towardEquator: 1.01, eastWest: 0.99, awayFromEquator: 0.97 },
      steep: { towardEquator: 0.97, eastWest: 0.94, awayFromEquator: 0.88 },
    },
  },

  batterySizesKwh: {
    note: { label: "decision", source: "Common residential product sizes", date: DATE },
    sizes: [5, 10],
  },
};
