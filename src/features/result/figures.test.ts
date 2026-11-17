import { describe, expect, it } from "vitest";
import {
  co2TonnesText,
  dayCaptionFigures,
  costRangeFigure,
  kwhPerDayText,
  kwpText,
  paybackFigure,
  percentFigure,
  roundedMoneyFigure,
} from "./figures";

describe("result figures", () => {
  it("writes the cost range in whole millions", () => {
    expect(costRangeFigure({ low: 18_150_000, typical: 26_400_000, high: 33_000_000 }, "id").text).toBe("Rp18–33 juta");
    expect(costRangeFigure({ low: 18_150_000, typical: 26_400_000, high: 33_000_000 }, "en").text).toBe("Rp18–33 million");
  });

  it("writes payback as a range, an open end, or not at all", () => {
    expect(paybackFigure({ low: 9, typical: 15, high: 20 }, "id")).toEqual({
      kind: "range",
      value: { figure: "9–20", unit: "tahun", text: "9–20 tahun" },
    });
    expect(paybackFigure({ low: 13, typical: 20, high: null }, "en")).toEqual({
      kind: "atLeast",
      value: { figure: "13", unit: "years", text: "13 years" },
    });
    expect(paybackFigure({ low: null, typical: null, high: null }, "id")).toEqual({ kind: "never" });
    // Judged at the typical cost: the low-cost year alone is no headline.
    expect(paybackFigure({ low: 22, typical: null, high: null }, "id")).toEqual({ kind: "never" });
  });

  it("keeps one decimal between one and ten million, and none elsewhere", () => {
    expect(roundedMoneyFigure(6_480_000, "id").text).toBe("Rp6,5 juta");
    expect(roundedMoneyFigure(22_594_118, "id").text).toBe("Rp23 juta");
    expect(roundedMoneyFigure(167_099, "id").text).toBe("Rp167 ribu");
    expect(roundedMoneyFigure(167_099, "en").text).toBe("Rp167 thousand");
    expect(roundedMoneyFigure(-10_259_419, "id").text).toBe("-Rp10 juta");
  });

  it("writes a share as a whole percent with the sign apart", () => {
    expect(percentFigure(0.749, "id")).toEqual({ figure: "75", unit: "%", text: "75%" });
    expect(percentFigure(0.948, "en").figure).toBe("95");
  });

  it("writes CO₂ in tonnes with one fixed decimal", () => {
    expect(co2TonnesText(1_147, "id")).toBe("1,1");
    expect(co2TonnesText(2_000, "id")).toBe("2,0");
    expect(co2TonnesText(2_000, "en")).toBe("2.0");
  });

  it("writes size and daily energy with the locale's separator", () => {
    expect(kwpText(1.65, "id")).toBe("1,65");
    expect(kwpText(1.1, "en")).toBe("1.1");
    expect(kwhPerDayText(1_460, "id")).toBe("4");
    expect(kwhPerDayText(1_533, "id")).toBe("4,2");
  });

  it("makes the day caption add up: the grid figure is the difference of the two shown", () => {
    // 4.04 and 1.74 kWh a day round to 4.0 and 1.7; on their own the rest, 2.30, would show 2.3
    // but 4.06 - 1.74 = 2.32 shows 2.3 while 4.1 - 1.7 = 2.4. The shown figures must agree.
    const perYear = (kwhPerDay: number) => kwhPerDay * 365;
    const figures = dayCaptionFigures(perYear(4.06), perYear(1.74), "en");
    expect(figures).toEqual({ generated: "4.1", used: "1.7", exported: "2.4" });
    expect(dayCaptionFigures(perYear(4.06), perYear(1.74), "id").exported).toBe("2,4");
  });
});
