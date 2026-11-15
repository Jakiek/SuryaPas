// Step 1 of the pipeline (SPEC 3.2): from rupiah spent to kWh used, month by month.

import { TARIFF_CLASS_ORDER, valueOf } from "../assumptions";
import type { AssumptionSet, TariffClass } from "../assumptions";
import { MONTHS_PER_YEAR } from "../calendar";
import type { ElectricityInput, Monthly } from "../types";

/**
 * Finds the PLN tariff class for a connected power.
 * A home marked subsidised above 900 VA falls back to the ordinary class, since no subsidised class exists there.
 */
export function tariffClassOf(connectedVa: number, subsidised: boolean, assumptions: AssumptionSet): TariffClass {
  const classes = assumptions.powerClasses.classes;
  const smallestFitting = (wantSubsidised: boolean) =>
    TARIFF_CLASS_ORDER.find((name) => classes[name].subsidised === wantSubsidised && connectedVa <= classes[name].maxVa);

  const match = (subsidised ? smallestFitting(true) : undefined) ?? smallestFitting(false);
  if (match === undefined) {
    throw new Error(`No tariff class for ${connectedVa} VA.`);
  }
  return match;
}

/**
 * Energy used in each month, in kWh.
 *
 *   kWh = spend × (1 − overhead share) ÷ tariff
 *
 * The overhead share is the part of the spend that is tax or fees and buys no energy.
 * Twelve spend values are read as January to December; fewer are averaged and used for every month.
 */
export function monthlyEnergyKwh(electricity: ElectricityInput, assumptions: AssumptionSet): Monthly {
  const spend = electricity.monthlySpendRp;
  if (spend.length < 1 || spend.length > MONTHS_PER_YEAR) {
    throw new Error("Monthly spend needs between one and twelve values.");
  }

  const tariffClass = tariffClassOf(electricity.connectedVa, electricity.subsidised, assumptions);
  const tariff = assumptions.powerClasses.classes[tariffClass].tariffRpPerKwh;
  const energyShare = 1 - valueOf(assumptions, "bill.overheadShare");
  const toKwh = (rupiah: number) => (rupiah * energyShare) / tariff;

  if (spend.length === MONTHS_PER_YEAR) {
    return spend.map(toKwh);
  }
  const meanSpend = spend.reduce((sum, rupiah) => sum + rupiah, 0) / spend.length;
  return Array<number>(MONTHS_PER_YEAR).fill(toKwh(meanSpend));
}
