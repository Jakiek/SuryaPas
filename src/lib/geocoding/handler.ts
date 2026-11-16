// The logic of POST /api/geocode (SPEC 5.1), kept apart from the route file
// so a test can hand it a fake fetch.
//
// Privacy (SPEC 2.6): the text is a person's address. It arrives in the
// request body, not the URL, because request logs keep URLs. It is sent only
// to Photon, never logged and never put in an event, and the response is
// marked uncacheable so no shared cache keeps it.

import { buildPhotonUrl, parsePhotonResponse } from "./photon";
import { callerOf, createRateLimiter, type RateLimiter } from "./rateLimit";

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export interface GeocodeDeps {
  fetcher: Fetcher;
  limiter: RateLimiter;
}

// Too short to search usefully, and too long to be an address.
export const MIN_QUERY_LENGTH = 3;
export const MAX_QUERY_LENGTH = 200;

const PHOTON_TIMEOUT_MS = 5000;

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** The search text from a body such as {"q":"Jalan Malioboro"}, or "". */
async function searchTextOf(request: Request): Promise<string> {
  try {
    const body = (await request.json()) as { q?: unknown };
    return typeof body.q === "string" ? body.q.trim() : "";
  } catch {
    return "";
  }
}

export const defaultGeocodeDeps: GeocodeDeps = {
  fetcher: fetch,
  limiter: createRateLimiter(),
};

export async function handleGeocodeRequest(
  request: Request,
  deps: GeocodeDeps = defaultGeocodeDeps,
): Promise<Response> {
  // Checked before anything is read, so a flood costs almost nothing.
  if (!deps.limiter.allow(callerOf(request))) return json({ error: "rate_limited" }, 429);

  const text = await searchTextOf(request);
  if (text.length < MIN_QUERY_LENGTH || text.length > MAX_QUERY_LENGTH) {
    return json({ error: "invalid_query" }, 400);
  }

  try {
    const answer = await deps.fetcher(buildPhotonUrl(text), {
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
