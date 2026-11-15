// The logic of POST /api/events (SPEC 5.1), apart from the route file so a
// test can hand it its own store.
import { eventRequestSchema } from "../../../lib/events";
import type { Store } from "../../../lib/store/types";

export async function handleEventRequest(
  request: Request,
  store: Pick<Store, "recordEvent">,
): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsed = eventRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // Only the two checked fields are stored, never the raw body.
  await store.recordEvent({ name: parsed.data.name, assessmentId: parsed.data.assessmentId ?? null });
  return new Response(null, { status: 204 });
}
