// The state object the flow shell owns (SPEC 5.2): the engine's inputs,
// plus the step the user is on and the assumption overrides.
//
// It is a DRAFT because a half-filled form has holes: an empty field is
// null, and a yes/no question nobody has answered is null. The schemas in
// src/lib/schema/ decide when the holes are filled well enough to send.

import { ASSUMPTIONS_V1, valueOf } from "../../engine";
import type {
  AssumptionOverrides,
  Billing,
  Facing,
  Shade,
  Slope,
} from "../../engine";

export const STEP_COUNT = 4;
export type StepNumber = 1 | 2 | 3 | 4;

export interface LocationDraft {
  latitude: number | null;
  longitude: number | null;
}

export interface RoofDraft {
  areaM2: number | null;
  usableFraction: number;
  facing: Facing | null;
  slope: Slope | null;
  shade: Shade | null;
}

export interface ElectricityDraft {
  billing: Billing;
  connectedVa: number | null;
  subsidised: boolean;
  /** One entry per month field on screen; null is an empty field. */
  monthlySpendRp: (number | null)[];
}

export interface LifestyleDraft {
  homeOnWeekdays: boolean | null;
  daytimeAc: boolean | null;
  workFromHome: boolean | null;
  electricVehicle: boolean | null;
}

export interface PlanDraft {
  step: StepNumber;
  location: LocationDraft;
  roof: RoofDraft;
  electricity: ElectricityDraft;
  lifestyle: LifestyleDraft;
  overrides: AssumptionOverrides;
}

/** SPEC 2.2 step 3: up to twelve months of spend. */
export const MAX_MONTHS = 12;

export function emptyDraft(): PlanDraft {
  return {
    step: 1,
    location: { latitude: null, longitude: null },
    roof: {
      areaM2: null,
      // SPEC 2.2: the usable fraction is "defaulted from the assumption set".
      usableFraction: valueOf(ASSUMPTIONS_V1, "roof.usableFraction"),
      facing: null,
      slope: null,
      shade: null,
    },
    electricity: {
      billing: "postpaid",
      connectedVa: null,
      subsidised: false,
      monthlySpendRp: [null],
    },
    lifestyle: {
      homeOnWeekdays: null,
      daytimeAc: null,
      workFromHome: null,
      electricVehicle: null,
    },
    overrides: {},
  };
}

// ---------- Month list helpers (step 3) ----------

/** Adds one empty month, up to twelve. */
export function addMonth(months: (number | null)[]): (number | null)[] {
  return months.length >= MAX_MONTHS ? months : [...months, null];
}

/** Removes the last month, keeping at least one. */
export function removeLastMonth(months: (number | null)[]): (number | null)[] {
  return months.length <= 1 ? months : months.slice(0, -1);
}

/** Replaces the amount in one month field. */
export function setMonth(
  months: (number | null)[],
  index: number,
  amount: number | null,
): (number | null)[] {
  return months.map((current, i) => (i === index ? amount : current));
}
