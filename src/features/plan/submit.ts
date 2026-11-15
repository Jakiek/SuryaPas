// Sending the finished flow to the server (SPEC 5.1: POST /api/assessments).

import { assessmentRequestSchema, type AssessmentRequest } from "../../lib/schema";
import type { PlanDraft } from "./draft";

export type SubmitResult =
  | { ok: true; id: string }
  | { ok: false; reason: "invalid" | "network" | "server" };

/**
 * Builds the request body from the draft. Returns null if the draft does
 * not pass the whole-input schema, so an incomplete draft is never sent.
 */
export function buildRequest(
  draft: PlanDraft,
  locale: "id" | "en",
): AssessmentRequest | null {
  const parsed = assessmentRequestSchema.safeParse({
    inputs: {
      location: draft.location,
      roof: draft.roof,
      electricity: draft.electricity,
      lifestyle: draft.lifestyle,
    },
    overrides: draft.overrides,
    locale,
  });
  return parsed.success ? parsed.data : null;
}

/**
 * TEMPORARY, until T13 adds the route: while developing, a 404 from
 * /api/assessments is answered with the reserved id "example" (SPEC 5.1),
 * so the whole flow can be walked end to end. T13 deletes this function.
 */
function developmentMock(response: Response): SubmitResult | null {
  const routeNotBuiltYet = response.status === 404;
  if (process.env.NODE_ENV === "development" && routeNotBuiltYet) {
    return { ok: true, id: "example" };
  }
  return null;
}

/** Posts the request. The caller keeps the draft whatever the outcome. */
export async function submitAssessment(
  draft: PlanDraft,
  locale: "id" | "en",
  send: typeof fetch = fetch,
): Promise<SubmitResult> {
  const body = buildRequest(draft, locale);
  if (body === null) return { ok: false, reason: "invalid" };

  let response: Response;
  try {
    response = await send("/api/assessments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, reason: "network" };
  }

  const mocked = developmentMock(response);
  if (mocked) return mocked;
  if (!response.ok) return { ok: false, reason: "server" };

  try {
    const { id } = (await response.json()) as { id?: unknown };
    return typeof id === "string" ? { ok: true, id } : { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "server" };
  }
}
