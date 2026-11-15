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
  kwhPerDayText,
  percentFigure,
  roundedMoneyFigure,
  wastedPercentText,
} from "./figures";
import { Headline, HomeLine, Warnings } from "./Headline";
import type { LoadedResult } from "./loadResult";
import { NextSteps } from "./NextSteps";
import { PanelPicker } from "./PanelPicker";
import { PaybackChart } from "./PaybackChart";
import { ResultActions } from "./ResultActions";
import { useIsOwner } from "./useIsOwner";
import {
  candidateFor,
  compareWithRecommended,
  horizonYears,
  pickerSlots,
  verdictsFor,
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
  const isOwner = useIsOwner(result.inputsFingerprint, result.isExample);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href={`#${CONTENT_ID}`}
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-2 focus-visible:top-2 focus-visible:z-10 focus-visible:bg-paper focus-visible:px-3 focus-visible:py-2 focus-visible:font-bold focus-visible:text-night"
      >
        {tCommon("skipToContent")}
      </a>
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

  // The candidate on show, and the same eased over 200 ms after a change.
  const selected = useMemo(() => candidateFor(view, panels), [view, panels]);
  const shown = useEased(selected);
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

  const say =
    comparison === "recommended"
      ? t("picker.sayRecommended")
      : comparison === "fewer"
        ? t("picker.sayFewer")
        : t("picker.sayMore", { wasted: wastedPercentText(selected.withoutBattery, locale) });

  return (
    <main className="flex-1 lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
      <div className="lg:sticky lg:top-0 lg:min-h-dvh lg:bg-sun">
        <Band tone="night" className="pb-[26px]">
          <Inner className="lg:max-w-none">
            <SiteHeader />
            <div id={CONTENT_ID} tabIndex={-1}>
              <HomeLine home={home} />
              <Headline shown={shown} panels={panels} isRecommended={comparison === "recommended"} />
              <Warnings verdicts={verdicts} horizon={horizon} recommended={recommended} />
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
              caption={t("day.caption", {
                generated: kwhPerDayText(option.generationKwh, locale),
                used: kwhPerDayText(option.selfConsumedKwh, locale),
                exported: kwhPerDayText(option.exportedKwh, locale),
              })}
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
        <MethodFooter version={result.assumptionSetVersion} />
      </div>
    </main>
  );
}

/** SPEC 2.3 item 4: monthly savings, share used on site, net savings over the horizon, CO₂ avoided. */
function SupportingNumbers({ option, horizon }: { option: OptionView; horizon: number }) {
  const t = useTranslations("result.ledger");
  const locale = useLocale();
  const monthly = roundedMoneyFigure(option.monthlySavingsRp, locale);
  const share = percentFigure(option.selfConsumedShare, locale);
  const net = roundedMoneyFigure(option.netSavingsRp, locale);

  return (
    <Ledger
      className="mt-[22px]"
      rows={[
        { label: t("monthly"), value: <Figure value={monthly.figure} unit={monthly.unit} /> },
        { label: t("share"), value: <PercentFigure figure={share.figure} sign={share.unit} /> },
        { label: t("net", { years: horizon }), value: <Figure value={net.figure} unit={net.unit} /> },
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

/** The payback chart's one-sentence finding, with the engine's numbers (docs/DESIGN.md "Charts"). */
function paybackCaption(t: Translate, option: OptionView, horizon: number, locale: string): string {
  const years = Math.round;
  const { low, high } = option.paybackYears;
  let finding: string;
  if (low === null) finding = t("payback.captionNever", { years: horizon });
  else if (high === null) finding = t("payback.captionOpen", { low: years(low), years: horizon });
  else if (years(low) === years(high)) finding = t("payback.captionOne", { low: years(low) });
  else finding = t("payback.captionRange", { low: years(low), high: years(high) });

  const net = option.netSavingsRp;
  const outcome =
    net >= 0
      ? t("payback.captionNet", { years: horizon, net: roundedMoneyFigure(net, locale).text })
      : t("payback.captionLoss", { years: horizon, loss: roundedMoneyFigure(-net, locale).text });
  return `${finding} ${outcome}`;
}

/** The method note: where the output comes from, its margin against PVGIS, and the assumption version. */
function MethodFooter({ version }: { version: string }) {
  const t = useTranslations("result.method");
  return (
    <SiteFooter>
      {t("margin")} {t("version", { version })}
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
      <MethodFooter version={result.assumptionSetVersion} />
    </main>
  );
}
