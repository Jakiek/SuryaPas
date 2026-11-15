import { useTranslations } from "next-intl";
import { Label, Section } from "@/components";
import { CONFIDENCE_LABELS } from "./confidenceLabels";

// What each label means, in words a homeowner would use. Plain small
// capitals, not coloured badges (docs/DESIGN.md "What this design does not use").
export function ConfidenceGuide() {
  const t = useTranslations("assumptions");

  return (
    <Section heading={t("confidence.heading")}>
      <p className="mt-3 max-w-[34em] text-[17px] font-medium">{t("confidence.intro")}</p>
      <dl className="mt-4">
        {CONFIDENCE_LABELS.map((label) => (
          <div key={label} className="border-t border-rule py-3 last:border-b">
            <dt>
              <Label>{t(`confidence.labels.${label}.name`)}</Label>
            </dt>
            <dd className="mt-1 max-w-[34em] text-[15px]">{t(`confidence.labels.${label}.meaning`)}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
