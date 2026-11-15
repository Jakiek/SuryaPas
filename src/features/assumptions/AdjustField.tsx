"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { NumberField } from "@/components";
import type { AssumptionEntry } from "../../engine/assumptions";
import { checkOverride, limitsOf, type OverrideCheck } from "./overrideRules";
import { rupiahSign, showEditable, showValue } from "./showValue";
import { classifyUnit, unitText } from "./units";

type AdjustFieldProps = {
  name: string;
  entry: AssumptionEntry;
  /** The value now in force: the user's change if there is one, else the set's own. */
  currentValue: number;
  /** Called with a good value, even when it equals the set's own (the screen then drops the override). */
  onValidValue: (value: number) => void;
  /** Called on every keystroke with whether the text is acceptable, so the screen can hold back "back to result". */
  onProblemChange: (hasProblem: boolean) => void;
};

// The box where one adjustable entry is edited in place. The text stays as
// typed while the user types; a good value is passed up at once, and the
// message about a bad one waits until the user leaves the box, as in the
// plan flow's fields.
export function AdjustField({ name, entry, currentValue, onValidValue, onProblemChange }: AdjustFieldProps) {
  const locale = useLocale();
  const t = useTranslations("assumptions");
  const unit = classifyUnit(entry.unit);
  const unitWords = unit ? unitText(unit, t) : entry.unit;

  const [text, setText] = useState(() => showEditable(currentValue, locale));
  const [left, setLeft] = useState(false);

  const check = checkOverride(text, entry, locale);
  const message = left ? problemMessage(check) : undefined;

  /** The allowed range in words, naming both ends and the unit: "from Rp5.000.000 to Rp40.000.000 per kWp". */
  function rangeText(): string {
    const limits = limitsOf(entry);
    const withUnit = (figure: string) => [figure, unitWords].filter(Boolean).join(" ");
    const min = showValue(limits.min, unit, locale);
    if (limits.max === undefined) return t("edit.rangeAtLeast", { min: withUnit(min) });
    return t("edit.rangeBetween", { min, max: withUnit(showValue(limits.max, unit, locale)) });
  }

  function problemMessage(result: OverrideCheck): string | undefined {
    if (result.kind === "notANumber") return t("errors.notANumber");
    if (result.kind === "outOfRange") return t("errors.outOfRange", { range: rangeText() });
    return undefined;
  }

  function handleChange(typed: string) {
    setText(typed);
    const result = checkOverride(typed, entry, locale);
    onProblemChange(result.kind === "notANumber" || result.kind === "outOfRange");
    if (result.kind === "ok") onValidValue(result.value);
  }

  function handleBlur() {
    setLeft(true);
    // A cleared box goes back to the value in force rather than staying empty.
    if (check.kind === "empty") setText(showEditable(currentValue, locale));
    if (check.kind === "ok") setText(showEditable(check.value, locale));
  }

  return (
    <NumberField
      label={t("edit.label", { name })}
      help={t("edit.help", { range: rangeText() })}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      prefix={unit?.kind === "money" ? rupiahSign(locale) : undefined}
      suffix={unitWords || undefined}
      error={message}
      decimal
      autoComplete="off"
      className="mt-4"
    />
  );
}
