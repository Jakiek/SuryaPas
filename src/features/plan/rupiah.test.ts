import { describe, expect, it } from "vitest";
import { parseRupiah, showRupiah } from "./rupiah";

describe("parseRupiah", () => {
  it("reads the same amount with or without thousands separators", () => {
    expect(parseRupiah("12500000")).toBe(12500000);
    expect(parseRupiah("12.500.000")).toBe(12500000);
    expect(parseRupiah("12,500,000")).toBe(12500000);
    expect(parseRupiah("Rp 12.500.000")).toBe(12500000);
  });

  it("returns null for an empty field", () => {
    expect(parseRupiah("")).toBeNull();
    expect(parseRupiah("  ")).toBeNull();
    expect(parseRupiah("abc")).toBeNull();
  });

  it("reads backspace on a formatted amount as the digits left", () => {
    // "12.500" with the last zero deleted is "12.50", which means 1,250.
    expect(parseRupiah("12.50")).toBe(1250);
  });
});

describe("showRupiah", () => {
  it("groups with the language's separator", () => {
    expect(showRupiah(12500000, "id")).toBe("12.500.000");
    expect(showRupiah(12500000, "en")).toBe("12,500,000");
  });

  it("shows nothing for an empty field", () => {
    expect(showRupiah(null, "id")).toBe("");
  });

  it("round-trips: what is shown is read back as the same amount", () => {
    for (const locale of ["id", "en"]) {
      expect(parseRupiah(showRupiah(650000, locale))).toBe(650000);
    }
  });
});
