// A returning visitor (T15): the landing page offers "continue where you left
// off" when the browser holds a draft of the plan flow (suryapas.plan.v1),
// and says which step it resumes.

import { STEP_COUNT, type PlanDraft, type StepNumber } from "../plan/draft";
import { firstInvalidStep } from "../plan/validate";

/**
 * True when the draft holds anything the visitor entered. A draft nobody has
 * touched (or one that holds only defaults) is not worth resuming.
 */
export function hasSavedInputs(draft: PlanDraft): boolean {
  const { location, roof, electricity, lifestyle } = draft;
  return (
    location.latitude !== null ||
    location.longitude !== null ||
    roof.areaM2 !== null ||
    roof.facing !== null ||
    roof.slope !== null ||
    roof.shade !== null ||
    electricity.connectedVa !== null ||
    electricity.monthlySpendRp.some((amount) => amount !== null) ||
    Object.values(lifestyle).some((answer) => answer !== null)
  );
}

/**
 * The step to resume: the one the visitor was on, unless an earlier step is
 * still incomplete (a draft edited by hand, or saved by an older version), in
 * which case that step comes first. The flow only moves forward from a valid
 * step, so for a draft the flow wrote the two agree.
 */
export function resumeStep(draft: PlanDraft): StepNumber {
  const firstIncomplete = firstInvalidStep(draft) ?? STEP_COUNT;
  return Math.min(draft.step, firstIncomplete) as StepNumber;
}
