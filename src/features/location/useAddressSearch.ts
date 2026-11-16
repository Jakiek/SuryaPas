"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/lib/geocoding/photon";

// How long typing must pause before a search is sent. Photon asks for fair
// use, so one request per pause, not one per key.
export const DEBOUNCE_MS = 500;
// Matches the shortest text the route accepts.
export const MIN_SEARCH_LENGTH = 3;

type Outcome = { query: string; places: Place[]; failed: "no" | "unavailable" | "limited" };

export type SearchStatus = "idle" | "searching" | "found" | "none" | "unavailable" | "limited";

/**
 * Searches for addresses while the user types (SPEC 2.2 step 1). The text
 * goes only to POST /api/geocode, in the request body and not the URL
 * (request logs keep URLs), and the route forwards it to the geocoder; it is
 * not stored and not logged anywhere. The answer is stored with the text it
 * answers, so a slow reply to older text is never shown for newer text.
 */
export function useAddressSearch(query: string) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const text = query.trim();
  const tooShort = text.length < MIN_SEARCH_LENGTH;

  useEffect(() => {
    if (tooShort) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: text }),
          signal: controller.signal,
        });
        if (response.status === 429) {
          setOutcome({ query: text, places: [], failed: "limited" });
          return;
        }
        if (!response.ok) throw new Error("geocoder unavailable");
        const places = (await response.json()) as Place[];
        setOutcome({ query: text, places, failed: "no" });
      } catch {
        // An abort means newer text replaced this one; say nothing for it.
        if (!controller.signal.aborted) setOutcome({ query: text, places: [], failed: "unavailable" });
      }
    }, DEBOUNCE_MS);

    // Typing on cancels the wait, and the request if it already left.
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, tooShort]);

  const answered = outcome !== null && outcome.query === text;
  const status: SearchStatus = tooShort
    ? "idle"
    : !answered
      ? "searching"
      : outcome.failed !== "no"
        ? outcome.failed
        : outcome.places.length === 0
          ? "none"
          : "found";

  return { status, places: answered && !tooShort ? outcome.places : [] };
}
