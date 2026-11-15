// Reading a number typed in either language's style.
//
//   Indonesian: 16.000.000   0,05      English: 16,000,000   0.05
//
// A "." or "," is a thousands separator only when it is the language's own
// separator AND the digits really are grouped in threes from a first digit
// that is not zero ("16.000.000", not "0.005"). In every other case it is a
// decimal mark, so "0.05" typed in Indonesian still means five hundredths.
// Anything else ("1.2.3", "12,", letters) is unreadable and returns null.

/** The thousands separator of a language, read from Intl. */
function groupSeparatorOf(locale: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(1_000_000);
  return parts.find((part) => part.type === "group")?.value ?? ",";
}

/** True for "16.000.000" (mark ".") but not for "0.005" or "1.50". */
function isGroupedInThrees(text: string, mark: string): boolean {
  const escaped = mark === "." ? "\\." : mark;
  return new RegExp(`^[1-9]\\d{0,2}(${escaped}\\d{3})+$`).test(text);
}

/** Digits with one decimal mark: "0.05" or "0,05" becomes 0.05; null when there is not exactly one mark. */
function readWithOneDecimalMark(text: string, mark: string): number | null {
  const parts = text.split(mark);
  const [whole, fraction] = parts;
  if (parts.length !== 2 || fraction === "") return null;
  return Number(`${whole}.${fraction}`);
}

/** Both marks present: the last one is the decimal mark and the other must group the whole part. */
function readWithBothMarks(text: string): number | null {
  const decimalMark = text.lastIndexOf(".") > text.lastIndexOf(",") ? "." : ",";
  const groupMark = decimalMark === "." ? "," : ".";
  const parts = text.split(decimalMark);
  const [whole, fraction] = parts;
  if (parts.length !== 2 || fraction === "" || fraction.includes(groupMark)) return null;
  if (!isGroupedInThrees(whole, groupMark)) return null;
  return Number(`${whole.replaceAll(groupMark, "")}.${fraction}`);
}

/** Returns the number the text means, or null when the text is empty or not a number. */
export function readNumber(typed: string, locale: string): number | null {
  const text = typed.replace(/\s/g, "");
  if (!/^\d[\d.,]*$/.test(text)) return null;

  const hasDot = text.includes(".");
  const hasComma = text.includes(",");
  if (!hasDot && !hasComma) return Number(text);
  if (hasDot && hasComma) return readWithBothMarks(text);

  const mark = hasDot ? "." : ",";
  if (mark === groupSeparatorOf(locale) && isGroupedInThrees(text, mark)) {
    return Number(text.replaceAll(mark, ""));
  }
  return readWithOneDecimalMark(text, mark);
}
