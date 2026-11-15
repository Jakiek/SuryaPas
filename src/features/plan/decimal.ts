// Reading a decimal number typed in either style: "48,5" (Indonesian) or
// "48.5" (English). Used by the placeholder steps for coordinates and area.

/** Returns the number, or null for an empty or unreadable field. */
export function parseDecimal(typed: string): number | null {
  const normalised = typed.trim().replace(",", ".");
  if (normalised === "") return null;
  const parsed = Number(normalised);
  return Number.isFinite(parsed) ? parsed : null;
}
