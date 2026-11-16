// How the landing page hands the address its visitor typed to step 1
// (SPEC 2.1). It goes through the browser's session storage and never the
// URL, because an address in a URL is kept in server logs and browser
// history. Session storage ends with the tab.
//
// Storage can throw (private mode, blocked site data, a full disk). Every
// access is wrapped: on failure the address is simply not handed over and
// the visitor types it again in step 1.

const PENDING_ADDRESS_KEY = "suryapas.pendingAddress";

/** The landing page calls this when its form is submitted. */
export function storePendingAddress(address: string): void {
  try {
    const text = address.trim();
    if (text) window.sessionStorage.setItem(PENDING_ADDRESS_KEY, text);
  } catch {
    // Nothing to do: see above.
  }
}

/** Step 1 calls this once. Returns the address and forgets it, or "". */
export function takePendingAddress(): string {
  try {
    const address = window.sessionStorage.getItem(PENDING_ADDRESS_KEY) ?? "";
    window.sessionStorage.removeItem(PENDING_ADDRESS_KEY);
    return address.trim();
  } catch {
    return "";
  }
}
