"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { NumberField } from "@/components";
import type { AssumptionEntry, AssumptionKey } from "../../engine/assumptions";
import { checkOverride, costOrderConflict, limitsOf } from "./overrideRules";
import { rupiahSign, showEditable, showValue } from "./showValue";
import { classifyUnit, unitText } from "./units";

type AdjustFieldProps = {
  entryKey: AssumptionKey;
  name: string;
  entry: AssumptionEntry;
  /** The value now in force: the user's change if there is one, else the set's own. */
  currentValue: number;
  /** The value in force for any entry, to keep the three cost estimates in order. */
  valueInForce: (key: AssumptionKey) => number;
  /** The name shown for any entry, for the message that names a neighbour. */
  nameOf: (key: AssumptionKey) => string;
  /** Called with a good value, even when it equals the set's own (the screen then drops the override). */
  onValidValue: (value: number) => void;
  /** Called with whether the text is acceptable, so the screen can hold back "back to result". */
  onProblemChange: (hasProblem: boolean) => void;
};

/** What the typed text amounts to: a good value, a problem with its message, or nothing. */
type Verdict = { kind: "ok"; value: number } | { kind: "problem"; message: string } | { kind: "empty" };

// The box where one adjustable entry is edited in place. The text stays as
// typed while the user types; a good value is passed up at once, and the
// message about a bad one waits until the user leaves the box, as in the
// plan flow's fields.
export function AdjustField(props: AdjustFieldProps) {
  const { entryKey, name, entry, currentValue, valueInForce, nameOf, onValidValue, onProblemChange } = props;
  const locale = useLocale();
  const t = useTranslations("assumptions");
  const unit = classifyUnit(entry.unit);
  const unitWords = unit ? unitText(unit, t) : entry.unit;

  const [text, setText] = useState(() => showEditable(currentValue, unit, locale));
  const [left, setLeft] = useState(false);

  /** The allowed range in words, naming both ends and the unit: "from Rp5.000.000 to Rp40.000.000 per kWp". */
  function rangeText(): string {
    const limits = limitsOf(entry);
    const withUnit = (figure: string) => [figure, unitWords].filter(Boolean).join(" ");
    const min = showValue(limits.min, unit, locale);
    if (limits.max === undefined) return t("edit.rangeAtLeast", { min: withUnit(min) });
    return t("edit.rangeBetween", { min, max: withUnit(showValue(limits.max, unit, locale)) });
  }

  /** The message for a value that breaks the order of the cost estimates, naming the neighbour and its value. */
  function orderMessage(value: number): string | null {
    const conflict = costOrderConflict(entryKey, value, valueInForce);
    if (conflict === null) return null;
    const neighbourValue = [showValue(conflict.neighbourValue, unit, locale), unitWords].filter(Boolean).join(" ");
    const key = conflict.relation === "atMost" ? "errors.costAbove" : "errors.costBelow";
    return t(key, { name: nameOf(conflict.neighbour), value: neighbourValue });
  }

  function judge(typed: string): Verdict {
    const result = checkOverride(typed, entry, locale);
    if (result.kind === "empty") return { kind: "empty" };
    if (result.kind === "notANumber") return { kind: "problem", message: t("errors.notANumber") };
    if (result.kind === "outOfRange") return { kind: "problem", message: t("errors.outOfRange", { range: rangeText() }) };
    const orderProblem = orderMessage(result.value);
    if (orderProblem !== null) return { kind: "problem", message: orderProblem };
    return { kind: "ok", value: result.value };
  }

  const verdict = judge(text);
  const message = left && verdict.kind === "problem" ? verdict.message : undefined;

  function handleChange(typed: string) {
    setText(typed);
    const next = judge(typed);
    onProblemChange(next.kind === "problem");
    if (next.kind === "ok") onValidValue(next.value);
  }

  function handleBlur() {
    setLeft(true);
    // A cleared box goes back to the value in force rather than staying empty.
    if (verdict.kind === "empty") setText(showEditable(currentValue, unit, locale));
    if (verdict.kind === "ok") {
      setText(showEditable(verdict.value, unit, locale));
      // Re-sent in case a neighbouring estimate changed since the last keystroke.
      onValidValue(verdict.value);
      onProblemChange(false);
    }
  }

  // A share is typed as percent, so the sign sits beside the box like "Rp" does for money.
  const suffix = unit?.kind === "share" ? [showPercentSign(locale), unitWords].filter(Boolean).join(" ") : unitWords;

  return (
    <NumberField
      label={t("edit.label", { name })}
      help={t("edit.help", { range: rangeText() })}
      value={text}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={handleBlur}
      prefix={unit?.kind === "money" ? rupiahSign(locale) : undefined}
      suffix={suffix || undefined}
      error={message}
      decimal
      autoComplete="off"
      className="mt-4"
    />
  );
}

/** "%" as the language writes it, read from Intl. */
function showPercentSign(locale: string): string {
  const parts = new Intl.NumberFormat(locale, { style: "percent" }).formatToParts(1);
  return parts.find((part) => part.type === "percentSign")?.value ?? "%";
}
