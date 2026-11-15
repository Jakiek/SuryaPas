// Zod schemas for the engine's inputs, one per input-flow step plus the
// whole (SPEC 5, "Validation"). The browser forms and the server route
// (POST /api/assessments, T13) both import them, so a value the form
// accepts is a value the server accepts.
//
// Every error message is a KEY into messages/<locale>/plan.json, such as
// "errors.billRequired", and not a sentence. The screen translates the
// key into the active language, so these schemas stay free of text and
// both languages say the same thing.
//
// Each shape is pinned to the engine's own type with `satisfies`, so a
// change to the engine's inputs becomes a type error here, not a bug.

import { z } from "zod";
import type {
  AssumptionOverrides,
  EngineInputs,
  ElectricityInput,
  LifestyleInput,
  LocationInput,
  RoofInput,
} from "../../engine";

// ---------- Small building blocks ----------

/** A number the user may leave empty: an empty field arrives as null. */
const requiredNumber = (missingKey: string) =>
  z.number({ error: missingKey }).refine(Number.isFinite, missingKey);

/** A whole number of rupiah above zero. */
const rupiah = z
  .number({ error: "errors.billRequired" })
  .int("errors.billRequired")
  .positive("errors.billRequired");

// ---------- Step 1: location (stub; T11 adds the Indonesia check) ----------

export const locationSchema = z.object({
  latitude: requiredNumber("errors.latitudeInvalid").min(-90, "errors.latitudeInvalid").max(90, "errors.latitudeInvalid"),
  longitude: requiredNumber("errors.longitudeInvalid").min(-180, "errors.longitudeInvalid").max(180, "errors.longitudeInvalid"),
}) satisfies z.ZodType<LocationInput>;

// ---------- Step 2: roof (stub; T12 adds tracing) ----------

export const roofSchema = z.object({
  areaM2: requiredNumber("errors.areaInvalid").positive("errors.areaInvalid"),
  // SPEC 2.2: a share of the traced area, 0 to 1 (zero would leave no roof).
  usableFraction: requiredNumber("errors.usableInvalid")
    .gt(0, "errors.usableInvalid")
    .max(1, "errors.usableInvalid"),
  facing: z.enum(["N", "E", "S", "W", "none"], { error: "errors.facingRequired" }),
  slope: z.enum(["flat", "gentle", "steep"], { error: "errors.slopeRequired" }),
  shade: z.enum(["none", "some", "heavy"], { error: "errors.shadeRequired" }),
}) satisfies z.ZodType<RoofInput>;

// ---------- Step 3: electricity ----------

export const electricitySchema = z.object({
  billing: z.enum(["prepaid", "postpaid"], { error: "errors.billingRequired" }),
  connectedVa: z
    .number({ error: "errors.powerRequired" })
    .int("errors.powerRequired")
    .positive("errors.powerRequired"),
  subsidised: z.boolean({ error: "errors.powerRequired" }),
  // SPEC 3.1: one to twelve values.
  monthlySpendRp: z
    .array(rupiah)
    .min(1, "errors.billRequired")
    .max(12, "errors.tooManyMonths"),
}) satisfies z.ZodType<ElectricityInput>;

// ---------- Step 4: lifestyle ----------

const yesOrNo = z.boolean({ error: "errors.answerRequired" });

export const lifestyleSchema = z.object({
  homeOnWeekdays: yesOrNo,
  daytimeAc: yesOrNo,
  workFromHome: yesOrNo,
  electricVehicle: yesOrNo,
}) satisfies z.ZodType<LifestyleInput>;

// ---------- The whole ----------

export const engineInputsSchema = z.object({
  location: locationSchema,
  roof: roofSchema,
  electricity: electricitySchema,
  lifestyle: lifestyleSchema,
}) satisfies z.ZodType<EngineInputs>;

/** What the flow sends to POST /api/assessments (SPEC 5.1). */
export const assessmentRequestSchema = z.object({
  inputs: engineInputsSchema,
  // Assumption changes made on the assumptions screen (T14); empty in this flow.
  overrides: z.record(z.string(), z.number()) satisfies z.ZodType<AssumptionOverrides>,
  locale: z.enum(["id", "en"]),
});

export type AssessmentRequest = z.infer<typeof assessmentRequestSchema>;

// ---------- Reading errors ----------

/**
 * Turns a failed parse into "field path -> message key", keeping the first
 * problem per field. Paths are dotted: "monthlySpendRp.0" is the first
 * month, "connectedVa" is the power class.
 */
export function messageKeysByField(error: z.ZodError): Record<string, string> {
  const keys: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    if (!(path in keys)) keys[path] = issue.message;
  }
  return keys;
}
