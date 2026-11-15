import { describe, expect, it } from "vitest";
import { ASSUMPTIONS_V1, applyOverrides } from "../assumptions";
import type { ElectricityInput } from "../types";
import { monthlyEnergyKwh, tariffClassOf } from "./monthlyEnergy";

// With no bill overhead, kWh is simply rupiah ÷ tariff, which is easy to check by hand.
const noOverhead = applyOverrides(ASSUMPTIONS_V1, { "bill.overheadShare": 0 });

const home = (monthlySpendRp: number[]): ElectricityInput => ({
  billing: "postpaid",
  connectedVa: 2200,
  subsidised: false,
  monthlySpendRp,
});

describe("tariffClassOf", () => {
  it("finds the class for each common connected power", () => {
    expect(tariffClassOf(450, true, ASSUMPTIONS_V1)).toBe("R1_450_subsidised");
    expect(tariffClassOf(900, true, ASSUMPTIONS_V1)).toBe("R1_900_subsidised");
    expect(tariffClassOf(900, false, ASSUMPTIONS_V1)).toBe("R1_900_nonsubsidised");
    expect(tariffClassOf(1300, false, ASSUMPTIONS_V1)).toBe("R1_1300");
    expect(tariffClassOf(2200, false, ASSUMPTIONS_V1)).toBe("R1_2200");
    expect(tariffClassOf(4400, false, ASSUMPTIONS_V1)).toBe("R2_3500_5500");
    expect(tariffClassOf(7700, false, ASSUMPTIONS_V1)).toBe("R3_6600_up");
  });

  it("ignores the subsidised flag above 900 VA, where no subsidised class exists", () => {
    expect(tariffClassOf(2200, true, ASSUMPTIONS_V1)).toBe("R1_2200");
  });
});

describe("monthlyEnergyKwh", () => {
  it("divides spend by the tariff: Rp1,444,700 at Rp1,444.70 per kWh is 1,000 kWh", () => {
    const months = monthlyEnergyKwh(home([1_444_700]), noOverhead);
    expect(months).toHaveLength(12);
    for (const kwh of months) expect(kwh).toBeCloseTo(1000, 6);
  });

  it("removes the overhead share first: 5% of the spend buys no energy", () => {
    const months = monthlyEnergyKwh(home([1_444_700]), ASSUMPTIONS_V1);
    expect(months[0]).toBeCloseTo(950, 6);
  });

  it("averages when fewer than twelve months are given", () => {
    // Mean of 1,444,700 and 2,889,400 is 2,167,050, which buys 1,500 kWh.
    const months = monthlyEnergyKwh(home([1_444_700, 2_889_400]), noOverhead);
    for (const kwh of months) expect(kwh).toBeCloseTo(1500, 6);
  });

  it("keeps twelve months as January to December", () => {
    const spend = Array.from({ length: 12 }, (_, month) => 144_470 * (month + 1));
    const months = monthlyEnergyKwh(home(spend), noOverhead);
    expect(months[0]).toBeCloseTo(100, 6);
    expect(months[11]).toBeCloseTo(1200, 6);
  });

  it("rejects no months and more than twelve", () => {
    expect(() => monthlyEnergyKwh(home([]), ASSUMPTIONS_V1)).toThrow();
    expect(() => monthlyEnergyKwh(home(Array<number>(13).fill(1)), ASSUMPTIONS_V1)).toThrow();
  });
});
