"use client";

import { useState, useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Caveat, Inner, PosterHeading, Section, TextLink } from "@/components";
import { useRouter } from "@/i18n/navigation";
import {
  CURRENT_ASSUMPTIONS,
  TARIFF_CLASS_ORDER,
  type AssumptionKey,
  type AssumptionOverrides,
  type OrientationTable,
} from "../../engine/assumptions";
import { planStore } from "../plan/planStore";
import { submitAssessment } from "../plan/submit";
import { AdjustField } from "./AdjustField";
import { ConfidenceGuide } from "./ConfidenceGuide";
import { EntryRow, SourceLine } from "./EntryRow";
import { SECTION_ORDER, keysInSection, type SectionId } from "./sections";
import { showValue } from "./showValue";
import { classifyUnit, unitText } from "./units";
import { formatDecimal } from "../../lib/format";

type Props = {
  /** The id of the result the user came from, or null when they opened this page directly. */
  resultId: string | null;
};

const assumptions = CURRENT_ASSUMPTIONS;

// Nothing to subscribe to: "has the page reached the browser" never changes.
const noSubscription = () => () => {};

// The assumptions screen (SPEC 2.4). The user's changes live in the flow's
// draft, which is read from browser storage, so the list is built only once
// the page is in the browser; the first render matches the server's.
export function AssumptionsScreen({ resultId }: Props) {
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (!inBrowser) return <Inner className="min-h-[60vh]">{null}</Inner>;
  return <AssumptionsContent resultId={resultId} />;
}

/** Two override sets are the same when they hold the same keys and values. */
function overridesKey(overrides: AssumptionOverrides): string {
  return JSON.stringify(Object.entries(overrides).sort());
}

