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
  /**
   * 8,760 hourly values of global horizontal irradiance, W/m², starting 1 January 00:00.
   * Hours are in NASA POWER's local time: the time zone of the nearest 15° of longitude,
   * which is clock time across almost all of Indonesia. Each value is the average over the hour that starts then.
   */
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

/** What a household pays PLN in each month, in rupiah, tax included. */
export interface BillComparison {
  beforeRp: Monthly;
  afterRp: Monthly;
  /** before − after. Negative when solar would raise the bill (see SPEC 3.2 step 7). */
  savingsRp: Monthly;
}

/** A low, typical and high figure, from the low, typical and high installed cost. */
export interface CostRange {
  low: number;
  typical: number;
  high: number;
}

/** The money picture of one system over the analysis horizon. */
export interface MoneyResult {
  upfrontCostRp: CostRange;
  /** Savings in the first year, in rupiah. */
  firstYearSavingsRp: number;
  /** First-year savings ÷ 12. */
  monthlySavingsRp: number;
  /**
   * The year in which savings have repaid the upfront cost, at the low, typical and high cost.
   * Null means it does not pay back within the horizon.
   */
  paybackYears: { low: number | null; typical: number | null; high: number | null };
  /** Savings minus every cost over the horizon, at the typical cost. */
  netSavingsRp: number;
  /**
   * Running total of savings less running costs, at the typical cost, year 0 to the horizon.
   * Payback is where this line crosses the upfront cost.
   */
  cumulativeSavingsRp: number[];
  /**
   * The same running total at the low, typical and high installed cost (SPEC 3.3), year 0 to the horizon.
   * They differ because upkeep and the inverter replacement are shares of the cost.
   * `typical` is the same series as `cumulativeSavingsRp`. While the cost per kWp is ordered
   * low ≤ typical ≤ high, every year has low ≥ typical ≥ high here, so the payback chart draws them
   * as a band: low is its upper edge, high its lower edge (SPEC 2.3 item 5).
   */
  cumulativeSavingsByCostRp: { low: number[]; typical: number[]; high: number[] };
  /** Share of the panels' output used in the home, 0 to 1. */
  selfConsumedShare: number;
  co2AvoidedKgPerYear: number;
}

export interface SystemOption {
  energy: EnergyResult;
  money: MoneyResult;
}

/** One system size with its full assessment. */
export interface Candidate {
  panels: number;
  kwp: number;
  panelAreaM2: number;
  withoutBattery: SystemOption;
  /** Null when the engine offers no battery for this size. */
  withBattery: (SystemOption & { batteryKwh: number }) | null;
}

/** Everything the engine returns (SPEC 3.3). */
export interface Assessment {
  engineVersion: string;
  assumptionSetVersion: string;
  monthlyLoadKwh: Monthly;
  daytimeShare: { weekday: number; weekend: number };
  averageLoadByHourKwh: number[];
  averageSolarByHourPerKwp: number[];
  yearlyYieldPerKwp: number;
  /** PLN's minimum monthly charge for this home after solar, tax excluded. Zero in classes without one. */
  minimumChargeRp: number;
  candidates: Candidate[];
  /** Panel count of the recommended candidate. Null when the roof is too small. */
  recommendedPanels: number | null;
  roofTooSmall: { requiredAreaM2: number } | null;
  flags: {
    fallbackSunData: boolean;
    heavyShade: boolean;
    /** True when even the recommended system does not repay its typical cost within the horizon. */
    doesNotPayBack: boolean;
  };
}
