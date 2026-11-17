import { useTranslations } from "next-intl";
import { Label, Section } from "@/components";
import { RULE_CITATIONS, RULE_ORDER } from "./rules";

// The three rules the whole calculation rests on, each with its regulation.
// Plain text and hairline rules, no cards (docs/DESIGN.md "What this design does not use").
export function RulesGuide() {
  const t = useTranslations("assumptions");

  return (
    <Section heading={t("rules.heading")} className="mt-8">
      <p className="mt-3 max-w-[34em] text-[17px] font-medium">{t("rules.intro")}</p>
      <ol className="mt-4">
        {RULE_ORDER.map((rule) => (
          <li key={rule} className="border-t border-rule py-4 last:border-b">
            <h3 className="text-[19px] font-extrabold">{t(`rules.items.${rule}.title`)}</h3>
            <p className="mt-1 max-w-[34em] text-[15px]">{t(`rules.items.${rule}.body`)}</p>
            <p className="mt-2 text-sm text-soft">
              <Label>{t("rules.sourceLabel")}</Label>
              {RULE_CITATIONS[rule].map((citation, index) => (
                <span key={citation.url + citation.text}>
                  {index === 0 ? " · " : "; "}
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-fg underline underline-offset-[3px]"
                  >
                    {citation.text}
                    <span className="sr-only"> ({t("row.opensInNewTab")})</span>
                  </a>
                </span>
              ))}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
