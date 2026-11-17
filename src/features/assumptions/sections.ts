// How the assumptions screen groups the assumption set. The sections follow
// the headings of docs/ASSUMPTIONS.md, with "System" split in three so that
// no section runs past a dozen rows.
//
// SECTION_OF is a Record over every AssumptionKey, so the type checker
// refuses to compile when an entry is added to the engine without a section.

import type { AssumptionKey, AssumptionSet } from "../../engine/assumptions";

export type SectionId =
  | "tariffs"
  | "regulation"
  | "cost"
  | "panels"
  | "sunlight"
  | "battery"
  | "household"
  | "finance";

/** The order sections appear on the screen. */
export const SECTION_ORDER: SectionId[] = [
  "tariffs",
  "regulation",
  "cost",
  "panels",
  "sunlight",
  "battery",
  "household",
  "finance",
];

/** The section of every scalar entry. "tariffs" holds only the power-class table, so no scalar key maps to it. */
const SECTION_OF: Record<AssumptionKey, Exclude<SectionId, "tariffs">> = {
  "minCharge.hours": "regulation",

  "capex.perKwp.low": "cost",
  "capex.perKwp.typical": "cost",
  "capex.perKwp.high": "cost",
  "battery.fixedCost": "cost",
  "battery.costPerKwh": "cost",
  "battery.replacementYear": "cost",
  "opex.yearlyShareOfCapex": "cost",
  "inverter.replacementYear": "cost",
  "inverter.replacementShareOfCapex": "cost",

  "panel.wattPeak": "panels",
  "panel.areaM2": "panels",
  "system.minKwp": "panels",
  "roof.usableFraction": "panels",
  "roof.usableFraction.min": "panels",
  "roof.usableFraction.max": "panels",

  "pv.performanceRatio": "sunlight",
  "pv.degradationPerYear": "sunlight",
  "shade.none": "sunlight",
  "shade.some": "sunlight",
  "shade.heavy": "sunlight",

  "battery.roundTripEfficiency": "battery",
  "battery.usableFraction": "battery",
  "battery.minFillShare": "battery",

  "load.daytimeShare.base": "household",
  "load.daytimeShare.homeOnWeekdays": "household",
  "load.daytimeShare.daytimeAc": "household",
  "load.daytimeShare.workFromHome": "household",
  "load.daytimeShare.electricVehicle": "household",
  "load.daytimeShare.floor": "household",
  "load.daytimeShare.cap": "household",
  "bill.overheadShare": "household",

  "finance.horizonYears": "finance",
  "finance.tariffEscalationPerYear": "finance",
  "grid.emissionKgCo2PerKwh": "finance",
};

/** The scalar entries of one section, in the order the assumption set lists them. */
export function keysInSection(section: SectionId, assumptions: AssumptionSet): AssumptionKey[] {
  const allKeys = Object.keys(assumptions.entries) as AssumptionKey[];
  return allKeys.filter((key) => SECTION_OF[key] === section);
}
