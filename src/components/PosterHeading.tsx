import type { ReactNode } from "react";
import { cx } from "./cx";

// One class per heading size; the clamp() behind each is in globals.css.
const SIZE_CLASS = {
  hero: "text-poster-hero", // the landing headline
  answer: "text-poster-answer", // "3 PANEL" on the result
  page: "text-poster-page", // the heading of a flow step
  statement: "text-poster-statement", // the landing argument
  section: "text-poster-section", // a section of the report
} as const;

type PosterHeadingProps = {
  // Choose the level that fits the page outline; size is independent.
  as?: "h1" | "h2" | "h3";
  size: keyof typeof SIZE_CLASS;
  id?: string;
  className?: string;
  children: ReactNode;
};

// A heading in the Poster style of docs/DESIGN.md "Type": heavy,
// condensed capitals with tight lines.
export function PosterHeading({
  as: Tag = "h2",
  size,
  id,
  className,
  children,
}: PosterHeadingProps) {
  return (
    <Tag id={id} className={cx("type-poster", SIZE_CLASS[size], className)}>
      {children}
    </Tag>
  );
}

// The word "pas" inside a poster heading sits in a tight rectangular
// outline, "the visual form of exact fit" (docs/DESIGN.md "Type").
// Sizes are in em so the box scales with the heading.
export function BoxedWord({ children }: { children: ReactNode }) {
  return (
    <span className="mx-[0.02em] inline-block border-[0.055em] border-current px-[0.08em] pt-[0.03em] leading-[0.8]">
      {children}
    </span>
  );
}
