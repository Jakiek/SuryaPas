// Typing rupiah. Indonesians write 12.500.000 and Americans 12,500,000;
// a phone keypad gives either, or neither (12500000). All three must work
// (T10 done-check), so the field reads only the digits.

/**
 * Reads the amount from what was typed: only the digits count, so
 * "12.500.000", "12,500,000" and "12500000" all give 12500000.
 *
 * Why not treat "650.000,50" as having cents? The field re-formats as the
 * user types, so pressing backspace on "12.500" produces "12.50", and that
 * must read as 1250, not as 12 with 50 cents. Rupiah has no cents anyway.
 *
 * Returns null for an empty field.
 */
export function parseRupiah(typed: string): number | null {
  const digits = typed.replace(/\D/g, "");
  if (digits === "") return null;
  return Number(digits);
}

/** The amount as shown in the field: grouped by the language's separator. */
export function showRupiah(amount: number | null, locale: string): string {
  if (amount === null) return "";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
}
