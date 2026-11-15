import { cx } from "./cx";

// Sizes from the mock: "sm" in a ledger row, "md" standing alone,
// "fluid" when two figures share a row and must shrink on a narrow phone.
const SIZE_CLASS = {
  sm: "text-figure-sm",
  md: "text-figure-md",
  fluid: "text-figure-fluid",
} as const;

type FigureProps = {
  // The number as text, already formatted: "Rp18–25", "98", "6–9".
  value: string;
  // The word or sign after it: "juta", "%", "tahun".
  unit?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
};

// A number the user reads as a result, in the Figure style of
// docs/DESIGN.md "Type". The unit is set at half the figure's size.
// The helpers in src/lib/format return { figure, unit } ready for this.
export function Figure({ value, unit, size = "sm", className }: FigureProps) {
  return (
    <span
      className={cx("type-figure whitespace-nowrap", SIZE_CLASS[size], className)}
    >
      {value}
      {unit && (
        <>
          {/* A real space, so copied text reads "Rp18–25 juta". */}{" "}
          <small className="text-[0.5em] tracking-normal">{unit}</small>
        </>
      )}
    </span>
  );
}
