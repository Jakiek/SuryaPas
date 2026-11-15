import { useLocale, useTranslations } from "next-intl";
import {
  Band,
  BoxedWord,
  Button,
  Caveat,
  ComparisonLedger,
  DayBand,
  Figure,
  HeroInput,
  Inner,
  Label,
  Ledger,
  PosterHeading,
  Progress,
  Section,
  SiteFooter,
  SiteHeader,
  TextLink,
  Wordmark,
} from "@/components";
import {
  formatDecimal,
  formatMoneyExact,
  formatMoneyRange,
  formatMoneyRounded,
  formatYearsRange,
} from "@/lib/format";
import { Questions } from "./Questions";
import { SAMPLE } from "./sample";
import { Specimen } from "./Specimen";

// The seven colour tokens of docs/DESIGN.md, each with the class that
// paints it. The values themselves live only in globals.css.
const COLOURS = [
  { token: "sun", swatch: "bg-sun", role: "sun" },
  { token: "sun-soft", swatch: "bg-sun-soft", role: "sunSoft" },
  { token: "night", swatch: "bg-night", role: "night" },
  { token: "paper", swatch: "bg-paper", role: "paper" },
  { token: "ink-soft", swatch: "bg-ink-soft", role: "inkSoft" },
  { token: "rule", swatch: "bg-rule", role: "rule" },
  { token: "alert", swatch: "bg-alert", role: "alert" },
] as const;

