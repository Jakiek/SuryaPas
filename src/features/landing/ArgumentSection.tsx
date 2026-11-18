import { useId } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Band, Figure, Inner, Label, Ledger, PosterHeading } from "@/components";
import { DayChart } from "@/features/result/DayChart";
import { sideText } from "./comparisonText";
import type { ExampleComparison, ExampleSide } from "./exampleComparison";

// The regulation that ended payment for exported power: Energy Ministry
// Regulation 2/2024, Article 13. The link is the one in docs/ASSUMPTIONS.md
// ("Regulation").
const REGULATION_URL = "https://jdih.esdm.go.id/storage/document/Permen%20ESDM%20Nomor%202%20Tahun%202024.pdf";

type ArgumentSectionProps = { comparison: ExampleComparison };

// The page's argument (SPEC 2.1): a statement that exported power is no longer
// paid for, then the example house shown twice with the engine's own figures.
// The statement is always above the comparison: beside it, each chart would be
// narrower than the 340 px it is drawn for and its labels would shrink below
// 10 px. The two sides stack on phones and sit side by side from 768 px, the
// first width where each side is still as wide as at 375 px (335 px).
export function ArgumentSection({ comparison }: ArgumentSectionProps) {
  const t = useTranslations("landing.argument");
  const headingId = useId();

  return (
    <Band tone="paper" as="section" aria-labelledby={headingId}>
      <Inner className="pb-[52px] pt-11 lg:pb-[90px] lg:pt-20">
        <div>
          <PosterHeading as="h2" size="statement" id={headingId} className="max-w-[9em]">
            {t("heading")}
          </PosterHeading>
          <p className="mt-[22px] max-w-[24em] text-[length:clamp(21px,5.6vw,30px)] font-semibold leading-[1.28] tracking-[-0.015em]">
            {t.rich("lead", {
              mark: (chunks) => <mark className="-mx-[0.1em] bg-sun px-[0.1em] text-inherit">{chunks}</mark>,
            })}
          </p>
          <p className="mt-3.5 text-sm text-soft">
            {t("sourceLabel")}{" "}
            <a href={REGULATION_URL} lang="id" hrefLang="id" className="font-semibold underline">
              {t("sourceLink")}
            </a>
          </p>
        </div>

        <div role="group" aria-label={t("comparisonLabel")} className="mt-9 grid max-w-[520px] gap-[34px] md:max-w-none md:grid-cols-2 md:gap-7 lg:mt-12">
          <Side side={comparison.fits} comparison={comparison} tag={t("fitsTag")} />
          <Side side={comparison.tooMany} comparison={comparison} tag={t("tooManyTag")} />
        </div>
      </Inner>
    </Band>
  );
}

type SideProps = { side: ExampleSide; comparison: ExampleComparison; tag: string };

// One side: the panel count, the day chart, and three ledger rows.
function Side({ side, comparison, tag }: SideProps) {
  const t = useTranslations("landing.argument");
  const locale = useLocale();
  const text = sideText(side, locale);

  return (
    <div className="border-fg border-t-heavy pt-3">
      <h3 className="flex items-baseline justify-between gap-3">
        <Figure value={String(side.panels)} unit={t("panelsUnit", { count: side.panels })} size="md" />
        <Label className="text-right">{tag}</Label>
      </h3>
      <DayChart
        loadKwh={comparison.loadByHourKwh}
        solarKwh={side.solarByHourKwh}
        maxKw={comparison.chartMaxKw}
        caption={t("caption", { count: side.panels, ...text.day })}
      />
      <Ledger
        dense
        className="mt-2.5"
        rows={[
          { label: t("rows.wasted"), value: text.wasted },
          { label: t("rows.cost"), value: text.cost },
          { label: t("rows.payback"), value: text.payback ?? t("paybackNever") },
        ]}
      />
    </div>
  );
}
