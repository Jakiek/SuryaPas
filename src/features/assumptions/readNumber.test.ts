import { describe, expect, it } from "vitest";
import { readNumber } from "./readNumber";

describe("readNumber", () => {
  it("reads grouped thousands in the language's own style", () => {
    expect(readNumber("16.000.000", "id")).toBe(16_000_000);
    expect(readNumber("16,000,000", "en")).toBe(16_000_000);
  });

  it("reads plain digits", () => {
    expect(readNumber("16000000", "id")).toBe(16_000_000);
    expect(readNumber("12", "en")).toBe(12);
  });

  it("reads a decimal in either style", () => {
    expect(readNumber("0,05", "id")).toBe(0.05);
    expect(readNumber("0.05", "en")).toBe(0.05);
  });

  it("does not mistake a typed decimal for thousands", () => {
    // "0.005" is not grouped in threes (it starts with 0), so it is a decimal in Indonesian too.
    expect(readNumber("0.005", "id")).toBe(0.005);
    expect(readNumber("0,005", "en")).toBe(0.005);
  });

  it("reads thousands together with a decimal part", () => {
    expect(readNumber("1.444,7", "id")).toBe(1444.7);
    expect(readNumber("1,444.7", "en")).toBe(1444.7);
  });

  it("refuses text that is not a number", () => {
    for (const text of ["", "abc", "1.2.3", "12,", "-5", "1e3", "1.234,5,6"]) {
      expect(readNumber(text, "en"), text).toBeNull();
    }
  });
});
