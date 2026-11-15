// How a value is written on this screen, in the language's own separators
// (docs/DESIGN.md "Number formats"). The digits come from Intl.

import { formatDecimal } from "../../lib/format";
import type { UnitKind } from "./units";

// 0.005 is a real assumption (yearly panel wear), so decimals are kept well past two places.
const MAX_DECIMALS = 6;

function rupiahFormatter(locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "IDR",
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 2,
  });
}

/** "Rp" as the language writes it, read from Intl. */
export function rupiahSign(locale: string): string {
  const parts = rupiahFormatter(locale).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? "Rp";
}

/** The figure shown in the row: "Rp16.000.000", "0,9". Tariffs keep their decimals: "Rp1.444,7". */
export function showValue(value: number, unit: UnitKind | null, locale: string): string {
  if (unit?.kind === "money") return rupiahFormatter(locale).format(value).replace(/\s/g, "");
  return formatDecimal(value, locale, MAX_DECIMALS);
}

/** The text put into the input: the number alone, because the "Rp" is drawn beside the box. */
export function showEditable(value: number, locale: string): string {
  return formatDecimal(value, locale, MAX_DECIMALS);
}

/** An ISO date ("2026-11-15") written out in the language: "15 November 2026". */
export function showDate(isoDate: string, locale: string): string {
  // Parsed as UTC and shown as UTC so no time zone can move it to the day before.
  return new Intl.DateTimeFormat(locale, { dateStyle: "long", timeZone: "UTC" }).format(
    new Date(`${isoDate}T00:00:00Z`),
  );
}
