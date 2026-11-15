"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { NumberField } from "@/components";
import { readRupiah, showRupiah } from "./rupiah";

type RupiahFieldProps = {
  label: string;
  help?: string;
  // The schema's message for this field, already gated by the parent to
  // appear only after the user has left the field.
  error?: string;
  value: number | null;
  onChange: (amount: number | null) => void;
  onBlur?: () => void;
  name?: string;
};

// A rupiah amount. The text stays exactly as typed while the user types
// (reformatting under their fingers would break "12.500" + backspace);
// when they leave the field, a valid amount is rewritten grouped for the
// language. Text that is not a whole amount ("12,5") reaches the draft as
// empty, so the step stays invalid, and the field says to type whole rupiah.
export function RupiahField({ value, onChange, onBlur, error, ...rest }: RupiahFieldProps) {
  const locale = useLocale();
  const t = useTranslations("plan");
  const [text, setText] = useState(() => showRupiah(value, locale));
  const [left, setLeft] = useState(false);

  const reading = readRupiah(text);
  const notWhole = left && reading.kind === "notWhole";

  return (
    <NumberField
      {...rest}
      prefix="Rp"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        const next = readRupiah(event.target.value);
        onChange(next.kind === "amount" ? next.value : null);
      }}
      onBlur={() => {
        setLeft(true);
        if (reading.kind === "amount") setText(showRupiah(reading.value, locale));
        onBlur?.();
      }}
      error={notWhole ? t("errors.billNotWhole") : error}
      placeholder={t("electricity.spend.placeholder", { amount: showRupiah(650000, locale) })}
      autoComplete="off"
    />
  );
}
