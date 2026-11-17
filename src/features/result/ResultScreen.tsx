"use client";

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Band, Figure, Inner, Ledger, PosterHeading, Section, SiteFooter, SiteHeader } from "@/components";
import { formatDecimal } from "@/lib/format";
import { BatteryComparison } from "./BatteryComparison";
import { dayChartMaxKw } from "./chartGeometry";
import { DayChart } from "./DayChart";
import { useEased } from "./ease";
import {
  co2TonnesText,
  dayCaptionFigures,
  percentFigure,
  roundedMoneyFigure,
  sayMoreKey,
  wastedPercentText,
} from "./figures";
import { Headline, HomeLine, Warnings } from "./Headline";
import type { LoadedResult } from "./loadResult";
import { NextSteps } from "./NextSteps";
import { judgePayback } from "./payback";
import { PanelPicker } from "./PanelPicker";
import { PaybackChart } from "./PaybackChart";
import { ResultActions } from "./ResultActions";
import { useFitsInWindow } from "./useFitsInWindow";
import { useIsOwner } from "./useIsOwner";
import { useUnsavedNotice } from "./UnsavedContext";
import {
  candidateFor,
  compareWithRecommended,
  horizonYears,
  lowCostOnlyYear,
  pickerSlots,
  recommendedLosesMoney,
  verdictsFor,
  withFinalPayback,
  type OptionView,
} from "./view";

// The id the skip link jumps to: the start of the verdict, past the header.
const CONTENT_ID = "result";

// The result page (SPEC 2.3), in its reading order. On phones it is one
// column; from 880 px the verdict and the picker are pinned on the left and
// the report scrolls on the right (docs/DESIGN.md "Layout").
//
// Exploration is local: the picker changes what is shown, never what is saved.
export function ResultScreen(result: LoadedResult) {
  const tCommon = useTranslations("common");
  const savedOwner = useIsOwner(result.inputsFingerprint, result.isExample);
  // Null for every saved result; the "not saved" note for one that was not.
  const unsavedNotice = useUnsavedNotice();
  // A result that was not saved was computed in this tab, so the viewer is its owner.
  const isOwner = unsavedNotice !== null || savedOwner;

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href={`#${CONTENT_ID}`}
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-2 focus-visible:top-2 focus-visible:z-10 focus-visible:bg-paper focus-visible:px-3 focus-visible:py-2 focus-visible:font-bold focus-visible:text-night"
      >
        {tCommon("skipToContent")}
      </a>
      {unsavedNotice}
      {result.view.recommendedPanels === null ? (
        <RoofTooSmall result={result} isOwner={isOwner} />
      ) : (
        <Report result={result} recommended={result.view.recommendedPanels} isOwner={isOwner} />
      )}
    </div>
  );
}

type ReportProps = { result: LoadedResult; recommended: number; isOwner: boolean };

