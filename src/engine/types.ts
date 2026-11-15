// Shapes of everything that goes into and comes out of the engine.
// SPEC 3.1 (inputs) and 3.3 (outputs).

/** A roof face's compass direction. "none" is for a flat roof. */
export type Facing = "N" | "E" | "S" | "W" | "none";
export type Slope = "flat" | "gentle" | "steep";
export type Shade = "none" | "some" | "heavy";
export type Billing = "prepaid" | "postpaid";

export interface LocationInput {
  latitude: number;
  longitude: number;
}

export interface RoofInput {
  /** Traced or typed area of the roof face, in square metres. */
  areaM2: number;
  /** Share of that area that can hold panels, 0 to 1. */
  usableFraction: number;
  facing: Facing;
  slope: Slope;
  shade: Shade;
}

export interface ElectricityInput {
  billing: Billing;
  /** PLN connected power in VA, for example 2200. */
  connectedVa: number;
  /** True for the subsidised 450 VA and 900 VA classes. */
  subsidised: boolean;
  /**
   * Monthly spend in rupiah. One to twelve values.
   * Exactly twelve are read as January to December.
   * Fewer than twelve are averaged and applied to every month.
   */
  monthlySpendRp: number[];
}

export interface LifestyleInput {
  homeOnWeekdays: boolean;
  daytimeAc: boolean;
  workFromHome: boolean;
  electricVehicle: boolean;
}

export interface EngineInputs {
  location: LocationInput;
  roof: RoofInput;
  electricity: ElectricityInput;
  lifestyle: LifestyleInput;
}

/** One year of sun data, supplied by the caller (SPEC 3.4). */
export interface SunSeries {
  /** 8,760 hourly values of global horizontal irradiance, W/m², local solar time, starting 1 January 00:00. */
  ghiWm2: number[];
  source: "live" | "fallback";
}

/** Twelve values, January to December. */
export type Monthly = number[];

/** A year of energy flows for one system size, all in kWh. */
export interface EnergyResult {
  /** Everything the panels produced. */
  generationKwh: number;
  /** Solar used in the home: directly, plus what came back out of a battery. */
  selfConsumedKwh: number;
  /** Solar sent to the grid. It earns nothing. */
  exportedKwh: number;
  /** What the home still bought from PLN. */
  gridImportKwh: number;
  /** Energy lost charging and discharging a battery. Zero without one. */
  batteryLossKwh: number;
  /** Energy left in the battery at the end of the year. Zero without one. */
  batteryEndKwh: number;
  monthly: {
    generationKwh: Monthly;
    selfConsumedKwh: Monthly;
    exportedKwh: Monthly;
    gridImportKwh: Monthly;
  };
}

/** One system size the roof can hold, with its energy picture. */
export interface EnergyCandidate {
  panels: number;
  kwp: number;
  /** Roof area the panels cover, in square metres. */
  panelAreaM2: number;
  withoutBattery: EnergyResult;
  /** Null when the engine offers no battery for this size (too little surplus to fill one). */
  withBattery: { batteryKwh: number; energy: EnergyResult } | null;
}

/** The energy half of the engine's output (SPEC 3.2 steps 1 to 6). */
export interface EnergyAssessment {
  /** Home use for each month, in kWh. */
  monthlyLoadKwh: Monthly;
  /** Share of a day's energy used between 06:00 and 18:00. */
  daytimeShare: { weekday: number; weekend: number };
  /** Average home use in each hour of the day, in kWh (equal to average kW). 24 values. */
  averageLoadByHourKwh: number[];
  /** Average solar output of one kWp in each hour of the day, in kWh. 24 values. Multiply by a candidate's kWp. */
  averageSolarByHourPerKwp: number[];
  /** Yearly output of one kWp on this roof, in kWh. */
  yearlyYieldPerKwp: number;
  /** Empty when the roof is too small. */
  candidates: EnergyCandidate[];
  /** Set when the roof cannot hold the smallest system. */
  roofTooSmall: { requiredAreaM2: number } | null;
  flags: {
    fallbackSunData: boolean;
    heavyShade: boolean;
  };
}