export function Showcase() {
  const t = useTranslations("common.dev");
  const locale = useLocale();

  // The sample house's figures, formatted for the current language.
  const power = formatDecimal(SAMPLE.powerVa, locale);
  const bill = formatMoneyExact(SAMPLE.monthlyBillRp, locale);
  const cost = formatMoneyRange(SAMPLE.costLowRp, SAMPLE.costHighRp, locale);
  const payback = formatYearsRange(
    SAMPLE.paybackLowYears,
    SAMPLE.paybackHighYears,
    locale,
  );
  const monthly = formatMoneyRounded(SAMPLE.monthlySavingsRp, locale);
  const net = formatMoneyRounded(SAMPLE.netSavingsRp, locale);
  const batteryCost = formatMoneyRange(
    SAMPLE.batteryCostLowRp,
    SAMPLE.batteryCostHighRp,
    locale,
  );
  const batteryPayback = formatYearsRange(
    SAMPLE.batteryPaybackLowYears,
    SAMPLE.batteryPaybackHighYears,
    locale,
  );
  const batteryNet = formatMoneyRounded(SAMPLE.batteryNetSavingsRp, locale);
  const answer = t("verdict.answer", { count: SAMPLE.panels });

  return (
    <div className="flex min-h-dvh flex-col">
      {/* ---------- Day: the landing screen of the mock ---------- */}
      <Band tone="sun">
        <Inner>
          <SiteHeader />
        </Inner>
      </Band>

      <main className="flex-1">
        <Band tone="sun">
          <Inner className="pb-[34px] pt-1.5">
            <h1 className="type-label">{t("title")}</h1>
            <p className="mt-1 max-w-[36em] text-sm text-soft">{t("intro")}</p>

            <div className="mt-6">
              <Specimen name={t("names.posterHero")}>
                <PosterHeading as="h2" size="hero">
                  {t.rich("hero.heading", {
                    box: (chunks) => <BoxedWord>{chunks}</BoxedWord>,
                  })}
                </PosterHeading>
              </Specimen>

              <Specimen name={t("names.heroInput")}>
                <form action={`/${locale}/plan`}>
                  <HeroInput
                    label={t("hero.label")}
                    buttonLabel={t("hero.button")}
                    name="address"
                    placeholder={t("hero.placeholder")}
                    autoComplete="street-address"
                  />
                  <p className="mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-1 text-sm font-semibold">
                    <span>{t("hero.free")}</span>
                    <span>{t("hero.time")}</span>
                    <span>{t("hero.noSignup")}</span>
                    <TextLink href="/r/example">{t("hero.example")}</TextLink>
                  </p>
                </form>
              </Specimen>

              <Specimen name={t("names.dayBanner")}>{null}</Specimen>
            </div>
          </Inner>
          <DayBand
            variant="banner"
            dayTone="paper"
            dayLabel={t("hero.dayLabel")}
          />
        </Band>

        {/* ---------- Paper: the roof step of the mock ---------- */}
        <Inner className="pb-10 pt-6">
          <Specimen name={t("names.progress")}>
            <Progress current={2} total={4} name={t("step.name")} />
          </Specimen>

          <Specimen name={t("names.posterPage")}>
            <PosterHeading as="h2" size="page">
              {t("step.heading")}
            </PosterHeading>
            <p className="mt-3 max-w-[30em] text-[17px] font-medium">
              {t("step.intro")}
            </p>
          </Specimen>

          <div className="mt-8 max-w-measure">
            <Questions />
          </div>

          <Specimen name={t("names.dock")}>
            <div className="grid grid-cols-[auto_1fr] items-center gap-[18px] border-fg border-t-heavy pt-3">
              <TextLink href="/">{t("step.back")}</TextLink>
              <Button href="/plan" className="sm:min-w-[220px] sm:justify-self-end">
                {t("step.next")}
              </Button>
            </div>
          </Specimen>

          <Specimen name={t("names.buttons")}>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Button>{t("buttons.solid")}</Button>
              <Button variant="outline" arrow={false}>
                {t("buttons.outline")}
              </Button>
              <Button note={t("buttons.soon")}>{t("buttons.quote")}</Button>
              <Button variant="outline">{t("buttons.solid")}</Button>
              <Button disabled>{t("buttons.disabled")}</Button>
              <Button variant="outline" disabled>
                {t("buttons.disabled")}
              </Button>
              <Button href="/plan">{t("buttons.link")}</Button>
            </div>
          </Specimen>
        </Inner>

        {/* ---------- Day again: buttons on yellow ---------- */}
        <Band tone="sun">
          <Inner className="py-6">
            <Specimen name={t("names.buttonsOnSun")}>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Button>{t("buttons.solid")}</Button>
                <Button variant="outline" arrow={false}>
                  {t("buttons.outline")}
                </Button>
                <Button disabled>{t("buttons.disabled")}</Button>
              </div>
              <TextLink href="/assumptions">{t("buttons.assumptions")}</TextLink>
            </Specimen>
          </Inner>
        </Band>

        {/* ---------- Night: the verdict band of the mock ---------- */}
        <Band tone="night">
          <Inner className="pb-[26px] pt-[18px]">
            <Wordmark />

            <div className="mt-6">
              <Specimen name={t("names.posterAnswer")}>
                <p className="text-sm font-semibold text-soft">
                  {t("verdict.where", { power, bill })}
                </p>
                <Label as="p" className="mt-[18px] text-[15px]">
                  {t("verdict.lede")}
                </Label>
                <PosterHeading as="h2" size="answer" className="mt-2.5 text-sun">
                  {answer}
                </PosterHeading>
                <p className="mt-3 font-semibold">
                  {t("verdict.sub", {
                    size: formatDecimal(SAMPLE.sizeKwp, locale),
                    area: formatDecimal(SAMPLE.roofAreaM2, locale),
                  })}{" "}
                  <span className="text-soft">{t("verdict.kwp")}</span>
                </p>
              </Specimen>

              <Specimen name={t("names.figures")}>
                <div className="grid grid-cols-2 border-t border-rule">
                  <div className="pt-3.5">
                    <Label className="mb-1.5 block text-soft">
                      {t("verdict.cost")}
                    </Label>
                    <Figure value={cost.figure} unit={cost.unit} size="fluid" />
                  </div>
                  <div className="border-l border-rule pl-4 pt-3.5">
                    <Label className="mb-1.5 block text-soft">
                      {t("verdict.payback")}
                    </Label>
                    <Figure
                      value={payback.figure}
                      unit={payback.unit}
                      size="fluid"
                    />
                  </div>
                </div>
              </Specimen>

              <Specimen name={t("names.buttonsOnNight")}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Button>{t("buttons.solid")}</Button>
                  <Button variant="outline" arrow={false}>
                    {t("buttons.outline")}
                  </Button>
                  <Button disabled>{t("buttons.disabled")}</Button>
                </div>
                <TextLink href="/assumptions">{t("buttons.assumptions")}</TextLink>
              </Specimen>
            </div>
          </Inner>
        </Band>

        {/* ---------- Paper: the report of the mock ---------- */}
        <Inner className="pb-10 pt-[30px]">
          <Section heading={t("report.dayHeading")}>
            <div className="mt-4">
              <Specimen name={t("names.dayChart")}>
                <p className="mb-3 text-sm text-soft">{t("report.chartNote")}</p>
                <DayBand />
                <p className="mt-3 max-w-[34em]">
                  {t("report.dayCaption", {
                    generated: formatDecimal(SAMPLE.generatedKwh, locale, 1),
                    used: formatDecimal(SAMPLE.usedKwh, locale, 1),
                    exported: formatDecimal(SAMPLE.exportedKwh, locale, 1),
                  })}
                </p>
              </Specimen>

              <Specimen name={t("names.ledger")}>
                <Ledger
                  rows={[
                    {
                      label: t("report.monthly"),
                      value: <Figure value={monthly.figure} unit={monthly.unit} />,
                    },
                    {
                      label: t("report.share"),
                      value: (
                        <Figure
                          value={formatDecimal(SAMPLE.selfUsedPercent, locale)}
                          unit="%"
                        />
                      ),
                    },
                    {
                      label: t("report.net", { years: SAMPLE.horizonYears }),
                      value: <Figure value={net.figure} unit={net.unit} />,
                    },
                    {
                      label: t("report.co2"),
                      value: (
                        <Figure
                          value={formatDecimal(SAMPLE.co2TonnesPerYear, locale)}
                          unit={t("report.co2Unit")}
                        />
                      ),
                    },
                  ]}
                />
              </Specimen>
            </div>
          </Section>

          <Section heading={t("report.batteryHeading")}>
            <p className="mt-2.5 max-w-[32em] text-[17px] font-medium">
              {t("report.batteryNote")}
            </p>
            <div className="mt-[18px]">
              <Specimen name={t("names.comparison")}>
                <ComparisonLedger
                  caption={t("report.batteryCaption")}
                  columns={[
                    t("report.without"),
                    t("report.with", { size: SAMPLE.batteryKwh }),
                  ]}
                  rows={[
                    {
                      label: t("verdict.cost"),
                      values: [cost.text, batteryCost.text],
                    },
                    {
                      label: t("report.monthly"),
                      values: [monthly.text, monthly.text],
                    },
                    {
                      label: t("verdict.payback"),
                      values: [payback.text, batteryPayback.text],
                    },
                    {
                      label: t("report.netShort", { years: SAMPLE.horizonYears }),
                      values: [net.text, batteryNet.text],
                    },
                  ]}
                />
              </Specimen>
            </div>
          </Section>

          <Section heading={t("report.nextHeading")}>
            <div className="mt-[18px]">
              <Specimen name={t("names.caveat")}>
                <Caveat title={t("report.caveatTitle")}>
                  {t("report.caveatBody")}
                </Caveat>
              </Specimen>

              <div className="mt-[26px] grid gap-2.5 sm:grid-cols-2">
                <Button note={t("buttons.soon")}>{t("buttons.quote")}</Button>
                <Button variant="outline" arrow={false}>
                  {t("buttons.outline")}
                </Button>
              </div>
              <div className="mt-2.5 flex flex-wrap gap-x-[26px]">
                <TextLink href="/assumptions">{t("buttons.assumptions")}</TextLink>
                <TextLink href="/plan">{t("buttons.edit")}</TextLink>
              </div>

              <Specimen name={t("names.ledgerDense")}>
                <div className="max-w-[520px] border-fg border-t-heavy pt-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <Figure value={answer} size="md" />
                    <Label className="text-right">{t("report.fits")}</Label>
                  </div>
                  <Ledger
                    dense
                    className="mt-2.5"
                    rows={[
                      {
                        label: t("report.wasted"),
                        value: `${formatDecimal(SAMPLE.wastedPercent, locale)}%`,
                      },
                      { label: t("verdict.cost"), value: cost.text },
                      { label: t("verdict.payback"), value: payback.text },
                    ]}
                  />
                </div>
              </Specimen>
            </div>
          </Section>

          {/* ---------- Tokens ---------- */}
          <Section heading={t("names.colours")}>
            <ul className="mt-4">
              {COLOURS.map((colour) => (
                <li
                  key={colour.token}
                  className="flex items-center gap-4 border-t border-rule py-3 last:border-b"
                >
                  <span
                    className={`h-11 w-11 shrink-0 border-heavy border-night ${colour.swatch}`}
                  />
                  <span>
                    <strong className="block">{colour.token}</strong>
                    <span className="text-sm text-soft">
                      {t(`colours.${colour.role}`)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          <Section heading={t("names.type")}>
            <div className="mt-4">
              <Specimen name={t("type.poster")}>
                <p className="type-poster text-poster-section">
                  {t("type.posterSample")}
                </p>
              </Specimen>
              <Specimen name={t("type.figure")}>
                <Figure value={cost.figure} unit={cost.unit} size="md" />
              </Specimen>
              <Specimen name={t("type.label")}>
                <Label>{t("type.labelSample")}</Label>
              </Specimen>
              <Specimen name={t("type.text")}>
                <p className="max-w-[34em]">{t("type.textSample")}</p>
              </Specimen>
            </div>
          </Section>

          <div className="mt-[38px]">
            <Specimen name={t("names.footers")}>{null}</Specimen>
          </div>
        </Inner>
      </main>

      <SiteFooter tone="night">{t("footerNote", { power, bill })}</SiteFooter>
    </div>
  );
}
