// A time limit for the database's network requests. This is a transport
// setting, not a product number, so it lives here and not in the assumption
// set. Without it a database that answers 503 keeps the client retrying and
// "not saved" reaches the visitor after about 14 seconds; with it, a slow or
// hanging database is reported within a few seconds.
export const DATABASE_REQUEST_TIMEOUT_MS = 4000;

/** `fetch` that gives up, with an error, after `timeoutMs`. */
export function fetchWithTimeout(timeoutMs: number = DATABASE_REQUEST_TIMEOUT_MS): typeof fetch {
  return (input, init) => {
    const timeout = AbortSignal.timeout(timeoutMs);
    // Keep any cancellation the caller already asked for.
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout;
    return fetch(input, { ...init, signal });
  };
}
