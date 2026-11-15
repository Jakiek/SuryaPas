"use client";

import { useLocale, useTranslations } from "next-intl";
import { Caveat, Figure, Label } from "@/components";
import { formatDecimal, formatMoneyExact } from "@/lib/format";
import { areaText, costRangeFigure, kwpText, paybackFigure, type PaybackFigure } from "./figures";
import type { CandidateView, HomeSummary, Verdict } from "./view";

/** One line about the home: "2.200 VA pascabayar · tagihan Rp650.000 per bulan". Never the location. */
export function HomeLine({ home }: { home: HomeSummary }) {
  const t = useTranslations("result.home");
  const locale = useLocale();
  const months = home.monthlySpendRp;
  // The amount the user typed, or the plain average of the months they typed.
  const amount = formatMoneyExact(months.reduce((sum, value) => sum + value, 0) / months.length, locale);
  const averaged = months.length > 1;
  const spend =
    home.billing === "prepaid"
      ? t(averaged ? "topUpAverage" : "topUpOne", { amount })
      : t(averaged ? "spendAverage" : "spendOne", { amount });
  const power = [t("power", { power: formatDecimal(home.connectedVa, locale, 0) }), home.subsidised && t("subsidised"), t(home.billing)]
    .filter(Boolean)
    .join(" ");
  const parts = [home.place && t("example", { place: home.place }), power, spend].filter(Boolean);

  return <p className="mt-2.5 text-sm font-semibold text-soft">{parts.join(" · ")}</p>;
}

/**
 * The size of "3 PANEL" / "3 PANELS", which must stay on one line (T08 review).
 * Archivo is already at its narrowest width (62%), so the size is what gives:
 * the design's poster answer size, or the size at which the words just fill
 * their column, whichever is smaller. Measured in the browser, these capitals
 * take about 0.41 em per character ("2 PANELS" is 3.31 em, "12 PANELS"
 * 3.67 em); 0.42 leaves a little room. So the Indonesian keeps the mock's size
 * on a phone, and the English and two-digit counts shrink just enough.
 * `cqw` is a hundredth of the column's width (the parent is a size container).
 */
const EM_PER_CHARACTER = 0.42;

export function answerFontSize(answer: string): string {
  const widthInEm = answer.length * EM_PER_CHARACTER;
  return `min(var(--text-poster-answer), calc(100cqw / ${widthInEm.toFixed(2)}))`;
}

type HeadlineProps = {
  /** The size on show, eased while the picker changes it. */
  shown: CandidateView;
  /** The panel count on show (never eased: it is a whole number of panels). */
  panels: number;
  isRecommended: boolean;
};

// SPEC 2.3 item 1: recommended size (kWp and panels), upfront cost as a range,
// payback as a range in years.
export function Headline({ shown, panels, isRecommended }: HeadlineProps) {
  const t = useTranslations("result.verdict");
  const locale = useLocale();
  const option = shown.withoutBattery;
  const answer = t("answer", { count: panels });

  return (
    <>
      <div className="mt-[18px]">
        <h1 className="type-poster text-sun @container">
          <span className="mb-2.5 block font-sans text-[15px] font-extrabold leading-[1.4] tracking-[0.14em] text-paper [word-spacing:normal]">
            {t(isRecommended ? "ledeRecommended" : "ledeChosen")}
          </span>
          {/* Always one line, in both languages (see answerFontSize). */}
          <span className="block whitespace-nowrap" style={{ fontSize: answerFontSize(answer) }}>
            {answer}
          </span>
        </h1>
        <p className="mt-3 font-semibold">
          {t("sub", { size: kwpText(shown.kwp, locale), area: areaText(shown.panelAreaM2, locale) })}{" "}
          <span className="text-soft">{t("kwp")}</span>
        </p>
      </div>

      <div className="mt-[22px] grid grid-cols-2 border-t border-rule">
        <div className="pt-3.5">
          <Label as="p" className="mb-1.5 opacity-75">
            {t("cost")}
          </Label>
          <Figure size="fluid" {...asFigure(costRangeFigure(option.upfrontCostRp, locale))} />
        </div>
        <div className="border-l border-rule pl-4 pt-3.5">
          <Label as="p" className="mb-1.5 opacity-75">
            {t("payback")}
          </Label>
          <PaybackValue figure={paybackFigure(option.paybackYears, locale)} />
        </div>
      </div>
    </>
  );
}

function asFigure(formatted: { figure: string; unit: string }) {
  return { value: formatted.figure, unit: formatted.unit };
}

/** The payback figure, or words in its place when the system does not pay back (SPEC 2.3 "Honest verdicts"). */
function PaybackValue({ figure }: { figure: PaybackFigure }) {
  const t = useTranslations("result.verdict");
  if (figure.kind === "never") {
    // Words, which wrap, in place of a number that would not fit half the band.
    return <span className="type-figure block text-[22px] leading-[1.05]">{t("paybackNever")}</span>;
  }
  const value = figure.kind === "atLeast" ? t("paybackAtLeast", { years: figure.value.figure }) : figure.value.figure;
  return <Figure size="fluid" value={value} unit={figure.value.unit} />;
}

/** The honest verdicts for the size on show, each a caveat with a red bar. */
type WarningsProps = { verdicts: Verdict[]; horizon: number; recommended: number };

export function Warnings({ verdicts, horizon, recommended }: WarningsProps) {
  const t = useTranslations("result.warnings");
  if (verdicts.length === 0) return null;
  return (
    <div className="mt-6 grid gap-4">
      {verdicts.map((verdict) => (
        <Caveat key={verdict} title={t(`${verdict}.title`)}>
          <p className="text-[15px] text-soft">{t(`${verdict}.body`, { years: horizon, recommended })}</p>
        </Caveat>
      ))}
    </div>
  );
}
