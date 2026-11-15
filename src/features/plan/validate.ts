// Which step a draft is still missing something in. The shell uses it when
// the server-bound check fails: it sends the user to that step.

import {
  electricitySchema,
  lifestyleSchema,
  locationSchema,
  roofSchema,
} from "../../lib/schema";
import type { PlanDraft, StepNumber } from "./draft";

/** The first step, counting from 1, whose answers do not pass; null if all pass. */
export function firstInvalidStep(draft: PlanDraft): StepNumber | null {
  const checks: [StepNumber, boolean][] = [
    [1, locationSchema.safeParse(draft.location).success],
    [2, roofSchema.safeParse(draft.roof).success],
    [3, electricitySchema.safeParse(draft.electricity).success],
    [4, lifestyleSchema.safeParse(draft.lifestyle).success],
  ];
  const failing = checks.find(([, valid]) => !valid);
  return failing ? failing[0] : null;
}
