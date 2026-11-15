// Typing rupiah. A rupiah amount is whole, so the field accepts exactly:
//   - digits alone:                      12500000
//   - digits grouped in threes by ".":   12.500.000   (Indonesian)
//   - digits grouped in threes by ",":   12,500,000   (English)
// one kind of separator per amount. Anything else ("12,5", "650.000,50",
// "12.50.000") is not a whole amount and is refused, not guessed at: a
// guessed reading would turn Rp12,5 into Rp125.

/** What a typed text means. */
export type RupiahReading =
  | { kind: "empty" }
  | { kind: "amount"; value: number }
  | { kind: "notWhole" };

const PLAIN_DIGITS = /^\d+$/;
const GROUPED_BY_DOT = /^\d{1,3}(\.\d{3})+$/;
const GROUPED_BY_COMMA = /^\d{1,3}(,\d{3})+$/;

export function readRupiah(typed: string): RupiahReading {
  // "Rp" and spaces are decoration, not part of the amount.
  const text = typed.replace(/rp/gi, "").replace(/\s/g, "");
  if (text === "") return { kind: "empty" };

  const isWhole =
    PLAIN_DIGITS.test(text) || GROUPED_BY_DOT.test(text) || GROUPED_BY_COMMA.test(text);
  if (!isWhole) return { kind: "notWhole" };

  return { kind: "amount", value: Number(text.replace(/[.,]/g, "")) };
}

/** The amount as shown in the field: grouped by the language's separator. */
export function showRupiah(amount: number | null, locale: string): string {
  if (amount === null) return "";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(amount);
}
