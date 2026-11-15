"use client";

import { useLocale } from "next-intl";
import { NumberField } from "@/components";
import { parseRupiah, showRupiah } from "./rupiah";

type RupiahFieldProps = {
  label: string;
  help?: string;
  error?: string;
  value: number | null;
  onChange: (amount: number | null) => void;
  onBlur?: () => void;
  name?: string;
};

// A rupiah amount. The user types with or without thousands separators;
// the field reads the digits and writes them back grouped for the
// language ("12.500.000" or "12,500,000"), so what is shown is always
// what will be sent.
export function RupiahField({ value, onChange, ...rest }: RupiahFieldProps) {
  const locale = useLocale();

  return (
    <NumberField
      {...rest}
      prefix="Rp"
      value={showRupiah(value, locale)}
      onChange={(event) => onChange(parseRupiah(event.target.value))}
      placeholder={showRupiah(650000, locale)}
      autoComplete="off"
    />
  );
}
