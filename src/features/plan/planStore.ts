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

import { emptyDraft, type PlanDraft } from "./draft";

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
  return {
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
