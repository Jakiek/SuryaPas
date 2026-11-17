import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "../assumptions";
import type { AssumptionKey, AssumptionSet } from "../assumptions";
import type { ElectricityInput, EnergyResult } from "../types";
import { assessMoney } from "./index";

/** A copy of version 1 with some fixed values changed (applyOverrides only takes adjustable ones). */
function withValues(changes: Partial<Record<AssumptionKey, number>>): AssumptionSet {
  const entries = { ...ASSUMPTIONS_V1.entries };
  for (const [key, value] of Object.entries(changes) as [AssumptionKey, number][]) {
    entries[key] = { ...entries[key], value };
  }
  return { ...ASSUMPTIONS_V1, entries };
}

const NO_RUNNING_COSTS = withValues({
  "pv.degradationPerYear": 0,
  "opex.yearlyShareOfCapex": 0,
  "inverter.replacementShareOfCapex": 0,
});

const everyMonth = (value: number) => Array<number>(12).fill(value);

/** A year of energy flows with the same import every month. Only the fields money reads matter. */
function energyOf(generationKwh: number, selfConsumedKwh: number, monthlyImportKwh: number): EnergyResult {
  return {
    generationKwh,
    selfConsumedKwh,
    exportedKwh: generationKwh - selfConsumedKwh,
    gridImportKwh: monthlyImportKwh * 12,
    batteryLossKwh: 0,
    batteryEndKwh: 0,
    monthly: {
      generationKwh: everyMonth(generationKwh / 12),
      selfConsumedKwh: everyMonth(selfConsumedKwh / 12),
      exportedKwh: everyMonth((generationKwh - selfConsumedKwh) / 12),
      gridImportKwh: everyMonth(monthlyImportKwh),
    },
  };
}

const POSTPAID_2200: ElectricityInput = { billing: "postpaid", connectedVa: 2200, subsidised: false, monthlySpendRp: [0] };

