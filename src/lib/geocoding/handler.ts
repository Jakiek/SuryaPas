// The logic of GET /api/geocode (SPEC 5.1), kept apart from the route file
// so a test can hand it a fake fetch.
//
// Privacy (SPEC 2.6): the text is a person's address. It is sent only to
// Photon. It is never logged, never put in an event, and the response is
// marked uncacheable so no shared cache keeps it.

import { buildPhotonUrl, parsePhotonResponse } from "./photon";

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

// Too short to search usefully, and too long to be an address.
export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 200;

const PHOTON_TIMEOUT_MS = 5000;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function handleGeocodeRequest(
  request: Request,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  const text = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (text.length < MIN_QUERY_LENGTH || text.length > MAX_QUERY_LENGTH) {
    return json({ error: "invalid_query" }, 400);
  }

  try {
    const answer = await fetcher(buildPhotonUrl(text), {
      // Photon's policy asks clients to identify themselves.
      headers: { "User-Agent": "SuryaPas/0.1 (rooftop solar calculator)" },
      signal: AbortSignal.timeout(PHOTON_TIMEOUT_MS),
    });
    if (!answer.ok) return json({ error: "geocoder_unavailable" }, 502);
    return json(parsePhotonResponse(await answer.json()), 200);
  } catch {
    // Deliberately no logging of the error: it can carry the request URL.
    return json({ error: "geocoder_unavailable" }, 502);
  }
}
