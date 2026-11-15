// The hatching of docs/DESIGN.md "Colour": navy diagonal lines, used for
// solar sent to the grid unpaid (over sun-soft) and for the upfront-cost
// band (over nothing). Defined once per chart as an SVG pattern.

type HatchProps = {
  id: string;
  /** The colour under the lines; none leaves it see-through. */
  background?: string;
  lineOpacity: number;
};

export const NIGHT = "var(--color-night)";
export const SUN = "var(--color-sun)";
export const SUN_SOFT = "var(--color-sun-soft)";
export const INK_SOFT = "var(--color-ink-soft)";
export const PAPER = "var(--color-paper)";
export const RULE = "color-mix(in srgb, var(--color-night) 20%, transparent)";

export function Hatch({ id, background, lineOpacity }: HatchProps) {
  return (
    <defs>
      <pattern id={id} width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        {background && <rect width={6} height={6} fill={background} />}
        <line x1={0} y1={0} x2={0} y2={6} stroke={NIGHT} strokeWidth={2.2} strokeOpacity={lineOpacity} />
      </pattern>
    </defs>
  );
}

/** React's useId gives ids such as «r1» or :r1:, which url(#…) cannot always read. */
export function svgSafeId(reactId: string, suffix: string): string {
  return `${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}-${suffix}`;
}
