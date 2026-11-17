"use client";

import { useLocale, useTranslations } from "next-intl";
import { ComparisonLedger, Section } from "@/components";
import { costRangeFigure, paybackFigure, roundedMoneyFigure, type PaybackFigure } from "./figures";
import type { CandidateView, OptionView } from "./view";

// SPEC 2.3 item 6: the same headline numbers side by side, without and with a
// battery. Savings only; backup in a blackout is named and given no value.
// Every figure is the engine's own, including the battery's cost and its
// replacement (SPEC 3.2 step 7); nothing is rebuilt here.
export function BatteryComparison({ shown, horizon }: { shown: CandidateView; horizon: number }) {
  const t = useTranslations("result.battery");
  const tVerdict = useTranslations("result.verdict");
  const locale = useLocale();
  const without = shown.withoutBattery;
  const withBattery = shown.withBattery;

  // The heading states the finding: which of the two net savings is larger.
  // When both lose money, a battery that loses less is not "adding savings".
  const heading =
    withBattery === null
      ? t("headingNone")
      : withBattery.netSavingsRp > without.netSavingsRp
        ? t(withBattery.netSavingsRp > 0 ? "headingWorth" : "headingLosesLess")
        : t("headingNotWorth");

  // The monthly row says "saved" only while every column saves. If a column's
  // bill would go up, the row speaks of the bill instead, in words for each
  // column, never a negative saving (SPEC 2.3 "Honest verdicts"). The same
  // goes for the net row when a column loses money over the horizon.
  const options = withBattery === null ? [without] : [without, withBattery];
  const anyBillGoesUp = options.some((option) => option.monthlySavingsRp < 0);
  const anyLoss = options.some((option) => option.netSavingsRp < 0);

  const monthlyText = (option: OptionView) => {
    const amount = roundedMoneyFigure(Math.abs(option.monthlySavingsRp), locale).text;
    if (!anyBillGoesUp) return amount;
    return t(option.monthlySavingsRp < 0 ? "billHigher" : "billLower", { amount });
  };
  const netText = (option: OptionView) => {
    const amount = roundedMoneyFigure(Math.abs(option.netSavingsRp), locale).text;
    if (!anyLoss) return amount;
    return t(option.netSavingsRp < 0 ? "netLossAmount" : "netGainAmount", { amount });
  };

  const column = (option: OptionView) => [
    costRangeFigure(option.upfrontCostRp, locale).text,
    monthlyText(option),
    paybackText(paybackFigure(option.paybackYears, locale), tVerdict),
    netText(option),
  ];

  return (
    <Section heading={heading}>
      <p className="mt-2.5 max-w-[32em] text-[17px] font-medium">{t("note")}</p>
      {withBattery === null ? (
        <p className="mt-4 max-w-[32em]">{t("none")}</p>
      ) : (
        <ComparisonTable
          caption={t("caption")}
          columns={[t("without"), t("with", { size: withBattery.batteryKwh })]}
          labels={[
            t("cost"),
            t(anyBillGoesUp ? "monthlyBill" : "monthly"),
            t("payback"),
            t(anyLoss ? "netResult" : "net", { years: horizon }),
          ]}
          values={[column(without), column(withBattery)]}
        />
      )}
    </Section>
  );
}

type ComparisonTableProps = {
  caption: string;
  columns: string[];
  labels: string[];
  /** One list per column, one entry per label. */
  values: string[][];
};

/** Turns columns of values into the rows ComparisonLedger draws. */
function ComparisonTable({ caption, columns, labels, values }: ComparisonTableProps) {
  const rows = labels.map((label, row) => ({
    label,
    values: values.map((columnValues) => columnValues[row]),
  }));
  return <ComparisonLedger className="mt-[18px]" caption={caption} columns={columns} rows={rows} />;
}

/** Payback in running text: "9–20 tahun", "13+ tahun", or the words for "does not pay back". */
function paybackText(figure: PaybackFigure, t: (key: "paybackNever" | "paybackAtLeast", values?: { years: string }) => string): string {
  if (figure.kind === "never") return t("paybackNever");
  if (figure.kind === "atLeast") return `${t("paybackAtLeast", { years: figure.value.figure })} ${figure.value.unit}`;
  return figure.value.text;
}
