import type { AssumptionKey, AssumptionOverrides, AssumptionSet } from "./types";

export * from "./types";
export { ASSUMPTIONS_V1 } from "./v1";

/** Reads one scalar assumption. */
export function valueOf(assumptions: AssumptionSet, key: AssumptionKey): number {
  return assumptions.entries[key].value;
}

/**
 * Returns a copy of the set with the user's changes applied.
 * Throws when a change names an entry that is not adjustable or lies outside its allowed range,
 * so a bad value is rejected here and never reaches a calculation.
 */
export function applyOverrides(assumptions: AssumptionSet, overrides: AssumptionOverrides): AssumptionSet {
  const entries = { ...assumptions.entries };

  for (const key of Object.keys(overrides) as AssumptionKey[]) {
    const newValue = overrides[key];
    if (newValue === undefined) continue;

    const entry = assumptions.entries[key];
    if (entry === undefined) {
      throw new Error(`Unknown assumption "${key}".`);
    }
    if (!entry.adjustable) {
      throw new Error(`Assumption "${key}" cannot be changed.`);
    }
    if (!Number.isFinite(newValue)) {
      throw new Error(`Assumption "${key}" must be a number.`);
    }
    if (entry.min !== undefined && newValue < entry.min) {
      throw new Error(`Assumption "${key}" must be at least ${entry.min}.`);
    }
    if (entry.max !== undefined && newValue > entry.max) {
      throw new Error(`Assumption "${key}" must be at most ${entry.max}.`);
    }
    entries[key] = { ...entry, value: newValue };
  }

  return { ...assumptions, entries };
}
