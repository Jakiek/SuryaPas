"use client";

import { useEffect, useState } from "react";
import type { Place } from "@/lib/geocoding/photon";

// How long typing must pause before a search is sent. Photon asks for fair
// use, so one request per pause, not one per key.
export const DEBOUNCE_MS = 300;
// Matches the shortest text the route accepts.
export const MIN_SEARCH_LENGTH = 3;

type Outcome = { query: string; places: Place[]; failed: boolean };

export type SearchStatus = "idle" | "searching" | "found" | "none" | "unavailable";

/**
 * Searches for addresses while the user types (SPEC 2.2 step 1). The text
 * goes only to GET /api/geocode, which forwards it to the geocoder; it is
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
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("geocoder unavailable");
        const places = (await response.json()) as Place[];
        setOutcome({ query: text, places, failed: false });
      } catch {
        // An abort means newer text replaced this one; say nothing for it.
        if (!controller.signal.aborted) setOutcome({ query: text, places: [], failed: true });
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
      : outcome.failed
        ? "unavailable"
        : outcome.places.length === 0
          ? "none"
          : "found";

  return { status, places: answered && !tooShort ? outcome.places : [] };
}
