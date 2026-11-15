// The shape of an assumption set: every price, rate and factor the engine uses.
// docs/ASSUMPTIONS.md is the research record behind the values.

/** How far a value can be trusted. Shown to users on the assumptions screen. */
export type ConfidenceLabel = "sourced" | "thin" | "judgment" | "decision";

export interface SourceNote {
  label: ConfidenceLabel;
  /** Where the value comes from, in a few words. */
  source: string;
  /** Link to the source, when there is one. */
  url?: string;
  /** Date the value was collected, ISO format. */
  date: string;
}

/** One number, with its unit and where it came from. */
export interface AssumptionEntry extends SourceNote {
  value: number;
  unit: string;
  /** True when a user may change it on the assumptions screen. */
  adjustable: boolean;
  /** Allowed range for a user's change. Required when adjustable. */
  min?: number;
  max?: number;
}

export type TariffClass =
  | "R1_450_subsidised"
  | "R1_900_subsidised"
  | "R1_900_nonsubsidised"
  | "R1_1300"
  | "R1_2200"
  | "R2_3500_5500"
  | "R3_6600_up";

/** One PLN residential tariff class. */
export interface PowerClass {
  /** Largest connected power in this class, in VA. Infinity for the open-ended top class. */
  maxVa: number;
  subsidised: boolean;
  tariffRpPerKwh: number;
  /** True when PLN bills a minimum monthly charge in this class (postpaid). */
  hasMinimumCharge: boolean;
}

/** Multipliers on horizontal irradiance for a tilted roof, by slope and direction relative to the equator. */
export interface OrientationTable {
  gentle: { towardEquator: number; eastWest: number; awayFromEquator: number };
  steep: { towardEquator: number; eastWest: number; awayFromEquator: number };
}

/** Every scalar assumption, by key. The keys match docs/ASSUMPTIONS.md. */
export type AssumptionKey =
  | "minCharge.hours"
  | "capex.perKwp.low"
  | "capex.perKwp.typical"
  | "capex.perKwp.high"
  | "battery.fixedCost"
  | "battery.costPerKwh"
  | "battery.replacementYear"
  | "battery.roundTripEfficiency"
  | "battery.usableFraction"
  | "battery.minFillShare"
  | "opex.yearlyShareOfCapex"
  | "inverter.replacementYear"
  | "inverter.replacementShareOfCapex"
  | "panel.wattPeak"
  | "panel.areaM2"
  | "system.minKwp"
  | "roof.usableFraction"
  | "pv.performanceRatio"
  | "pv.degradationPerYear"
  | "shade.none"
  | "shade.some"
  | "shade.heavy"
  | "load.daytimeShare.base"
  | "load.daytimeShare.homeOnWeekdays"
  | "load.daytimeShare.daytimeAc"
  | "load.daytimeShare.workFromHome"
  | "load.daytimeShare.electricVehicle"
  | "load.daytimeShare.floor"
  | "load.daytimeShare.cap"
  | "bill.overheadShare"
  | "finance.horizonYears"
  | "finance.tariffEscalationPerYear"
  | "grid.emissionKgCo2PerKwh";

export interface AssumptionSet {
  /** Changes whenever any value changes. Stored with every saved result (SPEC 4.2). */
  version: string;
  entries: Record<AssumptionKey, AssumptionEntry>;
  powerClasses: { note: SourceNote; classes: Record<TariffClass, PowerClass> };
  orientation: { note: SourceNote; table: OrientationTable };
  /** Battery sizes on offer, in kWh, smallest first. */
  batterySizesKwh: { note: SourceNote; sizes: number[] };
}

/** A user's changes to adjustable entries: key to new value. */
export type AssumptionOverrides = Partial<Record<AssumptionKey, number>>;

/** Tariff classes from the smallest connected power up. Lookups walk this list in order. */
export const TARIFF_CLASS_ORDER: TariffClass[] = [
  "R1_450_subsidised",
  "R1_900_subsidised",
  "R1_900_nonsubsidised",
  "R1_1300",
  "R1_2200",
  "R2_3500_5500",
  "R3_6600_up",
];
