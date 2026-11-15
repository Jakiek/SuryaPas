// Turning an entry's unit (a short English string in the assumption set,
// such as "Rp/kWp", "share", "kWp") into what the screen shows.
//
//   money   "Rp" or "Rp/<unit>": the figure carries the rupiah sign and the
//           "per <unit>" is a message, so it can be translated.
//   word    an English word ("share", "hours"): replaced by a message.
//   symbol  a symbol that reads the same in both languages ("kWp", "m²").
//
// A unit that is none of these returns null, and a test fails, so a new
// unit in the assumption set cannot reach the screen in English by accident.

const MONEY = "Rp";

export const WORD_UNITS = {
  hours: "hours",
  year: "year",
  years: "years",
  share: "share",
  "share/year": "shareYear",
  multiplier: "multiplier",
} as const;

export type WordUnitMessage = (typeof WORD_UNITS)[keyof typeof WORD_UNITS];

export const SYMBOL_UNITS = ["Wp", "m²", "kWp", "kg CO₂/kWh"];

export type UnitKind =
  | { kind: "money"; per: string | null }
  | { kind: "word"; message: WordUnitMessage }
  | { kind: "symbol"; symbol: string };

export function classifyUnit(unit: string): UnitKind | null {
  if (unit === MONEY) return { kind: "money", per: null };
  if (unit.startsWith(`${MONEY}/`)) return { kind: "money", per: unit.slice(MONEY.length + 1) };
  if (unit in WORD_UNITS) return { kind: "word", message: WORD_UNITS[unit as keyof typeof WORD_UNITS] };
  if (SYMBOL_UNITS.includes(unit)) return { kind: "symbol", symbol: unit };
  return null;
}

/** The translating function of next-intl, reduced to what this file calls. */
type Translate = (key: string, values?: Record<string, string>) => string;

/** The words after a figure: "per kWp", "share", "kWp". Empty for plain rupiah. */
export function unitText(unit: UnitKind, t: Translate): string {
  switch (unit.kind) {
    case "money":
      return unit.per === null ? "" : t("units.per", { unit: unit.per });
    case "word":
      return t(`units.${unit.message}`);
    case "symbol":
      return unit.symbol;
  }
}
