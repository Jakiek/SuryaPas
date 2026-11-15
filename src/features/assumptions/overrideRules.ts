// What a user may type into an adjustable entry.
//
// The limits are the entry's own min and max from the assumption set
// (src/engine/assumptions), the same ones applyOverrides enforces on the
// server side of the calculation, so a value this screen accepts is a value
// the engine accepts. Only when an entry carries no limit do the fallbacks
// below apply, and they follow from what the value is, not from a guess:
// nothing here is negative, and a share cannot exceed 1.

import type { AssumptionEntry } from "../../engine/assumptions";
import { readNumber } from "./readNumber";

export interface Limits {
  min: number;
  /** Undefined when the value has no upper limit. */
  max: number | undefined;
}

/** A unit that is a fraction of a whole ("share", "share/year"). */
function isShare(unit: string): boolean {
  return unit === "share" || unit === "share/year";
}

export function limitsOf(entry: AssumptionEntry): Limits {
  return {
    min: entry.min ?? 0,
    max: entry.max ?? (isShare(entry.unit) ? 1 : undefined),
  };
}

export type OverrideCheck =
  | { kind: "empty" }
  | { kind: "notANumber" }
  | { kind: "outOfRange"; limits: Limits }
  | { kind: "ok"; value: number };

/** Decides what the typed text is: nothing, not a number, a number outside the limits, or a good value. */
export function checkOverride(typed: string, entry: AssumptionEntry, locale: string): OverrideCheck {
  if (typed.trim() === "") return { kind: "empty" };

  const value = readNumber(typed, locale);
  if (value === null) return { kind: "notANumber" };

  const limits = limitsOf(entry);
  const tooLow = value < limits.min;
  const tooHigh = limits.max !== undefined && value > limits.max;
  if (tooLow || tooHigh) return { kind: "outOfRange", limits };

  return { kind: "ok", value };
}
