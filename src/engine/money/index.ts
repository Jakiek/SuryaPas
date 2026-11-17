// The money half of the engine: steps 7 and 9 of SPEC 3.2 for one system.

import { valueOf } from "../assumptions";
import type { AssumptionSet } from "../assumptions";
import type { ElectricityInput, EnergyResult, MoneyResult, Monthly } from "../types";
import { compareBills } from "./bills";
import { projectMoney, solarCostRange } from "./projection";

export * from "./bills";
export * from "./projection";

const MONTHS_PER_YEAR = 12;

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/**
 * Turns one system's year of energy flows into money: bills, cost, payback and net savings.
 * The projection is run three times, at the low, typical and high installed cost,
 * which is where the payback range comes from.
 */
export function assessMoney(
  energy: EnergyResult,
  kwp: number,
  batteryKwh: number | null,
  monthlyLoadKwh: Monthly,
  electricity: ElectricityInput,
  assumptions: AssumptionSet,
): MoneyResult {
  const bills = compareBills(monthlyLoadKwh, energy.monthly.gridImportKwh, electricity, assumptions);
  const firstYearSavingsRp = sum(bills.savingsRp);

  const solarCost = solarCostRange(kwp, assumptions);
  const at = (solarCostRp: number) => projectMoney({ firstYearSavingsRp, solarCostRp, batteryKwh }, assumptions);
  const low = at(solarCost.low);
  const typical = at(solarCost.typical);
  const high = at(solarCost.high);

  return {
    upfrontCostRp: { low: low.upfrontCostRp, typical: typical.upfrontCostRp, high: high.upfrontCostRp },
    firstYearSavingsRp,
    monthlySavingsRp: firstYearSavingsRp / MONTHS_PER_YEAR,
    paybackYears: { low: low.paybackYear, typical: typical.paybackYear, high: high.paybackYear },
    netSavingsRp: typical.netSavingsRp,
    cumulativeSavingsRp: typical.cumulativeSavingsRp,
    // SPEC 3.3: all three series, so the chart can draw savings as a band (SPEC 2.3 item 5).
    cumulativeSavingsByCostRp: {
      low: low.cumulativeSavingsRp,
      typical: typical.cumulativeSavingsRp,
      high: high.cumulativeSavingsRp,
    },
    selfConsumedShare: energy.generationKwh === 0 ? 0 : energy.selfConsumedKwh / energy.generationKwh,
    // Step 9. Exported surplus is left out, which keeps the claim conservative.
    co2AvoidedKgPerYear: energy.selfConsumedKwh * valueOf(assumptions, "grid.emissionKgCo2PerKwh"),
  };
}