function Report({ result, recommended, isOwner }: ReportProps) {
  const t = useTranslations("result");
  const locale = useLocale();
  const { view, home } = result;
  const [panels, setPanels] = useState(recommended);
  const [leftColumnRef, leftColumnFits] = useFitsInWindow<HTMLDivElement>();

  // The candidate on show, and the same eased over 200 ms after a change.
  const selected = useMemo(() => candidateFor(view, panels), [view, panels]);
  // Payback years are the exception: they are shown at their final values, never part-way.
  const shown = withFinalPayback(useEased(selected), selected);
  const horizon = horizonYears(view);
  const verdicts = verdictsFor(view, selected);
  const comparison = compareWithRecommended(view, panels);

  // The day chart's scale is fixed by the largest size the roof holds, so the
  // hump visibly grows past the home's line as panels are added.
  const largest = view.candidates[view.candidates.length - 1];
  const maxKw = useMemo(
    () => dayChartMaxKw(view.averageLoadByHourKwh, view.averageSolarByHourPerKwp, largest.kwp),
    [view, largest],
  );
  const solarKwh = view.averageSolarByHourPerKwp.map((perKwp) => perKwp * shown.kwp);
  const option = shown.withoutBattery;

  // When even the recommended size loses money, "the right fit" is the one that loses least, never the largest saving.
  const say =
    comparison === "recommended"
      ? t(recommendedLosesMoney(view) ? "picker.sayRecommendedLoses" : "picker.sayRecommended")
      : comparison === "fewer"
        ? t("picker.sayFewer")
        : t(sayMoreKey(selected.withoutBattery), { wasted: wastedPercentText(selected.withoutBattery, locale) });

  return (
    // The left column is pinned only while its measured height fits the window (it grows with
    // warnings); otherwise it scrolls with the page rather than hiding its lower part.
    <main className="flex-1 lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
      <div ref={leftColumnRef} className={`lg:bg-sun lg:min-h-dvh ${leftColumnFits ? "lg:sticky lg:top-0" : ""}`}>
        <Band tone="night" className="pb-[26px]">
          <Inner className="lg:max-w-none">
            <SiteHeader />
            <div id={CONTENT_ID} tabIndex={-1}>
              <HomeLine home={home} />
              {/* The warnings come before the figures they qualify (SPEC 2.3 "Honest verdicts"). */}
              <Warnings verdicts={verdicts} horizon={horizon} recommended={recommended} lowCostYear={lowCostOnlyYear(selected)} />
              <Headline shown={shown} panels={panels} isRecommended={comparison === "recommended"} />
            </div>
          </Inner>
        </Band>

        <Band tone="sun" as="section" aria-labelledby="picker-heading" className="pb-6 pt-[22px]">
          <Inner className="lg:max-w-none">
            <h2 id="picker-heading" className="text-[19px] font-extrabold tracking-[-0.01em]">
              {t("picker.heading")}
            </h2>
            <PanelPicker slots={pickerSlots(view)} selected={panels} recommended={recommended} onSelect={setPanels} />
            <p role="status" className="mt-5 min-h-[3.4em] text-lg font-bold leading-[1.35]">
              {say}
            </p>
          </Inner>
        </Band>
      </div>

      <div>
        <Inner className="pb-2.5 pt-[30px] lg:max-w-none lg:pt-11">
          <Section heading={t("day.heading")}>
            <DayChart
              loadKwh={view.averageLoadByHourKwh}
              solarKwh={solarKwh}
              maxKw={maxKw}
              caption={t("day.caption", dayCaptionFigures(option.generationKwh, option.selfConsumedKwh, locale))}
            />
            <SupportingNumbers option={option} horizon={horizon} />
          </Section>

          <Section heading={t("payback.heading")}>
            <PaybackChart option={option} caption={paybackCaption(t, option, horizon, locale)} />
          </Section>

          <BatteryComparison shown={shown} horizon={horizon} />

          <Section heading={t("next.heading")}>
            <NextSteps billing={home.billing} />
            <ResultActions id={result.id} isOwner={isOwner} isExample={result.isExample} />
          </Section>
        </Inner>
        <MethodFooter version={result.assumptionSetVersion} fallbackSun={result.view.flags.fallbackSunData} />
      </div>
    </main>
  );
}

/**
 * SPEC 2.3 item 4: monthly savings, share used on site, net savings over the
 * horizon, CO₂ avoided. A negative monthly saving is a bill that goes up, said
 * as that, with the amount; a negative net saving is a loss, said as a loss.
 * Neither is ever a negative figure under a "savings" label (SPEC 2.3 "Honest verdicts").
 */
function SupportingNumbers({ option, horizon }: { option: OptionView; horizon: number }) {
  const t = useTranslations("result.ledger");
  const locale = useLocale();
  const billGoesUp = option.monthlySavingsRp < 0;
  const loses = option.netSavingsRp < 0;
  const monthly = roundedMoneyFigure(Math.abs(option.monthlySavingsRp), locale);
  const share = percentFigure(option.selfConsumedShare, locale);
  const net = roundedMoneyFigure(Math.abs(option.netSavingsRp), locale);

  return (
    <Ledger
      className="mt-[22px]"
      rows={[
        { label: t(billGoesUp ? "monthlyUp" : "monthly"), value: <Figure value={monthly.figure} unit={monthly.unit} /> },
        { label: t("share"), value: <PercentFigure figure={share.figure} sign={share.unit} /> },
        { label: t(loses ? "netLoss" : "net", { years: horizon }), value: <Figure value={net.figure} unit={net.unit} /> },
        { label: t("co2"), value: <Figure value={co2TonnesText(option.co2AvoidedKgPerYear, locale)} unit={t("co2Unit")} /> },
      ]}
    />
  );
}

