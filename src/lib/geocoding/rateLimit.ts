// A best-effort limit on address searches per caller, so the route cannot be
// used as an open door to the public geocoder (whose fair-use rule applies to
// this server's address as a whole).
//
// "Best effort": the counts live in this server process's memory. On a host
// that runs several instances (Vercel does) each instance counts on its own,
// and a restart forgets everything, so the real limit is somewhat looser than
// the number below. It stops a runaway script, not a determined one.

export interface RateLimiter {
  /** Records one request from `caller`; false when it is over the limit. */
  allow(caller: string): boolean;
}

// One person typing makes about two searches a second at the very most, with
// the 500 ms pause in the browser; 30 a minute leaves room for several people
// behind one address (a shared office or mobile network).
export const SEARCHES_PER_WINDOW = 30;
export const WINDOW_MS = 60_000;

export function createRateLimiter(
  now: () => number = Date.now,
  limit = SEARCHES_PER_WINDOW,
  windowMs = WINDOW_MS,
): RateLimiter {
  // The times of each caller's recent requests, oldest first.
  const recent = new Map<string, number[]>();

  return {
    allow(caller) {
      const current = now();
      const withinWindow = (recent.get(caller) ?? []).filter((time) => current - time < windowMs);
      if (withinWindow.length >= limit) {
        recent.set(caller, withinWindow);
        return false;
      }
      withinWindow.push(current);
      recent.set(caller, withinWindow);

      // Keep the map from growing for ever: forget callers gone quiet.
      if (recent.size > 5000) {
        for (const [name, times] of recent) {
          if (times.every((time) => current - time >= windowMs)) recent.delete(name);
        }
      }
      return true;
    },
  };
}

/** Who is calling: the first address in X-Forwarded-For, which a host sets. */
export function callerOf(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
