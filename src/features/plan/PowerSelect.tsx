"use client";

import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDecimal } from "@/lib/format";
import { FieldError } from "./FieldError";
import {
  findPowerChoice,
  findPowerChoiceById,
  POWER_CHOICES,
  type PowerChoice,
} from "./powerClasses";

type PowerSelectProps = {
  connectedVa: number | null;
  subsidised: boolean;
  onChange: (choice: PowerChoice) => void;
  onBlur?: () => void;
  error?: string;
};

// The one control the shared components do not have: a select. It is a
// real <select>, so the keyboard (arrows, type-ahead) and the phone's
// own picker work without any code of ours. Its box matches the text
// fields (docs/DESIGN.md "Components"), and the arrow is drawn here
// because the select's own arrow is hidden to keep the square look.
export function PowerSelect({
  connectedVa,
  subsidised,
  onChange,
  onBlur,
  error,
}: PowerSelectProps) {
  const t = useTranslations("plan.electricity.power");
  const locale = useLocale();
  const id = useId();
  const helpId = `${id}-help`;
  const errorId = `${id}-error`;
  const selected = findPowerChoice(connectedVa, subsidised);

  // "450 VA, bersubsidi". 900 VA exists in both forms, so its plain form
  // says "tidak bersubsidi" to tell the two apart.
  function optionLabel(choice: PowerChoice): string {
    const va = formatDecimal(choice.connectedVa, locale);
    if (choice.subsidised) return t("optionSubsidised", { va });
    if (choice.connectedVa === 900) return t("optionUnsubsidised", { va });
    return t("option", { va });
  }

  return (
    <div>
      <label htmlFor={id} className="block text-[19px] font-extrabold tracking-[-0.01em]">
        {t("label")}
      </label>
      <p id={helpId} className="pt-0.5 text-sm text-soft">
        {t("help")}
      </p>

      <div className="relative mt-3 focus-within:outline-[3px] focus-within:outline-offset-[3px] focus-within:outline-fg">
        <select
          id={id}
          value={selected?.id ?? ""}
          onChange={(event) => {
            const choice = findPowerChoiceById(event.target.value);
            if (choice) onChange(choice);
          }}
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          className="min-h-field w-full cursor-pointer appearance-none rounded-none border-heavy border-night bg-paper py-0 pl-4 pr-12 text-[17px] font-semibold text-night focus-visible:outline-none"
        >
          <option value="" disabled>
            {t("placeholder")}
          </option>
          {POWER_CHOICES.map((choice) => (
            <option key={choice.id} value={choice.id}>
              {optionLabel(choice)}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 10"
          width={16}
          height={10}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="square"
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-night"
        >
          <path d="M2 2l6 6 6-6" />
        </svg>
      </div>

      {error && <FieldError id={errorId}>{error}</FieldError>}
    </div>
  );
}
