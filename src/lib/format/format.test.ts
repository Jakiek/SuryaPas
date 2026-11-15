import { describe, expect, it } from "vitest";
import {
  formatDecimal,
  formatMoneyExact,
  formatMoneyRange,
  formatMoneyRounded,
  formatYearsRange,
} from "./index";

// The first block is the "Number formats" table of docs/DESIGN.md, one
// test per row, with the table's own example values in both languages.
describe("the Number formats table of docs/DESIGN.md", () => {
  it("Money, exact", () => {
    expect(formatMoneyExact(12_500_000, "id")).toBe("Rp12.500.000");
    expect(formatMoneyExact(12_500_000, "en")).toBe("Rp12,500,000");
  });

  it("Money, rounded", () => {
    expect(formatMoneyRounded(12_500_000, "id").text).toBe("Rp12,5 juta");
    expect(formatMoneyRounded(12_500_000, "en").text).toBe("Rp12.5 million");
  });

  it("Money range", () => {
    expect(formatMoneyRange(18_000_000, 25_000_000, "id").text).toBe(
      "Rp18–25 juta",
    );
    expect(formatMoneyRange(18_000_000, 25_000_000, "en").text).toBe(
      "Rp18–25 million",
    );
  });

  it("Decimal", () => {
    expect(`${formatDecimal(1.65, "id")} kWp`).toBe("1,65 kWp");
    expect(`${formatDecimal(1.65, "en")} kWp`).toBe("1.65 kWp");
  });

  it("Range", () => {
    expect(formatYearsRange(6, 9, "id").text).toBe("6–9 tahun");
    expect(formatYearsRange(6, 9, "en").text).toBe("6–9 years");
  });
});

describe("formatMoneyExact", () => {
  it("rounds to whole rupiah", () => {
    expect(formatMoneyExact(1_444.7, "id")).toBe("Rp1.445");
  });

  it("keeps the minus sign in front of the symbol", () => {
    expect(formatMoneyExact(-650_000, "id")).toBe("-Rp650.000");
    expect(formatMoneyExact(-650_000, "en")).toBe("-Rp650,000");
  });

  it("formats zero", () => {
    expect(formatMoneyExact(0, "id")).toBe("Rp0");
  });
});

describe("formatMoneyRounded", () => {
  it("splits the figure from the unit so the unit can be set smaller", () => {
    expect(formatMoneyRounded(12_500_000, "id")).toEqual({
      figure: "Rp12,5",
      unit: "juta",
      text: "Rp12,5 juta",
    });
    expect(formatMoneyRounded(12_500_000, "en")).toEqual({
      figure: "Rp12.5",
      unit: "million",
      text: "Rp12.5 million",
    });
  });

  it("uses the scale word that fits the amount", () => {
    expect(formatMoneyRounded(280_000, "id").text).toBe("Rp280 ribu");
    expect(formatMoneyRounded(280_000, "en").text).toBe("Rp280 thousand");
    expect(formatMoneyRounded(1_250_000_000, "id", 2).text).toBe(
      "Rp1,25 miliar",
    );
    expect(formatMoneyRounded(1_250_000_000, "en", 2).text).toBe(
      "Rp1.25 billion",
    );
  });

  it("has no unit below one thousand", () => {
    expect(formatMoneyRounded(950, "id")).toEqual({
      figure: "Rp950",
      unit: "",
      text: "Rp950",
    });
  });

  it("drops a decimal that would be zero", () => {
    expect(formatMoneyRounded(49_000_000, "id").text).toBe("Rp49 juta");
  });

  it("keeps as many decimals as asked for", () => {
    expect(formatMoneyRounded(49_230_000, "id", 0).text).toBe("Rp49 juta");
    expect(formatMoneyRounded(49_230_000, "id", 1).text).toBe("Rp49,2 juta");
  });

  it("puts the minus sign in front of the symbol", () => {
    expect(formatMoneyRounded(-6_700_000, "id").text).toBe("-Rp6,7 juta");
    expect(formatMoneyRounded(-6_700_000, "en").text).toBe("-Rp6.7 million");
  });
});

describe("formatMoneyRange", () => {
  it("shares one symbol and one unit when both ends have the same scale", () => {
    expect(formatMoneyRange(18_200_000, 24_750_000, "id")).toEqual({
      figure: "Rp18–25",
      unit: "juta",
      text: "Rp18–25 juta",
    });
  });

  it("becomes a single value when both ends round to the same number", () => {
    expect(formatMoneyRange(18_200_000, 18_400_000, "id").text).toBe(
      "Rp18 juta",
    );
    expect(formatMoneyRange(18_200_000, 18_400_000, "en").text).toBe(
      "Rp18 million",
    );
  });

  it("writes both ends out when their scales differ", () => {
    expect(formatMoneyRange(900_000, 1_200_000, "id")).toEqual({
      figure: "Rp900 ribu – Rp1 juta",
      unit: "",
      text: "Rp900 ribu – Rp1 juta",
    });
    expect(formatMoneyRange(900_000, 1_200_000, "en").text).toBe(
      "Rp900 thousand – Rp1 million",
    );
  });

  it("keeps decimals when asked", () => {
    expect(formatMoneyRange(1_650_000, 2_480_000, "id", 1).text).toBe(
      "Rp1,7–2,5 juta",
    );
  });

  it("has no unit below one thousand", () => {
    expect(formatMoneyRange(500, 900, "id").text).toBe("Rp500–900");
  });
});

describe("formatDecimal", () => {
  it("keeps at most two decimals by default", () => {
    expect(formatDecimal(1.654, "id")).toBe("1,65");
    expect(formatDecimal(1.6, "id")).toBe("1,6");
    expect(formatDecimal(2, "id")).toBe("2");
  });

  it("groups thousands the way each language does", () => {
    expect(formatDecimal(12_345.678, "id")).toBe("12.345,68");
    expect(formatDecimal(12_345.678, "en")).toBe("12,345.68");
  });

  it("takes the number of decimals to keep", () => {
    expect(formatDecimal(6.37, "id", 1)).toBe("6,4");
    expect(formatDecimal(6.37, "en", 0)).toBe("6");
  });
});

describe("formatYearsRange", () => {
  it("splits the figure from the unit", () => {
    expect(formatYearsRange(6, 9, "id")).toEqual({
      figure: "6–9",
      unit: "tahun",
      text: "6–9 tahun",
    });
  });

  it("becomes a single value when both ends are equal", () => {
    expect(formatYearsRange(7, 7, "id").text).toBe("7 tahun");
    expect(formatYearsRange(7, 7, "en").text).toBe("7 years");
  });

  it("uses the English singular for exactly one year", () => {
    expect(formatYearsRange(1, 1, "en").text).toBe("1 year");
  });
});
