import { useEffect, useRef, useState } from "react";

/**
 * Whether the element is no taller than the browser window, measured.
 * The result page pins its left column (verdict and picker) only when all of
 * it fits on screen; a pinned column taller than the window would hide its
 * lower part (the picker's status line) with no way to scroll to it.
 *
 * Until the first measurement the answer is false, so the column starts
 * static and scrolls with the page. It is measured again whenever the element
 * changes size (a warning appears, the text wraps) and whenever the window
 * is resized.
 *
 * Usage: `const [ref, fits] = useFitsInWindow<HTMLDivElement>();`
 */
// Rounding slack between the element's fractional height and the window's whole pixels.
const SUBPIXEL_PX = 1;

export function useFitsInWindow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [fits, setFits] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;

    const measure = () => setFits(element.getBoundingClientRect().height <= window.innerHeight + SUBPIXEL_PX);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return [ref, fits] as const;
}