describe("assessMoney", () => {
  // A 2.2 kWp system makes 1,500 kWh and the home uses 1,200 of it: 100 kWh a month off a 400 kWh bill.
  // Monthly savings: 100 × 1,444.70 ÷ 0.95 = 152,073.68. Yearly: 1,733,640 ÷ 0.95 = 1,824,884.21.
  const energy = energyOf(1500, 1200, 300);

  it("turns a year of energy into savings, cost, payback range and net savings", () => {
    const money = assessMoney(energy, 2.2, null, everyMonth(400), POSTPAID_2200, NO_RUNNING_COSTS);
    expect(money.firstYearSavingsRp).toBeCloseTo(1_824_884.2105, 3);
    expect(money.monthlySavingsRp).toBeCloseTo(152_073.6842, 3);
    expect(money.upfrontCostRp.low).toBeCloseTo(24_200_000, 4); // 2.2 × 11m
    expect(money.upfrontCostRp.typical).toBeCloseTo(35_200_000, 4); // 2.2 × 16m
    expect(money.upfrontCostRp.high).toBeCloseTo(44_000_000, 4); // 2.2 × 20m
    // Constant savings, so payback is cost ÷ yearly savings, rounded up to a whole year.
    expect(money.paybackYears.low).toBe(14); // 24.2m ÷ 1.8249m = 13.3
    expect(money.paybackYears.typical).toBe(20); // 35.2m ÷ 1.8249m = 19.3
    expect(money.paybackYears.high).toBe(25); // 44m ÷ 1.8249m = 24.1, the last year of the horizon
    // Net savings at the typical cost: 25 × 1,824,884.21 − 35,200,000
    expect(money.netSavingsRp).toBeCloseTo(10_422_105.2632, 2);
    expect(money.cumulativeSavingsRp[25]).toBeCloseTo(45_622_105.2632, 2);
  });

  it("reports the share of solar used at home and the CO₂ it avoids", () => {
    const money = assessMoney(energy, 2.2, null, everyMonth(400), POSTPAID_2200, ASSUMPTIONS_V1);
    expect(money.selfConsumedShare).toBeCloseTo(0.8, 10); // 1,200 ÷ 1,500
    expect(money.co2AvoidedKgPerYear).toBeCloseTo(1044, 10); // 1,200 kWh × 0.87; exports not counted
  });

  it("includes the battery in the cost when there is one", () => {
    // 5 kWh adds 14.35m + 5 × 3.6m = 32.35m at every cost level.
    const money = assessMoney(energy, 2.2, 5, everyMonth(400), POSTPAID_2200, NO_RUNNING_COSTS);
    expect(money.upfrontCostRp.low).toBeCloseTo(56_550_000, 4); // 24.2m + 32.35m
    expect(money.upfrontCostRp.typical).toBeCloseTo(67_550_000, 4); // 35.2m + 32.35m
    expect(money.upfrontCostRp.high).toBeCloseTo(76_350_000, 4); // 44m + 32.35m
    // 25 × 1.8249m = 45.6m never reaches even the low cost.
    expect(money.paybackYears).toEqual({ low: null, typical: null, high: null });
  });

  it("returns the running total at the low, typical and high cost, each with its own upkeep and inverter", () => {
    // Version 1's running costs, with panel fading and the tax share set to zero so every year is the same.
    //   Savings: 100 kWh × 1,444.70 × 12 = 1,733,640 a year (no tax share to add back).
    //   A 1 kWp system costs 11m, 16m or 20m. Upkeep is 1% of that: 110,000, 160,000 or 200,000 a year.
    //   The inverter is 15% of it, once, in year 12: 1,650,000, 2,400,000 or 3,000,000.
    //   Each year adds 1,733,640 less upkeep: low 1,623,640, typical 1,573,640, high 1,533,640.
    //
    //   year   low                            typical                        high
    //    1     1,623,640                      1,573,640                      1,533,640
    //   11     11 × 1,623,640 = 17,860,040    11 × 1,573,640 = 17,310,040    11 × 1,533,640 = 16,870,040
    //   12     19,483,680 − 1,650,000         18,883,680 − 2,400,000         18,403,680 − 3,000,000
    //          = 17,833,680                   = 16,483,680                   = 15,403,680
    //   13     19,457,320                     18,057,320                     16,937,320
    //   25     40,591,000 − 1,650,000         39,341,000 − 2,400,000         38,341,000 − 3,000,000
    //          = 38,941,000                   = 36,941,000                   = 35,341,000
    const flat = withValues({ "pv.degradationPerYear": 0, "bill.overheadShare": 0 });
    const money = assessMoney(energy, 1, null, everyMonth(400), POSTPAID_2200, flat);
    const { low, typical, high } = money.cumulativeSavingsByCostRp;

    expect(money.firstYearSavingsRp).toBeCloseTo(1_733_640, 4);
    const expected = {
      low: { 0: 0, 1: 1_623_640, 11: 17_860_040, 12: 17_833_680, 13: 19_457_320, 25: 38_941_000 },
      typical: { 0: 0, 1: 1_573_640, 11: 17_310_040, 12: 16_483_680, 13: 18_057_320, 25: 36_941_000 },
      high: { 0: 0, 1: 1_533_640, 11: 16_870_040, 12: 15_403_680, 13: 16_937_320, 25: 35_341_000 },
    };
    for (const [year, total] of Object.entries(expected.low)) expect(low[Number(year)]).toBeCloseTo(total, 4);
    for (const [year, total] of Object.entries(expected.typical)) expect(typical[Number(year)]).toBeCloseTo(total, 4);
    for (const [year, total] of Object.entries(expected.high)) expect(high[Number(year)]).toBeCloseTo(total, 4);
    [low, typical, high].forEach((series) => expect(series).toHaveLength(26)); // year 0 to year 25

    // The typical series is the one the result already carried, and net savings still come from it.
    expect(typical).toEqual(money.cumulativeSavingsRp);
    expect(money.netSavingsRp).toBeCloseTo(20_941_000, 4); // 36,941,000 − 16,000,000

    // Each payback reads off its own series:
    //   low 11m:     year 6 = 9,741,840 short; year 7 = 11,365,480, above for good           → 7
    //   typical 16m: year 10 = 15,736,400 short; year 11 = 17,310,040; year 12 stays above → 11
    //   high 20m:    year 14 = 21,470,960 − 3,000,000 = 18,470,960 short;
    //                year 15 = 23,004,600 − 3,000,000 = 20,004,600, above for good          → 15
    expect(money.paybackYears).toEqual({ low: 7, typical: 11, high: 15 });

    // A band: the low-cost line is never under the typical one, nor the typical under the high one.
    for (let year = 0; year <= 25; year++) {
      expect(low[year]).toBeGreaterThanOrEqual(typical[year]);
      expect(typical[year]).toBeGreaterThanOrEqual(high[year]);
    }
  });

  it("never pays back when solar raises the bill", () => {
    // 1,300 VA prepaid spending Rp50,000: after solar the minimum of 75,124.40 applies.
    // Savings: 50,000 − 75,124.40 ÷ 0.95 = −29,078.32 a month, −348,939.79 a year.
    const prepaid: ElectricityInput = { billing: "prepaid", connectedVa: 1300, subsidised: false, monthlySpendRp: [50_000] };
    const loadKwh = (50_000 * 0.95) / 1444.7;
    const money = assessMoney(energyOf(1500, 300, loadKwh - 25), 1.1, null, everyMonth(loadKwh), prepaid, NO_RUNNING_COSTS);
    expect(money.firstYearSavingsRp).toBeCloseTo(-348_939.7895, 3);
    expect(money.paybackYears).toEqual({ low: null, typical: null, high: null });
    // 25 × −348,939.79 − 1.1 × 16m
    expect(money.netSavingsRp).toBeCloseTo(-26_323_494.7368, 2);
  });
});
