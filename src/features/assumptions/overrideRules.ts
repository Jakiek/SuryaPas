// What a user may type into an adjustable entry.
//
// The limits are the entry's own min and max from the assumption set
// (src/engine/assumptions), the same ones applyOverrides enforces on the
// server side of the calculation, so a value this screen accepts is a value
// the engine accepts. Only when an entry carries no limit do the fallbacks
// below apply, and they follow from what the value is, not from a guess:
// nothing here is negative, and a share cannot exceed 1.

import type { AssumptionEntry, AssumptionKey } from "../../engine/assumptions";
import { percentToFraction } from "./percent";
import { readNumber } from "./readNumber";

export interface Limits {
  min: number;
  /** Undefined when the value has no upper limit. */
  max: number | undefined;
}

/** A unit that is a fraction of a whole ("share", "share/year"). */
export function isShare(unit: string): boolean {
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

/** Decides what the typed text is (percent for a share; the value returned is the stored fraction): nothing, not a number, a number outside the limits, or a good value. */
export function checkOverride(typed: string, entry: AssumptionEntry, locale: string): OverrideCheck {
  if (typed.trim() === "") return { kind: "empty" };

  const typedNumber = readNumber(typed, locale);
  if (typedNumber === null) return { kind: "notANumber" };
  // A share is typed as percent and stored as a fraction.
  const value = isShare(entry.unit) ? percentToFraction(typedNumber) : typedNumber;

  const limits = limitsOf(entry);
  const tooLow = value < limits.min;
  const tooHigh = limits.max !== undefined && value > limits.max;
  if (tooLow || tooHigh) return { kind: "outOfRange", limits };

  return { kind: "ok", value };
}

// The three installed-cost estimates are a range, so they stay in order:
// low <= typical <= high. This follows from what they are; no number is involved.
const COST_ORDER: AssumptionKey[] = ["capex.perKwp.low", "capex.perKwp.typical", "capex.perKwp.high"];

export interface OrderConflict {
  /** The neighbouring entry the new value collides with. */
  neighbour: AssumptionKey;
  neighbourValue: number;
  /** "atLeast": the new value is too low for its neighbour below; "atMost": too high for the one above. */
  relation: "atLeast" | "atMost";
}

/** Null when the value keeps the cost estimates in order; otherwise the neighbour it breaks. */
export function costOrderConflict(
  key: AssumptionKey,
  value: number,
  currentValueOf: (key: AssumptionKey) => number,
): OrderConflict | null {
  const position = COST_ORDER.indexOf(key);
  if (position === -1) return null;

  const below = COST_ORDER[position - 1];
  if (below !== undefined && value < currentValueOf(below)) {
    return { neighbour: below, neighbourValue: currentValueOf(below), relation: "atLeast" };
  }
  const above = COST_ORDER[position + 1];
  if (above !== undefined && value > currentValueOf(above)) {
    return { neighbour: above, neighbourValue: currentValueOf(above), relation: "atMost" };
  }
  return null;
}
