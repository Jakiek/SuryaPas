import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1 } from "../assumptions";
import type { ElectricityInput } from "../types";
import { compareBills, minimumChargeRp } from "./bills";

// Twelve equal months, so each test reads one month and the rest follow.
const everyMonth = (value: number) => Array<number>(12).fill(value);

const home = (billing: ElectricityInput["billing"], connectedVa: number, subsidised = false): ElectricityInput => ({
  billing,
  connectedVa,
  subsidised,
  monthlySpendRp: [0], // not read by the functions under test
});

describe("minimumChargeRp", () => {
  // 40 hours × connected kVA × tariff (Regulation 7/2024, Annex II); worked values in docs/ASSUMPTIONS.md.
  it("is 40 hours at full connected power", () => {
    expect(minimumChargeRp(home("postpaid", 900), ASSUMPTIONS_V1)).toBeCloseTo(48_672, 6); // 40 × 0.9 × 1,352
    expect(minimumChargeRp(home("postpaid", 1300), ASSUMPTIONS_V1)).toBeCloseTo(75_124.4, 6); // 40 × 1.3 × 1,444.70
    expect(minimumChargeRp(home("postpaid", 2200), ASSUMPTIONS_V1)).toBeCloseTo(127_133.6, 6); // 40 × 2.2 × 1,444.70
    expect(minimumChargeRp(home("postpaid", 3500), ASSUMPTIONS_V1)).toBeCloseTo(237_934.2, 6); // 40 × 3.5 × 1,699.53
  });

  it("uses the connected power itself, not the class: 4,400 VA and 3,500 VA share a class but not a minimum", () => {
    expect(minimumChargeRp(home("postpaid", 4400), ASSUMPTIONS_V1)).toBeCloseTo(299_117.28, 6); // 40 × 4.4 × 1,699.53
  });

  it("is zero in the subsidised classes, which have none", () => {
    expect(minimumChargeRp(home("postpaid", 450, true), ASSUMPTIONS_V1)).toBe(0);
    expect(minimumChargeRp(home("postpaid", 900, true), ASSUMPTIONS_V1)).toBe(0);
  });
});

describe("compareBills", () => {
  it("before solar equals what the household pays today, tax included", () => {
    // Step 1 turned Rp650,000 into 650,000 × 0.95 ÷ 1,444.70 kWh; adding the 5% back gives Rp650,000 again.
    const loadKwh = (650_000 * 0.95) / 1444.7;
    const bills = compareBills(everyMonth(loadKwh), everyMonth(loadKwh), home("postpaid", 2200), ASSUMPTIONS_V1);
    expect(bills.beforeRp[0]).toBeCloseTo(650_000, 6);
    expect(bills.afterRp[0]).toBeCloseTo(650_000, 6);
    expect(bills.savingsRp[0]).toBeCloseTo(0, 6);
  });

  it("saves the tariff, plus its tax, on every kWh solar replaces", () => {
    // 2,200 VA, 400 kWh used, 300 still bought: 100 kWh × 1,444.70 ÷ 0.95 = 152,073.684...
    const bills = compareBills(everyMonth(400), everyMonth(300), home("postpaid", 2200), ASSUMPTIONS_V1);
    expect(bills.beforeRp[0]).toBeCloseTo(608_294.7368, 3); // 400 × 1,444.70 = 577,880; ÷ 0.95
    expect(bills.afterRp[0]).toBeCloseTo(456_221.0526, 3); // 300 × 1,444.70 = 433,410; ÷ 0.95
    expect(bills.savingsRp[0]).toBeCloseTo(152_073.6842, 3);
    expect(bills.savingsRp).toHaveLength(12);
  });

  it("stops the bill after solar at the minimum charge: a postpaid home buying almost nothing", () => {
    // 2,200 VA postpaid, 400 kWh used, 5 kWh still bought.
    // 5 × 1,444.70 = 7,223.50 is below the minimum of 127,133.60, so the bill is the minimum.
    const bills = compareBills(everyMonth(400), everyMonth(5), home("postpaid", 2200), ASSUMPTIONS_V1);
    expect(bills.afterRp[0]).toBeCloseTo(133_824.8421, 3); // 127,133.60 ÷ 0.95
    // Savings: (577,880 − 127,133.60) ÷ 0.95 = 450,746.40 ÷ 0.95
    expect(bills.savingsRp[0]).toBeCloseTo(474_469.8947, 3);
  });

  it("gives negative savings to a prepaid home that spends less than the minimum charge today", () => {
    // 1,300 VA prepaid, Rp50,000 a month: 50,000 × 0.95 ÷ 1,444.70 = 32.88 kWh.
    // Before solar a prepaid customer has no minimum, so the bill is the Rp50,000 they pay.
    // After solar they move to a monthly bill (Regulation 2/2024 Article 16) with a minimum of
    // 40 × 1.3 × 1,444.70 = 75,124.40, which beats the 20 kWh × 1,444.70 = 28,894 they still buy.
    const loadKwh = (50_000 * 0.95) / 1444.7;
    const bills = compareBills(everyMonth(loadKwh), everyMonth(20), home("prepaid", 1300), ASSUMPTIONS_V1);
    expect(bills.beforeRp[0]).toBeCloseTo(50_000, 6);
    expect(bills.afterRp[0]).toBeCloseTo(79_078.3158, 3); // 75,124.40 ÷ 0.95
    expect(bills.savingsRp[0]).toBeCloseTo(-29_078.3158, 3); // 50,000 − 79,078.32
  });

  it("charges the same home on a postpaid bill the minimum before solar too, so it saves nothing and loses nothing", () => {
    // Before: max(47,500, 75,124.40) ÷ 0.95 = 79,078.32. After: the same.
    const loadKwh = (50_000 * 0.95) / 1444.7;
    const bills = compareBills(everyMonth(loadKwh), everyMonth(20), home("postpaid", 1300), ASSUMPTIONS_V1);
    expect(bills.beforeRp[0]).toBeCloseTo(79_078.3158, 3);
    expect(bills.savingsRp[0]).toBeCloseTo(0, 6);
  });

  it("applies no minimum in a subsidised class, before or after solar", () => {
    // 450 VA, 150 kWh used, 1 kWh still bought: 149 × 415 ÷ 0.95 = 65,089.47
    const bills = compareBills(everyMonth(150), everyMonth(1), home("postpaid", 450, true), ASSUMPTIONS_V1);
    expect(bills.afterRp[0]).toBeCloseTo(436.8421, 3); // 415 ÷ 0.95
    expect(bills.savingsRp[0]).toBeCloseTo(65_089.4737, 3);
  });
});
