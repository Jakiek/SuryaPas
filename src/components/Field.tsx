import { useId, type ChangeEventHandler, type FocusEventHandler } from "react";
import { cx } from "./cx";

// What TextField and NumberField have in common.
type SharedFieldProps = {
  // The question, shown above the field.
  label: string;
  // One line of guidance under the label.
  help?: string;
  // What is wrong and what to do about it. Giving an error also marks
  // the field as invalid for screen readers.
  error?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

type TextFieldProps = SharedFieldProps;

type NumberFieldProps = SharedFieldProps & {
  // Text fixed in front of the number, such as "Rp".
  prefix?: string;
  // Text fixed after the number, such as "m²".
  suffix?: string;
  // Allow a decimal separator. Off: the phone shows the digits-only keypad.
  decimal?: boolean;
};

// A one-line text field with its label, help and error.
export function TextField(props: TextFieldProps) {
  return <FieldFrame {...props} inputMode="text" />;
}

// A field for a number. It is a text input with a numeric keypad, not
// <input type="number">: that type rejects "12.500.000" and "1,65", which
// is how Indonesian users type numbers. The value is the text as typed;
// the screen that owns the field turns it into a number.
export function NumberField({ decimal = false, ...props }: NumberFieldProps) {
  return <FieldFrame {...props} inputMode={decimal ? "decimal" : "numeric"} />;
}

type FieldFrameProps = SharedFieldProps & {
  prefix?: string;
  suffix?: string;
  inputMode: "text" | "numeric" | "decimal";
};

// The layout both fields share, following the questions in the mock:
// label, help, then a white box with a 2.5 px navy border, then the error.
function FieldFrame({
  label,
  help,
  error,
  prefix,
  suffix,
  inputMode,
  className,
  ...inputProps
}: FieldFrameProps) {
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  // Screen readers read the help and the error after the label.
  const describedBy =
    cx(help && helpId, error && errorId) || undefined;
  const isNumber = inputMode !== "text";

  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="block text-[19px] font-extrabold tracking-[-0.01em]"
      >
        {label}
      </label>
      {help && (
        <p id={helpId} className="pt-0.5 text-sm text-soft">
          {help}
        </p>
      )}

      {/* The box. The focus ring is drawn around the whole box, so it also
          surrounds the prefix and suffix; the input's own ring is off. */}
      <div
        className={cx(
          "mt-3 flex min-h-field items-stretch border-heavy border-night bg-paper text-night",
          "focus-within:outline-[3px] focus-within:outline-offset-[3px] focus-within:outline-fg",
          inputProps.disabled && "opacity-45",
        )}
      >
        {prefix && (
          <span className="flex items-center pl-4 text-[17px] font-extrabold">
            {prefix}
          </span>
        )}
        <input
          {...inputProps}
          id={id}
          type="text"
          inputMode={inputMode}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            "min-w-0 flex-1 bg-transparent px-4 text-[17px] font-semibold",
            "placeholder:font-medium placeholder:text-ink-soft focus-visible:outline-none",
            "disabled:cursor-not-allowed",
            isNumber && "tabular-nums",
            prefix && "pl-2",
            suffix && "pr-2",
          )}
        />
        {suffix && (
          <span className="flex items-center pr-4 text-[17px] font-extrabold">
            {suffix}
          </span>
        )}
      </div>

      {/* The error uses the caveat's red bar; the words stay navy,
          because the red is never used for text (docs/DESIGN.md). */}
      {error && (
        <p
          id={errorId}
          className="mt-2.5 border-l-[6px] border-alert pl-3 text-[15px] font-bold"
        >
          {error}
        </p>
      )}
    </div>
  );
}