function AssumptionsContent({ resultId }: Props) {
  const t = useTranslations("assumptions");
  const locale = useLocale() as "id" | "en";
  const router = useRouter();

  const draft = useSyncExternalStore(planStore.subscribe, planStore.getSnapshot, planStore.getServerSnapshot);
  const overrides = draft.overrides;

  // What the overrides were on arrival, to know whether the result needs recomputing on the way back.
  const [overridesOnArrival] = useState(() => overridesKey(planStore.getSnapshot().overrides));
  const changedSinceArrival = overridesKey(overrides) !== overridesOnArrival;

  // Bumped on every reset so the edit boxes are rebuilt from the stored values.
  const [generation, setGeneration] = useState(0);
  // Entries whose box holds text that is not an acceptable value.
  const [problemKeys, setProblemKeys] = useState<ReadonlySet<AssumptionKey>>(new Set());
  const [sendState, setSendState] = useState<"idle" | "sending" | "failed" | "invalid">("idle");

  const changedKeys = Object.keys(overrides) as AssumptionKey[];

  function writeOverrides(next: AssumptionOverrides) {
    planStore.set({ ...planStore.getSnapshot(), overrides: next });
  }

  function setOverride(key: AssumptionKey, value: number) {
    const next = { ...planStore.getSnapshot().overrides };
    // A value equal to the set's own is no change at all.
    if (value === assumptions.entries[key].value) delete next[key];
    else next[key] = value;
    writeOverrides(next);
  }

  function resetEntry(key: AssumptionKey) {
    const next = { ...planStore.getSnapshot().overrides };
    delete next[key];
    writeOverrides(next);
    rebuildBoxes();
  }

  function resetAll() {
    writeOverrides({});
    rebuildBoxes();
  }

  function rebuildBoxes() {
    setProblemKeys(new Set());
    setGeneration((current) => current + 1);
  }

  function reportProblem(key: AssumptionKey, hasProblem: boolean) {
    setProblemKeys((current) => {
      if (current.has(key) === hasProblem) return current;
      const next = new Set(current);
      if (hasProblem) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  // SPEC 2.4 and the task: if overrides changed, the result is recomputed as
  // a new assessment through the same submit path as the flow.
  async function recalculateAndReturn() {
    setSendState("sending");
    const result = await submitAssessment(planStore.getSnapshot(), locale);
    if (result.ok) {
      router.push(`/r/${result.id}`);
      return;
    }
    setSendState(result.reason === "invalid" ? "invalid" : "failed");
  }

  const hasProblem = problemKeys.size > 0;

  return (
    <Inner className="pb-2 pt-4">
      <div className="max-w-measure">
        <PosterHeading as="h1" size="page">
          {t("title")}
        </PosterHeading>
        <p className="mt-3 max-w-[30em] text-[17px] font-medium">{t("intro")}</p>
        <p className="mt-3 text-sm text-soft">{t("version", { version: assumptions.version })}</p>

        <MarginSection />
        <ConfidenceGuide />

        {SECTION_ORDER.map((section) => (
          <SectionBlock
            key={section}
            section={section}
            overrides={overrides}
            generation={generation}
            locale={locale}
            onValidValue={setOverride}
            onProblemChange={reportProblem}
            onReset={resetEntry}
          />
        ))}

        {sendState === "invalid" && (
          <div role="alert" className="mt-8">
            <Caveat title={t("failures.invalid.title")}>
              <p>{t("failures.invalid.body")}</p>
              <TextLink href="/plan">{t("failures.invalid.link")}</TextLink>
            </Caveat>
          </div>
        )}
        {sendState === "failed" && (
          <div role="alert" className="mt-8">
            <Caveat title={t("failures.failed.title")}>
              <p>{t("failures.failed.body")}</p>
            </Caveat>
          </div>
        )}
        {hasProblem && <p className="mt-6 text-sm text-soft">{t("actions.fixFirst")}</p>}

        {/* On phones the bar sticks to the bottom of the screen; from 880 px it sits in the page
            (docs/DESIGN.md "Layout"), as in the plan flow. */}
        <div className="sticky bottom-0 -mx-gutter mt-7 grid grid-cols-[auto_1fr] items-center gap-[18px] border-fg border-t-heavy bg-paper px-gutter py-3 lg:static lg:mx-0 lg:mb-10 lg:mt-8 lg:px-0 lg:pt-4">
          <div>
            {changedKeys.length > 0 && <TextLink onClick={resetAll}>{t("actions.resetAll")}</TextLink>}
          </div>
          <ReturnButton
            resultId={resultId}
            changed={changedSinceArrival}
            blocked={hasProblem}
            sending={sendState === "sending"}
            failed={sendState === "failed"}
            onRecalculate={() => void recalculateAndReturn()}
          />
        </div>
      </div>
    </Inner>
  );
}

type ReturnButtonProps = {
  resultId: string | null;
  changed: boolean;
  blocked: boolean;
  sending: boolean;
  failed: boolean;
  onRecalculate: () => void;
};

/**
 * The one way out of the page. It says what will happen: go back to the
 * result as it was, or compute a new result with the changes and show that.
 */
function ReturnButton({ resultId, changed, blocked, sending, failed, onRecalculate }: ReturnButtonProps) {
  const t = useTranslations("assumptions");
  const className = "sm:min-w-[220px] sm:justify-self-end";

  if (resultId === null) {
    // Opened directly, not from a result: the changes wait in the flow for the next calculation.
    return (
      <Button href="/plan" className={className}>
        {t("actions.toPlan")}
      </Button>
    );
  }
  if (!changed) {
    return (
      <Button href={`/r/${resultId}`} className={className}>
        {t("actions.backToResult")}
      </Button>
    );
  }
  return (
    <Button onClick={onRecalculate} disabled={blocked || sending} className={className}>
      {sending ? t("actions.working") : failed ? t("actions.retry") : t("actions.backAndRecalculate")}
    </Button>
  );
}

function MarginSection() {
  const t = useTranslations("assumptions");
  return (
    <Section heading={t("margin.heading")} className="mt-8">
      <p className="mt-3 max-w-[34em] text-[17px] font-medium">{t("margin.body")}</p>
    </Section>
  );
}

type SectionBlockProps = {
  section: SectionId;
  overrides: AssumptionOverrides;
  generation: number;
  locale: "id" | "en";
  onValidValue: (key: AssumptionKey, value: number) => void;
  onProblemChange: (key: AssumptionKey, hasProblem: boolean) => void;
  onReset: (key: AssumptionKey) => void;
};

function SectionBlock({ section, overrides, generation, locale, onValidValue, onProblemChange, onReset }: SectionBlockProps) {
  const t = useTranslations("assumptions");
  const keys = keysInSection(section, assumptions);

  return (
    <Section heading={t(`sections.${section}.heading`)}>
      <p className="mt-3 max-w-[34em] text-[17px] font-medium">{t(`sections.${section}.intro`)}</p>

      {section === "tariffs" && <TariffRows locale={locale} />}

      {keys.length > 0 && (
        <ul className="mt-4">
          {keys.map((key) => (
            <ScalarRow
              key={`${key}:${generation}`}
              entryKey={key}
              overrides={overrides}
              locale={locale}
              onValidValue={onValidValue}
              onProblemChange={onProblemChange}
              onReset={onReset}
            />
          ))}
        </ul>
      )}

      {section === "sunlight" && <OrientationRows locale={locale} />}
      {section === "battery" && <BatterySizeRow locale={locale} />}
    </Section>
  );
}

type ScalarRowProps = {
  entryKey: AssumptionKey;
  overrides: AssumptionOverrides;
  locale: "id" | "en";
  onValidValue: (key: AssumptionKey, value: number) => void;
  onProblemChange: (key: AssumptionKey, hasProblem: boolean) => void;
  onReset: (key: AssumptionKey) => void;
};

/** One entry of the set: its own value, or the user's change shown as "changed by you". */
function ScalarRow({ entryKey, overrides, locale, onValidValue, onProblemChange, onReset }: ScalarRowProps) {
  const t = useTranslations("assumptions");
  const entry = assumptions.entries[entryKey];
  const unit = classifyUnit(entry.unit);
  const unitWords = unit ? unitText(unit, t) : entry.unit;

  const override = overrides[entryKey];
  const isChanged = override !== undefined;
  const currentValue = override ?? entry.value;
  const name = t(`entries.${entryKey}.name`);

  return (
    <EntryRow
      name={name}
      explanation={t(`entries.${entryKey}.explanation`)}
      figure={showValue(currentValue, unit, locale)}
      unit={unitWords}
      note={entry}
      locale={locale}
      changed={
        isChanged
          ? { originalFigure: showValue(entry.value, unit, locale), onReset: () => onReset(entryKey) }
          : undefined
      }
    >
      {entry.adjustable && (
        <AdjustField
          name={name}
          entry={entry}
          currentValue={currentValue}
          onValidValue={(value) => onValidValue(entryKey, value)}
          onProblemChange={(hasProblem) => onProblemChange(entryKey, hasProblem)}
        />
      )}
    </EntryRow>
  );
}

/** The seven PLN tariff classes, from the smallest connected power up. */
function TariffRows({ locale }: { locale: "id" | "en" }) {
  const t = useTranslations("assumptions");
  const { classes, note } = assumptions.powerClasses;
  const money = classifyUnit("Rp/kWh");

  return (
    <>
      <SourceLine note={note} locale={locale} />
      <ul className="mt-4">
        {TARIFF_CLASS_ORDER.map((className, index) => {
          const powerClass = classes[className];
          const subsidy = t(powerClass.subsidised ? "tariffs.subsidised" : "tariffs.notSubsidised");
          // The open-ended top class starts where the class below it ends.
          const upper = powerClass.maxVa ?? classes[TARIFF_CLASS_ORDER[index - 1]].maxVa ?? 0;
          const name = t(powerClass.maxVa === null ? "tariffs.above" : "tariffs.upTo", {
            va: formatDecimal(upper, locale, 0),
            subsidy,
          });
          return (
            <EntryRow
              key={className}
              name={name}
              explanation={t(powerClass.hasMinimumCharge ? "tariffs.minimumCharge" : "tariffs.noMinimumCharge")}
              figure={showValue(powerClass.tariffRpPerKwh, money, locale)}
              unit={money ? unitText(money, t) : undefined}
              locale={locale}
            />
          );
        })}
      </ul>
    </>
  );
}

const SLOPES: (keyof OrientationTable)[] = ["gentle", "steep"];
const FACINGS = ["towardEquator", "eastWest", "awayFromEquator"] as const;

/** The six slope-and-facing factors, with the table's one source note. */
function OrientationRows({ locale }: { locale: "id" | "en" }) {
  const t = useTranslations("assumptions");
  const { note, table } = assumptions.orientation;

  return (
    <div className="mt-8">
      <h3 className="text-[19px] font-extrabold">{t("orientation.heading")}</h3>
      <p className="mt-1 max-w-[34em] text-[15px]">{t("orientation.explanation")}</p>
      <SourceLine note={note} locale={locale} />
      <ul className="mt-4">
        {SLOPES.flatMap((slope) =>
          FACINGS.map((facing) => (
            <EntryRow
              key={`${slope}-${facing}`}
              name={t("orientation.row", { slope: t(`orientation.slope.${slope}`), facing: t(`orientation.facing.${facing}`) })}
              figure={showValue(table[slope][facing], null, locale)}
              unit={t("units.multiplier")}
              locale={locale}
            />
          )),
        )}
      </ul>
    </div>
  );
}

/** The battery sizes the calculator offers, as one row. */
function BatterySizeRow({ locale }: { locale: "id" | "en" }) {
  const t = useTranslations("assumptions");
  const { note, sizes } = assumptions.batterySizesKwh;
  const list = new Intl.ListFormat(locale, { type: "conjunction" }).format(
    sizes.map((size) => formatDecimal(size, locale, 1)),
  );

  return (
    <ul className="mt-4">
      <EntryRow
        name={t("batterySizes.name")}
        explanation={t("batterySizes.explanation")}
        figure={list}
        unit="kWh"
        note={note}
        locale={locale}
      />
    </ul>
  );
}

