// A result the server computed but could not save (SPEC 2.5, "Saving fails").
//
// The browser keeps it in sessionStorage, under its own key, so it lasts as
// long as the tab and no longer. Only this key is ever written or removed;
// the plan draft and everything else in storage are left alone.
//
// What is kept: the request (so the save can be retried) and the engine's
// output. Everything the page shows is rebuilt from those two.

import type { Assessment, EngineInputs } from "../../engine";
import { assessmentRequestSchema, type AssessmentRequest } from "../../lib/schema";
import type { HomeSummary } from "./view";

export const UNSAVED_KEY = "suryapas.result.unsaved.v1";

/** The id the result page's address uses for a result that has no saved id. */
export const UNSAVED_ID = "unsaved";

export interface UnsavedResult {
  request: AssessmentRequest;
  assessment: Assessment;
}

/** The two methods of the browser's Storage that this file uses. */
export interface SessionStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Session storage, or null where it is blocked. */
export function browserSessionStorage(): SessionStorageLike | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Remembers the result. Returns false when storage refuses (blocked or full). */
export function rememberUnsaved(storage: SessionStorageLike | null, value: UnsavedResult): boolean {
  if (!storage) return false;
  try {
    storage.setItem(UNSAVED_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** The remembered result, or null if there is none or it cannot be trusted. */
export function readUnsaved(storage: SessionStorageLike | null): UnsavedResult | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(UNSAVED_KEY);
    if (text === null) return null;
    const parsed = JSON.parse(text) as { request?: unknown; assessment?: unknown };
    const request = assessmentRequestSchema.safeParse(parsed.request);
    const assessment = parsed.assessment as Assessment | null | undefined;
    const looksLikeAssessment =
      typeof assessment === "object" &&
      assessment !== null &&
      typeof assessment.assumptionSetVersion === "string" &&
      Array.isArray(assessment.candidates);
    if (!request.success || !looksLikeAssessment) return null;
    return { request: request.data, assessment };
  } catch {
    return null;
  }
}

/** Forgets the result, once it has been saved. Touches only this key. */
export function forgetUnsaved(storage: SessionStorageLike | null): void {
  try {
    storage?.removeItem(UNSAVED_KEY);
  } catch {
    // Nothing to do: the entry simply stays until the tab closes.
  }
}

/**
 * What the page says about the home, as loadResult.ts builds it for a saved
 * result (that file is server-only, so the browser keeps its own copy of
 * this small function). No location: the page never shows the pin.
 */
export function homeSummaryOf(inputs: EngineInputs): HomeSummary {
  return {
    billing: inputs.electricity.billing,
    connectedVa: inputs.electricity.connectedVa,
    subsidised: inputs.electricity.subsidised,
    monthlySpendRp: inputs.electricity.monthlySpendRp,
    roofAreaM2: inputs.roof.areaM2,
  };
}
