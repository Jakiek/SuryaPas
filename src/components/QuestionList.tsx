import { Children, type ReactNode } from "react";
import { cx } from "./cx";

type QuestionListProps = {
  className?: string;
  // One question per child: a TextField, a NumberField, a SegmentedChoice.
  children: ReactNode;
};

// Stacks the questions of one step. Each question gets a 2.5 px rule
// above it (docs/DESIGN.md "Layout") and the mock's 22 px of space on
// both sides of that rule.
export function QuestionList({ className, children }: QuestionListProps) {
  return (
    <div className={className}>
      {Children.map(children, (question, index) => (
        <div
          className={cx(
            "border-fg border-t-heavy pt-[22px]",
            index === 0 ? "mt-2" : "mt-[22px]",
          )}
        >
          {question}
        </div>
      ))}
    </div>
  );
}
