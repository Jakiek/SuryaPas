import { useId, type ChangeEventHandler } from "react";
import { Button } from "./Button";

type HeroInputProps = {
  label: string;
  // The label of the joined button, such as "Hitung".
  buttonLabel: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoComplete?: string;
};

// The tool's first input, used as the landing page's hero: a white field
// with a 2.5 px navy border joined to its button. Stacked on phones (the
// field has no bottom border, so the button closes the box); side by side
// from 620 px (the field has no right border).
//
// Put it inside a <form>; the button submits that form.
export function HeroInput({ label, buttonLabel, ...inputProps }: HeroInputProps) {
  const id = useId();

  return (
    <div className="max-w-[560px]">
      <label htmlFor={id} className="mb-2 block text-[15px] font-extrabold">
        {label}
      </label>
      <div className="grid sm:grid-cols-[1fr_auto]">
        <input
          {...inputProps}
          id={id}
          type="text"
          className={
            "min-h-field w-full border-heavy border-b-0 border-night bg-paper px-4 " +
            "text-[17px] font-semibold text-night " +
            "placeholder:font-medium placeholder:text-ink-soft " +
            "sm:border-r-0 sm:border-b-heavy"
          }
        />
        <Button type="submit">{buttonLabel}</Button>
      </div>
    </div>
  );
}