/** A percent in the Figure style with the sign at half size and no space before it ("92%"), as in the mock. */
function PercentFigure({ figure, sign }: { figure: string; sign: string }) {
  return (
    <span className="type-figure whitespace-nowrap text-figure-sm">
      {figure}
      <small className="ml-[3px] text-[0.5em] tracking-normal">{sign}</small>
    </span>
  );
}

type Translate = ReturnType<typeof useTranslations<"result">>;

/**
 * The payback chart's one-sentence finding, with the engine's numbers
 * (docs/DESIGN.md "Charts"). It reads the same judgment as the headline.
 */
function paybackCaption(t: Translate, option: OptionView, horizon: number, locale: string): string {
  const judgment = judgePayback(option.paybackYears);
  let finding: string;
  switch (judgment.kind) {
    case "range":
      finding =
        judgment.lowYear === judgment.highYear
          ? t("payback.captionOne", { low: judgment.lowYear })
          : t("payback.captionRange", { low: judgment.lowYear, high: judgment.highYear });
      break;
    case "notAtHighCost":
      finding = t("payback.captionOpen", { low: judgment.lowYear, years: horizon });
      break;
    case "onlyAtLowCost":
      finding = t("payback.captionLowOnly", { low: judgment.lowYear, years: horizon });
      break;
    case "never":
      finding = t("payback.captionNever", { years: horizon });
      break;
  }

  const net = option.netSavingsRp;
  const outcome =
    net >= 0
      ? t("payback.captionNet", { years: horizon, net: roundedMoneyFigure(net, locale).text })
      : t("payback.captionLoss", { years: horizon, loss: roundedMoneyFigure(-net, locale).text });
  return `${finding} ${outcome}`;
}

/**
 * The method note: where the output comes from, its margin against PVGIS, and
 * the assumption version. The margin was measured with NASA data for the place
 * itself, so it is worded by sun source: with the nearest city's data standing
 * in (fallback), it does not carry over, and the note says so.
 */
function MethodFooter({ version, fallbackSun }: { version: string; fallbackSun: boolean }) {
  const t = useTranslations("result.method");
  return (
    <SiteFooter>
      {t(fallbackSun ? "marginFallback" : "marginLive")} {t("version", { version })}
    </SiteFooter>
  );
}

/** SPEC 2.5: the roof cannot hold the smallest system. The page says so and names the area it needs. */
function RoofTooSmall({ result, isOwner }: { result: LoadedResult; isOwner: boolean }) {
  const t = useTranslations("result.tooSmall");
  const locale = useLocale();
  const required = result.view.roofTooSmall?.requiredAreaM2 ?? 0;

  return (
    <main className="flex-1">
      <Band tone="night" className="pb-[26px]">
        <Inner>
          <SiteHeader />
          <div id={CONTENT_ID} tabIndex={-1} className="max-w-measure">
            <HomeLine home={result.home} />
            <PosterHeading as="h1" size="page" className="mt-[18px] text-sun">
              <span className="mb-2.5 block font-sans text-[15px] font-extrabold leading-[1.4] tracking-[0.14em] text-paper [word-spacing:normal]">
                {t("lede")}
              </span>
              {t("heading")}
            </PosterHeading>
            <p className="mt-4 text-[17px] font-semibold">
              {t("body", {
                required: formatDecimal(required, locale, 1),
                area: formatDecimal(result.home.roofAreaM2, locale, 1),
              })}
            </p>
            <p className="mt-2 text-soft">{t("hint")}</p>
          </div>
        </Inner>
      </Band>
      <Inner className="pb-2.5 pt-4">
        <div className="max-w-measure">
          <ResultActions id={result.id} isOwner={isOwner} isExample={result.isExample} />
        </div>
      </Inner>
      <MethodFooter version={result.assumptionSetVersion} fallbackSun={result.view.flags.fallbackSunData} />
    </main>
  );
}
