// Step 4 of the pipeline (SPEC 3.2): which system sizes fit on the roof.

import { valueOf } from "../assumptions";
import type { AssumptionSet } from "../assumptions";
import type { RoofInput } from "../types";

const WATTS_PER_KILOWATT = 1000;

export interface CandidateSizes {
  /** Panel counts to assess, smallest first. Empty when the roof is too small. */
  panelCounts: number[];
  /** Fewest panels that make the smallest system installers sell. */
  minPanels: number;
  /** Most panels the usable roof area holds. */
  maxPanels: number;
  /** Roof area the smallest system needs, at this roof's usable fraction. */
  requiredAreaM2: number;
}

/** The power of a number of panels, in kWp. */
export function kwpOfPanels(panels: number, assumptions: AssumptionSet): number {
  return (panels * valueOf(assumptions, "panel.wattPeak")) / WATTS_PER_KILOWATT;
}

/**
 * Every whole number of panels from the smallest system up to what the roof holds.
 * No regulation caps the size (Regulation 2/2024 removed the cap); PLN's local quota is the
 * only outside limit, and the engine cannot know it.
 */
export function listCandidateSizes(roof: RoofInput, assumptions: AssumptionSet): CandidateSizes {
  const panelArea = valueOf(assumptions, "panel.areaM2");
  const panelKwp = kwpOfPanels(1, assumptions);

  const minPanels = Math.ceil(valueOf(assumptions, "system.minKwp") / panelKwp);
  const usableArea = roof.areaM2 * roof.usableFraction;
  const maxPanels = Math.floor(usableArea / panelArea);
  const requiredAreaM2 = (minPanels * panelArea) / roof.usableFraction;

  const panelCounts: number[] = [];
  for (let panels = minPanels; panels <= maxPanels; panels++) {
    panelCounts.push(panels);
  }
  return { panelCounts, minPanels, maxPanels, requiredAreaM2 };
}
