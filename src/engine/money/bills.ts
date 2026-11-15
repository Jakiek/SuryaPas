// Step 7 of the pipeline, first part (SPEC 3.2): what the household pays PLN, before and after solar.

import { valueOf } from "../assumptions";
import type { AssumptionSet } from "../assumptions";
import { tariffClassOf } from "../energy/monthlyEnergy";
import type { BillComparison, ElectricityInput, Monthly } from "../types";

const VA_PER_KVA = 1000;

/**
 * PLN's minimum monthly charge, tax excluded:
 *
 *   minimum charge = 40 hours × connected kVA × tariff
 *
 * Zero in the subsidised classes, which have no minimum charge.
 * Example: 2,200 VA at Rp1,444.70 is 40 × 2.2 × 1,444.70 = Rp127,134.
 */
export function minimumChargeRp(electricity: ElectricityInput, assumptions: AssumptionSet): number {
  const powerClass = assumptions.powerClasses.classes[tariffClassOf(electricity.connectedVa, electricity.subsidised, assumptions)];
  if (!powerClass.hasMinimumCharge) return 0;
  return valueOf(assumptions, "minCharge.hours") * (electricity.connectedVa / VA_PER_KVA) * powerClass.tariffRpPerKwh;
}

/**
 * Compares each month's payment before and after solar.
 *
 * Before solar, the minimum charge applies to postpaid customers only.
 * After solar it applies to everyone in a class that has one, because Regulation 2/2024
 * Article 16 moves a prepaid customer to a monthly bill when rooftop solar is approved.
 *
 * Step 1 removed the tax share from the spend to find the energy used. Tax is a percentage
 * of the charge, so it falls when the charge falls; it is added back here so that
 * "before" equals what the household actually pays today.
 */
export function compareBills(
  monthlyLoadKwh: Monthly,
  monthlyGridImportKwh: Monthly,
  electricity: ElectricityInput,
  assumptions: AssumptionSet,
): BillComparison {
  const tariff = assumptions.powerClasses.classes[tariffClassOf(electricity.connectedVa, electricity.subsidised, assumptions)].tariffRpPerKwh;
  const minimum = minimumChargeRp(electricity, assumptions);
  const minimumBeforeSolar = electricity.billing === "postpaid" ? minimum : 0;
  const withTax = (chargeRp: number) => chargeRp / (1 - valueOf(assumptions, "bill.overheadShare"));

  const beforeRp = monthlyLoadKwh.map((kwh) => withTax(Math.max(kwh * tariff, minimumBeforeSolar)));
  const afterRp = monthlyGridImportKwh.map((kwh) => withTax(Math.max(kwh * tariff, minimum)));
  const savingsRp = beforeRp.map((before, month) => before - afterRp[month]);
  return { beforeRp, afterRp, savingsRp };
}
