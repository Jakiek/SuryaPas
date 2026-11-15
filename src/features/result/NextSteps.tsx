import { useTranslations } from "next-intl";
import { Caveat } from "@/components";
import type { Billing } from "../../engine";

const STEPS = ["survey", "apply", "install"] as const;

// SPEC 2.3 item 7: what a homeowner does next, shortened from the PLN
// application steps in docs/ASSUMPTIONS.md (Energy Ministry Regulation
// 2/2024): applications open in January and July (Art. 14(2)); a licensed
// business installs, only after approval (Art. 21, 22); a prepaid customer is
// moved to a monthly bill (Art. 16); approval depends on the area's quota,
// which the app does not know (Art. 9, 12).
export function NextSteps({ billing }: { billing: Billing }) {
  const t = useTranslations("result.next");

  return (
    <>
      <ol className="mt-4">
        {STEPS.map((step, index) => (
          <li key={step} className="grid grid-cols-[52px_1fr] items-baseline border-t border-rule py-3.5">
            <span aria-hidden="true" className="type-poster text-[40px] leading-[0.9] [font-stretch:75%]">
              {index + 1}
            </span>
            <div>
              <strong className="block text-[17px]">{t(`${step}Title`)}</strong>
              {t(`${step}Body`)}
            </div>
          </li>
        ))}
      </ol>
      {billing === "prepaid" && <p className="mt-2 max-w-[32em] border-t border-rule pt-3.5">{t("prepaid")}</p>}
      <Caveat className="mt-[18px]" title={t("quotaTitle")}>
        <p>{t("quotaBody")}</p>
      </Caveat>
    </>
  );
}
