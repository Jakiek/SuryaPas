import { describe, expect, it } from "vitest";
import { addMonth, emptyDraft, MAX_MONTHS, removeLastMonth, setMonth } from "./draft";

describe("month list", () => {
  it("starts with one field", () => {
    expect(emptyDraft().electricity.monthlySpendRp).toHaveLength(1);
  });

  it("adds months one at a time up to twelve, then stops", () => {
    let months: (number | null)[] = [null];
    for (let i = 0; i < 20; i++) months = addMonth(months);
    expect(months).toHaveLength(MAX_MONTHS);
    expect(MAX_MONTHS).toBe(12);
  });

  it("removes the last month but never the only one", () => {
    expect(removeLastMonth([1, 2, 3])).toEqual([1, 2]);
    expect(removeLastMonth([1])).toEqual([1]);
  });

  it("sets one month without touching the others", () => {
    expect(setMonth([1, 2, 3], 1, 9)).toEqual([1, 9, 3]);
  });
});
