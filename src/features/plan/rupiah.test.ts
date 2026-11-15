import { describe, expect, it } from "vitest";
import { readRupiah, showRupiah } from "./rupiah";

const amount = (value: number) => ({ kind: "amount", value });

describe("readRupiah", () => {
  it("reads the three accepted forms as the same amount", () => {
    expect(readRupiah("12500000")).toEqual(amount(12500000));
    expect(readRupiah("12.500.000")).toEqual(amount(12500000));
    expect(readRupiah("12,500,000")).toEqual(amount(12500000));
    expect(readRupiah("Rp 12.500.000")).toEqual(amount(12500000));
  });

  it("refuses a decimal instead of guessing: 12,5 is not Rp125", () => {
    expect(readRupiah("12,5")).toEqual({ kind: "notWhole" });
  });

  it("refuses cents: 650.000,50 is not Rp65.000.050", () => {
    expect(readRupiah("650.000,50")).toEqual({ kind: "notWhole" });
  });

  it("refuses wrong grouping and mixed separators", () => {
    for (const bad of ["12.50.000", "1.2500", "12.500,000", "12abc", "-5"]) {
      expect(readRupiah(bad), bad).toEqual({ kind: "notWhole" });
    }
  });

  it("reads an empty field as empty and zero as zero", () => {
    expect(readRupiah("")).toEqual({ kind: "empty" });
    expect(readRupiah("  ")).toEqual({ kind: "empty" });
    expect(readRupiah("0")).toEqual(amount(0));
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
      expect(readRupiah(showRupiah(650000, locale))).toEqual(amount(650000));
    }
  });
});
