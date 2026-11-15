import { useId, type ReactNode } from "react";
import { cx } from "./cx";
import { PosterHeading } from "./PosterHeading";

type SectionProps = {
  heading: ReactNode;
  // The heading level that fits the page outline.
  level?: "h2" | "h3";
  className?: string;
  children?: ReactNode;
};

// One section of a report: a 2.5 px rule, a poster heading, then the
// content. Sections stop at the 680 px measure so nothing stretches on a
// tablet (docs/DESIGN.md "Layout").
export function Section({
  heading,
  level = "h2",
  className,
  children,
}: SectionProps) {
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className={cx(
        "mt-[38px] max-w-measure border-fg border-t-heavy pt-4 first:mt-0",
        className,
      )}
    >
      <PosterHeading as={level} size="section" id={headingId}>
        {heading}
      </PosterHeading>
      {children}
    </section>
  );
}
