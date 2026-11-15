// Is the person looking at a result the one who made it?
//
// There are no accounts in stage 1. The browser that made a result still
// holds the answers in its saved draft (SPEC 2.2), so it can offer "edit
// inputs". Anyone else arrived by link and gets the read-only view with
// "plan your own" (SPEC 2.3).
//
// The server sends a SHA-256 digest of the saved inputs, never the inputs
// themselves, so a shared page does not carry the home's location. The
// browser digests its own draft the same way and compares.

import { canonicalJson } from "../../lib/store/json";
import type { JsonValue } from "../../lib/store/types";

/** Hex SHA-256 of the inputs, with keys in sorted order so key order does not matter. */
export async function inputsFingerprint(inputs: unknown): Promise<string> {
  const text = canonicalJson(inputs as JsonValue);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
