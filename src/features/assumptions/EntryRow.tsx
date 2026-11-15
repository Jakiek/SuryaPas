import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Label, TextLink } from "@/components";
import type { SourceNote } from "../../engine/assumptions";
import { showDate } from "./showValue";

type EntryRowProps = {
  name: string;
  /** One plain-language line. */
  explanation?: string;
  /** The value as written, with its currency sign if it has one. */
  figure: string;
  /** The words after the figure ("per kWp"). */
  unit?: string;
  /** Where the value comes from. Left out for rows that share their section's note. */
  note?: SourceNote;
  locale: string;
  /** Shown instead of the explanation's line break when the user has changed this entry. */
  changed?: { originalFigure: string; onReset: () => void };
  /** The edit box of an adjustable entry. */
  children?: ReactNode;
};

// One entry of the assumption set as a ledger row: name left, value right, a
// hairline rule between rows (docs/DESIGN.md "Ledger"). It is a plain list
// item, with no card around it.
export function EntryRow({ name, explanation, figure, unit, note, locale, changed, children }: EntryRowProps) {
  const t = useTranslations("assumptions");

  return (
    <li className="border-t border-rule py-4 last:border-b">
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-extrabold">{name}</p>
        <p className="text-right">
          <span className="whitespace-nowrap font-extrabold tabular-nums">{figure}</span>
          {unit && <span className="block text-sm text-soft">{unit}</span>}
        </p>
      </div>

      {explanation && <p className="mt-1 max-w-[34em] text-[15px]">{explanation}</p>}

      {note && <SourceLine note={note} locale={locale} />}

      {changed && (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-4 text-sm">
          <Label>{t("row.changedByYou")}</Label>
          <span className="text-soft">{t("row.original", { value: changed.originalFigure })}</span>
          <TextLink onClick={changed.onReset}>{t("row.reset")}</TextLink>
        </p>
      )}

      {children}
    </li>
  );
}

type SourceLineProps = { note: SourceNote; locale: string };

/** Confidence label, then the source (a link when it has an address), then the date. */
export function SourceLine({ note, locale }: SourceLineProps) {
  const t = useTranslations("assumptions");

  return (
    <p className="mt-2 text-sm text-soft">
      <Label>{t(`confidence.labels.${note.label}.name`)}</Label>
      {" · "}
      {note.url ? (
        <a
          href={note.url}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-fg underline underline-offset-[3px]"
        >
          {note.source}
          <span className="sr-only"> ({t("row.opensInNewTab")})</span>
        </a>
      ) : (
        note.source
      )}
      {" · "}
      {t("row.collected", { date: showDate(note.date, locale) })}
    </p>
  );
}
