// Anonymous event counts (SPEC 4.1 `events`, SPEC 5.1 `POST /api/events`).
//
// An event is a name and, at most, the id of the saved result it happened on.
// Nothing else is accepted: no address, no coordinates, no inputs, no device
// details. The schema is strict, so a body with any extra field is rejected
// rather than stored.
//
// This file is shared by the browser (sending) and the server (checking).

import { z } from "zod";
import { isWellFormedAssessmentId } from "../store/ids";

/** Every event the app records. Stage 1 has one: a tap on "get installer quotes" (SPEC 2.3 item 8). */
export const EVENT_NAMES = ["quote_interest"] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export const eventRequestSchema = z
  .object({
    name: z.enum(EVENT_NAMES),
    // Only an id the store could have made. The reserved "example" id is left out by the sender.
    assessmentId: z.string().refine(isWellFormedAssessmentId).optional(),
  })
  .strict();

export type EventRequest = z.infer<typeof eventRequestSchema>;

/**
 * Builds the body the browser sends. The id is dropped when it is not one the
 * store made (for example the example house), so the body is always valid.
 */
export function eventBody(name: EventName, assessmentId?: string): EventRequest {
  return assessmentId !== undefined && isWellFormedAssessmentId(assessmentId)
    ? { name, assessmentId }
    : { name };
}

/** Posts one event. Returns true when the server recorded it. */
export async function sendEvent(
  name: EventName,
  assessmentId?: string,
  send: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await send("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(eventBody(name, assessmentId)),
    });
    return response.ok;
  } catch {
    return false;
  }
}
