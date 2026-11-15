"use client";

import { useEffect, useState } from "react";
import { readSavedDraft } from "../plan/planStore";
import { buildRequest } from "../plan/submit";
import { inputsFingerprint } from "./ownership";

/** Browser storage, or null where it is blocked (private mode, settings). */
function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * True when this browser's saved draft holds the same answers as the result:
 * the person who made it, who may go back and change them (see ownership.ts).
 * False for everyone else, and on the server, so the first render is the
 * read-only one and only the owner's view changes after loading.
 */
export function useIsOwner(resultFingerprint: string, isExample: boolean): boolean {
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    if (isExample) return;
    let cancelled = false;
    const draft = readSavedDraft(browserStorage());
    const request = draft === null ? null : buildRequest(draft, "id");
    if (request === null) return;
    void inputsFingerprint(request.inputs).then((fingerprint) => {
      if (!cancelled) setIsOwner(fingerprint === resultFingerprint);
    });
    return () => {
      cancelled = true;
    };
  }, [resultFingerprint, isExample]);

  return isOwner;
}
