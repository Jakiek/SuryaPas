// Figures and charts ease to their new values when the panel count changes
// (docs/DESIGN.md "Motion": about 200 ms, instant with reduced motion).
//
// The idea: keep what is on screen, and for a short time show values part of
// the way from the old system to the new one. On the last frame the page
// shows the engine's values themselves, not an approximation of them.

import { useEffect, useRef, useState } from "react";

export const EASE_MS = 200;

/**
 * A value part of the way from `from` to `to`; `t` runs from 0 to 1.
 * Numbers move in a straight line. Arrays of the same length and objects move
 * field by field. Anything that cannot move (a null, text, arrays of different
 * lengths) jumps straight to `to`.
 */
export function lerpShape<T>(from: T, to: T, t: number): T {
  if (typeof from === "number" && typeof to === "number") {
    return (from + (to - from) * t) as T;
  }
  if (Array.isArray(from) && Array.isArray(to)) {
    if (from.length !== to.length) return to;
    return to.map((value, index) => lerpShape(from[index], value, t)) as T;
  }
  if (isPlainObject(from) && isPlainObject(to)) {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(to)) {
      result[key] = lerpShape(from[key], to[key], t);
    }
    return result as T;
  }
  return to;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Fast at first, gentle at the end: the usual feel for a value settling. */
export function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Returns `target`, eased over EASE_MS from whatever was shown before.
 * Pass a value that keeps its identity between renders (from useMemo or
 * props), or every render starts a new animation.
 */
export function useEased<T>(target: T): T {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    const from = shownRef.current;
    if (from === target) return;
    const duration = prefersReducedMotion() ? 0 : EASE_MS;
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const value = progress >= 1 ? target : lerpShape(from, target, easeOutCubic(progress));
      shownRef.current = value;
      setShown(value);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return shown;
}
