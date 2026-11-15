"use client";

import { useId, type ReactNode } from "react";
import { cx } from "./cx";

export type SegmentedOption<Value extends string> = {
  value: Value;
  label: string;
  // A few words under the label, such as "pagi atau sore".
  note?: string;
  // A line drawing: an <svg> that strokes with currentColor, so it turns
  // white when its option is selected. Hide it from screen readers with
  // aria-hidden; the label already says what the option is.
  picture?: ReactNode;
};

type SegmentedChoiceProps<Value extends string> = {
  // The question. It becomes the name of the radio group.
  legend: string;
  help?: string;
  // The form field name; also keeps the radios in one group.
  name: string;
  options: SegmentedOption<Value>[];
  // The selected value, or null while nothing is chosen.
  value: Value | null;
  onChange: (value: Value) => void;
  // "tall" fits a 60 × 44 drawing; "short" fits a 28 × 28 arrow.
  size?: "tall" | "short";
  className?: string;
};

// A choice of one among a few options that share one outlined block with
// dividers between them (docs/DESIGN.md "Components"). The selected
// option inverts to navy with white content.
//
// It is built from real radio buttons, made invisible and stretched over
// each option. The browser therefore gives the keyboard behaviour of a
// radio group for free: Tab enters the group, the arrow keys move and
// select, and a screen reader announces "radio, 2 of 3".
//
// Designed for white and yellow bands.
export function SegmentedChoice<Value extends string>({
  legend,
  help,
  name,
  options,
  value,
  onChange,
  size = "tall",
  className,
}: SegmentedChoiceProps<Value>) {
  const id = useId();
  const helpId = `${id}-help`;

  return (
    <fieldset
      aria-describedby={help ? helpId : undefined}
      className={cx("min-w-0", className)}
    >
      <legend className="text-[19px] font-extrabold tracking-[-0.01em]">
        {legend}
      </legend>
      {help && (
        <p id={helpId} className="pt-0.5 text-sm text-soft">
          {help}
        </p>
      )}

      {/* The outlined block. While a radio inside has keyboard focus, the
          whole block shows the focus ring. */}
      <div
        className={
          "mt-3 grid border-heavy border-night bg-paper text-night " +
          "has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-fg"
        }
        style={{
          gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        }}
      >
        {options.map((option, index) => {
          const optionId = `${id}-${option.value}`;
          return (
            <div
              key={option.value}
              className={cx("relative", index > 0 && "border-l-heavy border-night")}
            >
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                checked={value === option.value}
                onChange={() => onChange(option.value)}
                className="peer absolute inset-0 m-0 h-full w-full cursor-pointer opacity-0"
              />
              <label
                htmlFor={optionId}
                className={cx(
                  "grid h-full content-center justify-items-center gap-1.5 px-1 py-3",
                  "text-center text-sm font-extrabold leading-[1.2]",
                  "transition-colors duration-(--motion-ease)",
                  "peer-checked:bg-night peer-checked:text-paper",
                  // Inside the block's ring, the focused option gets its
                  // own inner outline. It matters when nothing is selected
                  // yet and focus lands on the first option.
                  "peer-focus-visible:outline-[3px] peer-focus-visible:-outline-offset-[7px] peer-focus-visible:outline-current",
                  size === "tall" ? "min-h-[104px]" : "min-h-[76px]",
                )}
              >
                {option.picture}
                {option.label}
                {option.note && (
                  <small className="text-xs font-semibold opacity-80">
                    {option.note}
                  </small>
                )}
              </label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
