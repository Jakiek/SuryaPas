// Sending the finished flow to the server (SPEC 5.1: POST /api/assessments).

import type { Assessment } from "../../engine";
import { assessmentRequestSchema, type AssessmentRequest } from "../../lib/schema";
import {
  browserSessionStorage,
  rememberUnsaved,
  UNSAVED_ID,
  type SessionStorageLike,
} from "../result/unsavedStore";
import type { PlanDraft } from "./draft";

export type SubmitResult =
  | { ok: true; saved: true; id: string }
  // SPEC 2.5 "Saving fails": the server computed the result but could not
  // store it. The id is the fixed address /r/unsaved, so a caller that goes to
  // `/r/${id}` lands on the not-saved page either way. The request comes back
  // so the save can be retried.
  | { ok: true; saved: false; id: string; assessment: Assessment; request: AssessmentRequest }
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

/** Posts the request. The caller keeps the draft whatever the outcome. */
export async function submitAssessment(
  draft: PlanDraft,
  locale: "id" | "en",
  send: typeof fetch = fetch,
  storage: SessionStorageLike | null = browserSessionStorage(),
): Promise<SubmitResult> {
  const body = buildRequest(draft, locale);
  if (body === null) return { ok: false, reason: "invalid" };
  const result = await postRequest(body, send);
  // A result that was not saved is kept for this tab, so /r/unsaved can show it.
  if (result.ok && !result.saved) {
    rememberUnsaved(storage, { request: result.request, assessment: result.assessment });
  }
  return result;
}

/** Posts an already built request; also used to retry the save of a result the server could not store. */
export async function postRequest(
  body: AssessmentRequest,
  send: typeof fetch = fetch,
): Promise<SubmitResult> {
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

  if (!response.ok) return { ok: false, reason: "server" };

  try {
    const answer = (await response.json()) as { id?: unknown; saved?: unknown; assessment?: unknown };
    if (typeof answer.id === "string") return { ok: true, saved: true, id: answer.id };
    if (answer.saved === false && typeof answer.assessment === "object" && answer.assessment !== null) {
      return { ok: true, saved: false, id: UNSAVED_ID, assessment: answer.assessment as Assessment, request: body };
    }
    return { ok: false, reason: "server" };
  } catch {
    return { ok: false, reason: "server" };
  }
}
