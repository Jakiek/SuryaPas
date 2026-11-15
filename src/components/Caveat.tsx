import type { ReactNode } from "react";
import { cx } from "./cx";

type CaveatProps = {
  // The finding, stated in one line.
  title: string;
  // The explanation under it.
  children?: ReactNode;
  className?: string;
};

// A warning the user must not miss: text with a 6 px red bar on its left
// and no background (docs/DESIGN.md "Components"). The red is only ever
// the bar; the words stay in the normal text colour.
export function Caveat({ title, children, className }: CaveatProps) {
  return (
    <div
      role="note"
      className={cx("border-l-[6px] border-alert py-0.5 pl-4", className)}
    >
      <strong className="block text-[17px]">{title}</strong>
      {children}
    </div>
  );
}
