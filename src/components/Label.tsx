import type { ReactNode } from "react";
import { cx } from "./cx";

type LabelProps = {
  as?: "span" | "p" | "div";
  className?: string;
  children: ReactNode;
};

// The Label style of docs/DESIGN.md "Type": small bold capitals, used
// above figures and over table columns.
export function Label({ as: Tag = "span", className, children }: LabelProps) {
  return <Tag className={cx("type-label", className)}>{children}</Tag>;
}
