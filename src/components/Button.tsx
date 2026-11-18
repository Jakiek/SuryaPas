import type { MouseEventHandler, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { cx } from "./cx";

type ButtonProps = {
  // "solid" is the primary action; "outline" is the secondary one.
  variant?: "solid" | "outline";
  // The arrow on the right. Leave it on for actions that move the user on.
  arrow?: boolean;
  // A short note on the right in small capitals, such as "Segera hadir".
  // It takes the arrow's place.
  note?: string;
  // With href the button is a link (in the current language);
  // without it, a <button>.
  href?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  // For layout only (margins, alignment in a grid).
  className?: string;
  children: ReactNode;
};

// Shared by both variants: a rectangle 56 px tall with the label on the
// left and the arrow on the right (docs/DESIGN.md "Components").
// Full width on phones, as wide as its content from 620 px.
const BASE =
  "inline-flex min-h-control w-full cursor-pointer items-center justify-between gap-[18px] " +
  "border-heavy px-5 text-left text-[17px] font-extrabold no-underline " +
  // Only the fill and text ease. Tailwind's transition-colors would also
  // ease the focus ring's colour, so the ring would flash in the text
  // colour (white on a white page) for 200 ms before it appeared.
  "transition-[background-color,color] duration-(--motion-ease) sm:w-auto " +
  "disabled:cursor-not-allowed disabled:opacity-45";

// The colours come from the band the button sits in (see globals.css):
// navy on yellow or white, yellow on navy.
const VARIANT = {
  solid:
    "border-action bg-action text-on-action not-disabled:hover:bg-action-hover",
  outline:
    "border-fg bg-transparent text-fg not-disabled:hover:bg-fg/7",
} as const;

export function Button({
  variant = "solid",
  arrow = true,
  note,
  href,
  type = "button",
  disabled = false,
  onClick,
  className,
  children,
}: ButtonProps) {
  const classes = cx(BASE, VARIANT[variant], className);

  const content = (
    <>
      <span>{children}</span>
      {note ? (
        <small className="ml-auto whitespace-nowrap text-[11px] font-extrabold uppercase tracking-[0.12em] opacity-70">
          {note}
        </small>
      ) : (
        arrow && <Arrow />
      )}
    </>
  );

  if (href !== undefined) {
    return (
      <Link href={href} onClick={onClick} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {content}
    </button>
  );
}

// The arrow at the right of a button. Drawn here, and not typed as "→",
// because the text font has no arrow and each device would fall back to
// a different one. Matches the approved mock's heavy arrow (a 22 px "→" in
// weight 800): about 18 px wide, 3 px stroke, rounded ends.
function Arrow() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 17 14"
      width={18}
      height={15}
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M2 7h13M9.5 1.8 14.7 7l-5.2 5.2" />
    </svg>
  );
}
