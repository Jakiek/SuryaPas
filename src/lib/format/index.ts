// Number formatting for both languages, following the "Number formats"
// table in docs/DESIGN.md:
//
//                     Indonesian       English
//   Money, exact      Rp12.500.000     Rp12,500,000
//   Money, rounded    Rp12,5 juta      Rp12.5 million
//   Money range       Rp18–25 juta     Rp18–25 million
//   Decimal           1,65 kWp         1.65 kWp
//   Range             6–9 tahun        6–9 years
//
// Every digit, separator and unit word comes from Intl.NumberFormat for
// the active locale. This file only chooses which of Intl's parts to keep
// and in what order; it never builds a number by hand.
//
// Why not Intl's currency style alone? It writes "Rp 12.500.000" with a
// space, and its compact form says "jt" where the design says "juta". So
// the "Rp" is taken from the currency formatter and the number from the
// plain or compact formatter.

/** A formatted value split so the unit can be set smaller than the figure. */
export type Formatted = {
  /** The number, with its currency symbol if it has one: "Rp12,5", "6–9". */
  figure: string;
  /** The word after the number: "juta", "tahun". Empty when there is none. */
  unit: string;
  /** Both together, for running text: "Rp12,5 juta". */
  text: string;
};

type Part = { type: string; value: string; source?: string };

const CURRENCY = "IDR";

/** Puts a figure and its unit into the Formatted shape. */
function toFormatted(figure: string, unit: string): Formatted {
  return { figure, unit, text: unit ? `${figure} ${unit}` : figure };
}

/** "Rp" in both languages, read from Intl rather than typed here. */
function currencySymbol(locale: string): string {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: CURRENCY,
    currencyDisplay: "narrowSymbol",
  }).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? CURRENCY;
}

/** Intl sometimes uses a non-breaking space; the design uses a plain one. */
function plainSpaces(text: string): string {
  return text.replace(/\s/g, " ");
}

/**
 * Splits Intl's parts into the figure and the trailing unit word.
 * The unit is the last part when that part is a compact word ("juta") or
 * a unit ("tahun"); the space before it is dropped.
 */
function splitUnit(parts: Part[]): Formatted {
  const last = parts[parts.length - 1];
  const hasUnit = last && (last.type === "compact" || last.type === "unit");
  if (!hasUnit) {
    return toFormatted(plainSpaces(joinParts(parts)), "");
  }
  const figureParts = parts.slice(0, -1);
  return toFormatted(plainSpaces(joinParts(figureParts)).trimEnd(), last.value);
}

function joinParts(parts: Part[]): string {
  return parts.map((part) => part.value).join("");
}

/**
 * Returns the parts with the currency symbol placed before the number.
 * In a range, `side` says which number: "startRange" or "endRange".
 * A minus sign stays in front: "-Rp6,7 juta".
 */
function withSymbol(parts: Part[], symbol: string, side?: string): Part[] {
  const index = parts.findIndex(
    (part) => part.type === "integer" && (!side || part.source === side),
  );
  if (index === -1) return parts;
  const symbolPart: Part = { type: "currency", value: symbol, source: side };
  return [...parts.slice(0, index), symbolPart, ...parts.slice(index)];
}

/** Intl marks a range whose two ends round to the same number with "~". */
function isCollapsedRange(parts: Part[]): boolean {
  return parts.some((part) => part.type === "approximatelySign");
}

/**
 * Money to the last rupiah: Rp12.500.000 (id), Rp12,500,000 (en).
 */
export function formatMoneyExact(amount: number, locale: string): string {
  const parts = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).formatToParts(amount);
  return joinParts(withSymbol(parts, currencySymbol(locale)));
}

/**
 * Money in words of scale: Rp12,5 juta (id), Rp12.5 million (en).
 * Intl picks the word: ribu, juta, miliar / thousand, million, billion.
 *
 * `maxDecimals` is how many decimals to keep at most. The design's example
 * keeps one (12,5), so one is the default.
 */
export function formatMoneyRounded(
  amount: number,
  locale: string,
  maxDecimals = 1,
): Formatted {
  const parts = new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "long",
    maximumFractionDigits: maxDecimals,
  }).formatToParts(amount);
  return splitUnit(withSymbol(parts, currencySymbol(locale)));
}

/**
 * A low-to-high money range: Rp18–25 juta (id), Rp18–25 million (en).
 *
 * - Both ends in the same scale share one symbol and one unit word.
 * - Ends in different scales are written out: "Rp900 ribu – Rp1 juta".
 * - Ends that round to the same number become one value: "Rp18 juta".
 *
 * The design's example shows whole numbers, so `maxDecimals` defaults to 0.
 */
export function formatMoneyRange(
  low: number,
  high: number,
  locale: string,
  maxDecimals = 0,
): Formatted {
  const parts: Part[] = new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "long",
    maximumFractionDigits: maxDecimals,
  }).formatRangeToParts(low, high);

  if (isCollapsedRange(parts)) {
    return formatMoneyRounded(low, locale, maxDecimals);
  }

  const symbol = currencySymbol(locale);
  let withSymbols = withSymbol(parts, symbol, "startRange");
  // When the low end carries its own scale word, Intl has written the two
  // ends out in full, and the high end needs its own "Rp" as well.
  const lowHasOwnUnit = parts.some(
    (part) => part.type === "compact" && part.source === "startRange",
  );
  if (lowHasOwnUnit) {
    withSymbols = withSymbol(withSymbols, symbol, "endRange");
    return toFormatted(plainSpaces(joinParts(withSymbols)), "");
  }
  return splitUnit(withSymbols);
}

/**
 * A plain number with the locale's separators: 1,65 (id), 1.65 (en).
 * The caller adds the unit symbol, which is the same in both languages
 * (kWp, kWh, m²), through its message: "{size} kWp".
 *
 * `minDecimals` keeps trailing zeros where a figure should always show the
 * same number of decimals: the CO₂ figure is "2,0" (id) and "2.0" (en),
 * never "2". It defaults to 0, so trailing zeros are dropped.
 */
export function formatDecimal(
  value: number,
  locale: string,
  maxDecimals = 2,
  minDecimals = 0,
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: Math.max(maxDecimals, minDecimals),
  }).format(value);
}

/**
 * A range of years: 6–9 tahun (id), 6–9 years (en).
 * Equal ends become one value ("7 tahun"), and English uses the singular
 * for exactly one ("1 year").
 */
export function formatYearsRange(
  low: number,
  high: number,
  locale: string,
): Formatted {
  const formatter = new Intl.NumberFormat(locale, {
    style: "unit",
    unit: "year",
    unitDisplay: "long",
    maximumFractionDigits: 0,
  });
  const rangeParts: Part[] = formatter.formatRangeToParts(low, high);
  const parts = isCollapsedRange(rangeParts)
    ? formatter.formatToParts(low)
    : rangeParts;
  return splitUnit(parts);
}
