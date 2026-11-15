import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "../assumptions";
import type { AssumptionKey, AssumptionSet } from "../assumptions";
import { batteryCostRp, paybackYearOf, projectMoney, solarCostRange } from "./projection";

/**
 * A copy of version 1 with some values changed. Fixed entries cannot go through applyOverrides,
 * so the test edits the entries directly.
 */
function withValues(changes: Partial<Record<AssumptionKey, number>>): AssumptionSet {
  const entries = { ...ASSUMPTIONS_V1.entries };
  for (const [key, value] of Object.entries(changes) as [AssumptionKey, number][]) {
    entries[key] = { ...entries[key], value };
  }
  return { ...ASSUMPTIONS_V1, entries };
}

// No panel fading, no tariff rise, no upkeep, no replacements: savings are the same every year.
const NO_RUNNING_COSTS = withValues({
  "pv.degradationPerYear": 0,
  "finance.tariffEscalationPerYear": 0,
  "opex.yearlyShareOfCapex": 0,
  "inverter.replacementShareOfCapex": 0,
});

describe("batteryCostRp", () => {
  // Fixed part Rp14,350,000 plus Rp3,600,000 per kWh; the totals in docs/ASSUMPTIONS.md.
  it("adds the hybrid inverter's fixed cost to a cost per kWh", () => {
    expect(batteryCostRp(5, ASSUMPTIONS_V1)).toBe(32_350_000); // 14.35m + 5 × 3.6m
    expect(batteryCostRp(10, ASSUMPTIONS_V1)).toBe(50_350_000); // 14.35m + 10 × 3.6m
  });
});

describe("solarCostRange", () => {
  it("multiplies the size by the low, typical and high cost per kWp", () => {
    const cost = solarCostRange(2.2, ASSUMPTIONS_V1);
    expect(cost.low).toBeCloseTo(24_200_000, 4); // 2.2 × 11m
    expect(cost.typical).toBeCloseTo(35_200_000, 4); // 2.2 × 16m
    expect(cost.high).toBeCloseTo(44_000_000, 4); // 2.2 × 20m
  });
});

describe("paybackYearOf", () => {
  it("is the first year the running total reaches the cost", () => {
    expect(paybackYearOf([0, 3, 6, 9, 12], 10)).toBe(4); // 9 < 10 in year 3; 12 ≥ 10 in year 4
    expect(paybackYearOf([0, 5, 10, 15], 10)).toBe(2); // reaching the cost exactly counts
  });

  it("is null when the total never reaches the cost", () => {
    expect(paybackYearOf([0, 3, 6, 9], 10)).toBeNull();
  });
});

describe("projectMoney", () => {
  it("with constant savings and no running costs, payback is cost ÷ yearly savings", () => {
    // Rp10,000,000 system saving Rp2,500,000 a year: 10m ÷ 2.5m = 4 years.
    const result = projectMoney({ firstYearSavingsRp: 2_500_000, solarCostRp: 10_000_000, batteryKwh: null }, NO_RUNNING_COSTS);
    expect(result.paybackYear).toBe(4);
    expect(result.upfrontCostRp).toBe(10_000_000);
    expect(result.cumulativeSavingsRp.slice(0, 5)).toEqual([0, 2_500_000, 5_000_000, 7_500_000, 10_000_000]);
    expect(result.cumulativeSavingsRp).toHaveLength(26); // year 0 to year 25
    expect(result.netSavingsRp).toBe(52_500_000); // 25 × 2.5m − 10m
  });

  it("rounds a part year up to the year the cost is reached", () => {
    // 10m ÷ 3m = 3.33: after 3 years 9m is back, after 4 years 12m.
    const result = projectMoney({ firstYearSavingsRp: 3_000_000, solarCostRp: 10_000_000, batteryKwh: null }, NO_RUNNING_COSTS);
    expect(result.paybackYear).toBe(4);
  });

  it("says it does not pay back when 25 years of savings fall short of the cost", () => {
    // 25 × 300,000 = 7.5m < 10m.
    const result = projectMoney({ firstYearSavingsRp: 300_000, solarCostRp: 10_000_000, batteryKwh: null }, NO_RUNNING_COSTS);
    expect(result.paybackYear).toBeNull();
    expect(result.netSavingsRp).toBe(-2_500_000); // 7.5m − 10m
  });

  // A four-year horizon with exaggerated rates, so every year can be worked on paper.
  // Output keeps 0.9 a year and the tariff grows 1.1 a year: savings shrink by 0.9 × 1.1 = 0.99 a year.
  // Upkeep 1% of Rp10m = 100,000 a year. Inverter: 15% of 10m = 1,500,000 in year 3. Battery cells again in year 4.
  const SHORT = withValues({
    "finance.horizonYears": 4,
    "pv.degradationPerYear": 0.1,
    "finance.tariffEscalationPerYear": 0.1,
    "inverter.replacementYear": 3,
    "battery.replacementYear": 4,
  });

  it("follows fading output, rising tariffs, upkeep and the inverter year by year", () => {
    const result = projectMoney({ firstYearSavingsRp: 1_000_000, solarCostRp: 10_000_000, batteryKwh: null }, SHORT);
    const expected = [
      0,
      900_000, // 1,000,000 − 100,000
      1_790_000, // + 990,000 − 100,000
      1_170_100, // + 980,100 − 100,000 − 1,500,000 inverter
      2_040_399, // + 970,299 − 100,000
    ];
    result.cumulativeSavingsRp.forEach((total, year) => expect(total).toBeCloseTo(expected[year], 4));
    expect(result.netSavingsRp).toBeCloseTo(-7_959_601, 4); // 2,040,399 − 10,000,000
    expect(result.paybackYear).toBeNull();
  });

  it("adds the battery to the upfront cost and buys its cells again in the replacement year", () => {
    // Upfront: 10m solar + 14.35m fixed + 5 × 3.6m = 42.35m. Year 4 also pays 5 × 3.6m = 18m for new cells.
    // Upkeep stays 1% of the solar cost, as in the case without a battery.
    const result = projectMoney({ firstYearSavingsRp: 1_000_000, solarCostRp: 10_000_000, batteryKwh: 5 }, SHORT);
    expect(result.upfrontCostRp).toBe(42_350_000);
    expect(result.cumulativeSavingsRp[3]).toBeCloseTo(1_170_100, 4); // same as without, up to year 3
    expect(result.cumulativeSavingsRp[4]).toBeCloseTo(-15_959_601, 4); // 1,170,100 + 970,299 − 100,000 − 18,000,000
    expect(result.netSavingsRp).toBeCloseTo(-58_309_601, 4); // −15,959,601 − 42,350,000
    expect(result.paybackYear).toBeNull();
  });

  it("with version 1's rates, the second year saves 0.5% less: panels fade, tariffs stay flat", () => {
    // Upkeep 1% of 10m = 100,000. Year 1: 2,000,000 − 100,000. Year 2: + 2,000,000 × 0.995 − 100,000.
    const result = projectMoney({ firstYearSavingsRp: 2_000_000, solarCostRp: 10_000_000, batteryKwh: null }, ASSUMPTIONS_V1);
    expect(result.cumulativeSavingsRp[1]).toBeCloseTo(1_900_000, 4);
    expect(result.cumulativeSavingsRp[2]).toBeCloseTo(3_790_000, 4); // 1,900,000 + 1,990,000 − 100,000
  });
});
