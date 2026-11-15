// Where the draft lives: in memory, mirrored to the browser's storage on
// every change and read back on load (SPEC 2.2: "Inputs persist in the
// browser").
//
// It is a tiny store that React reads with useSyncExternalStore. That
// hook gives the server render and the first client render the same empty
// draft, then switches to the restored one, so a refresh never causes a
// hydration mismatch.
//
// Storage can throw (private mode, blocked cookies, a full disk) or hold
// text another version wrote. Every access is wrapped: on failure the flow
// keeps working from memory and simply does not survive a refresh.

import type { z } from "zod";
import { isOfferedPower } from "../../lib/schema/powerChoices";
import {
  electricitySchema,
  lifestyleSchema,
  locationSchema,
  roofSchema,
} from "../../lib/schema/inputs";
import { emptyDraft, MAX_MONTHS, type PlanDraft } from "./draft";

export const STORAGE_KEY = "suryapas.plan.v1";

/** The two methods of the browser's Storage that the store uses. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PlanStore {
  getSnapshot(): PlanDraft;
  getServerSnapshot(): PlanDraft;
  subscribe(listener: () => void): () => void;
  /** Replaces the draft, tells subscribers and saves it. */
  set(next: PlanDraft): void;
}

/** Reads a saved draft, or null if there is none or it cannot be trusted. */
export function readSavedDraft(storage: StorageLike | null): PlanDraft | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (text === null) return null;
    return mergeWithDefaults(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * Keeps what a saved object has and fills in anything missing from the
 * empty draft, so a draft saved by an older version of the form still
 * loads. Anything that is not an object is rejected.
 */
function mergeWithDefaults(saved: unknown): PlanDraft | null {
  if (typeof saved !== "object" || saved === null) return null;
  const base = emptyDraft();
  const s = saved as Partial<PlanDraft>;
  const months = s.electricity?.monthlySpendRp;
  return dropUnusableValues({
    step: s.step && s.step >= 1 && s.step <= 4 ? s.step : base.step,
    location: { ...base.location, ...s.location },
    roof: { ...base.roof, ...s.roof },
    electricity: {
      ...base.electricity,
      ...s.electricity,
      monthlySpendRp:
        Array.isArray(months) && months.length > 0 ? months : base.electricity.monthlySpendRp,
    },
    lifestyle: { ...base.lifestyle, ...s.lifestyle },
    overrides: { ...base.overrides, ...s.overrides },
  });
}

/**
 * Saved text can hold values the form could never have produced (an old
 * version, a hand edit). Each field is checked against its own schema and
 * put back to its default when it fails, so the screen never shows a
 * state it cannot represent. An EMPTY field (null) is kept: that is just
 * a half-finished form, and the user wants it back as they left it.
 */
function dropUnusableValues(draft: PlanDraft): PlanDraft {
  const base = emptyDraft();
  const keep = <T>(schema: z.ZodType, value: T, fallback: T): T =>
    value === null || schema.safeParse(value).success ? value : fallback;

  const { location, roof, electricity, lifestyle } = draft;
  const lifestyleShape = lifestyleSchema.shape;

  // A pair the select does not offer (2,200 VA marked subsidised) would
  // leave the select showing nothing while the form believed it was set.
  const pairIsOffered =
    electricity.connectedVa === null ||
    isOfferedPower(electricity.connectedVa, electricity.subsidised);

  return {
    ...draft,
    location: {
      latitude: keep(locationSchema.shape.latitude, location.latitude, null),
      longitude: keep(locationSchema.shape.longitude, location.longitude, null),
    },
    roof: {
      areaM2: keep(roofSchema.shape.areaM2, roof.areaM2, null),
      usableFraction: keep(roofSchema.shape.usableFraction, roof.usableFraction, base.roof.usableFraction),
      facing: keep(roofSchema.shape.facing, roof.facing, null),
      slope: keep(roofSchema.shape.slope, roof.slope, null),
      shade: keep(roofSchema.shape.shade, roof.shade, null),
    },
    electricity: {
      billing: keep(electricitySchema.shape.billing, electricity.billing, base.electricity.billing),
      connectedVa: pairIsOffered ? electricity.connectedVa : null,
      subsidised: pairIsOffered ? electricity.subsidised === true : false,
      monthlySpendRp: electricity.monthlySpendRp
        .slice(0, MAX_MONTHS)
        .map((amount) => (amount === null || Number.isSafeInteger(amount) ? amount : null)),
    },
    lifestyle: {
      homeOnWeekdays: keep(lifestyleShape.homeOnWeekdays, lifestyle.homeOnWeekdays, null),
      daytimeAc: keep(lifestyleShape.daytimeAc, lifestyle.daytimeAc, null),
      workFromHome: keep(lifestyleShape.workFromHome, lifestyle.workFromHome, null),
      electricVehicle: keep(lifestyleShape.electricVehicle, lifestyle.electricVehicle, null),
    },
  };
}

/** Saves the draft; returns false if the storage refused. */
function saveDraft(storage: StorageLike | null, draft: PlanDraft): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function createPlanStore(getStorage: () => StorageLike | null): PlanStore {
  const serverDraft = emptyDraft();
  // Undefined until the first read in the browser.
  let current: PlanDraft | undefined;
  const listeners = new Set<() => void>();

  return {
    getServerSnapshot: () => serverDraft,
    getSnapshot() {
      // useSyncExternalStore needs the same object back until something changes.
      current ??= readSavedDraft(getStorage()) ?? serverDraft;
      return current;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(next) {
      current = next;
      saveDraft(getStorage(), next);
      listeners.forEach((listener) => listener());
    },
  };
}

/** The browser's localStorage, or null when it is missing or blocked. */
function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The store the flow uses. */
export const planStore = createPlanStore(browserStorage);
