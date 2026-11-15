"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button, QuestionList, SegmentedChoice, TextLink } from "@/components";
import { electricitySchema } from "@/lib/schema";
import {
  addMonth,
  MAX_MONTHS,
  removeLastMonth,
  setMonth,
  type ElectricityDraft,
} from "./draft";
import { PowerSelect } from "./PowerSelect";
import { RupiahField } from "./RupiahField";
import { useStepValidity, useVisibleErrors, type StepProps } from "./step";

// Step 3 (SPEC 2.2): how the home buys power, which PLN class it is on,
// and what it spends. Three questions, in the order of the spec.
export function ElectricityStep({
  value,
  onChange,
  onValidChange,
}: StepProps<ElectricityDraft>) {
  const t = useTranslations("plan.electricity");
  const errors = useStepValidity(electricitySchema, value, onValidChange);

  const { touch, messageFor } = useVisibleErrors(errors);

  const { billing, monthlySpendRp: months } = value;
  const monthCount = months.length;

  // An empty month beyond the first gets no message of its own. A message
  // appears when focus leaves the field, which moves the "add another
  // month" button down just as it is being clicked, and the click is
  // lost. The hint above the buttons already says to fill or remove it.
  const monthError = (index: number) =>
    index > 0 && months[index] === null
      ? undefined
      : messageFor(`monthlySpendRp.${index}`);

  // After "add another month", the new field gets the keyboard focus so a
  // keyboard user can type straight away.
  const monthsRef = useRef<HTMLFieldSetElement>(null);
  const focusNewMonth = useRef(false);
  useEffect(() => {
    if (!focusNewMonth.current) return;
    focusNewMonth.current = false;
    const inputs = monthsRef.current?.querySelectorAll("input");
    inputs?.[inputs.length - 1]?.focus();
  }, [monthCount]);

  return (
    <QuestionList>
      <SegmentedChoice
        legend={t("billing.legend")}
        help={t("billing.help")}
        name="billing"
        size="short"
        value={billing}
        onChange={(next) => onChange({ ...value, billing: next })}
        options={[
          { value: "prepaid", label: t("billing.prepaid"), note: t("billing.prepaidNote") },
          { value: "postpaid", label: t("billing.postpaid"), note: t("billing.postpaidNote") },
        ]}
      />

      <PowerSelect
        connectedVa={value.connectedVa}
        subsidised={value.subsidised}
        onChange={(choice) =>
          onChange({ ...value, connectedVa: choice.connectedVa, subsidised: choice.subsidised })
        }
        onBlur={() => touch("connectedVa")}
        error={messageFor("connectedVa")}
      />

      {/* The wording of this question follows the billing choice above:
          "isi token" for prepaid, "tagihan" for postpaid. */}
      <fieldset ref={monthsRef} className="min-w-0">
        <legend className="text-[19px] font-extrabold tracking-[-0.01em]">
          {t(`spend.${billing}.legend`)}
        </legend>
        <p className="pt-0.5 text-sm text-soft">{t(`spend.${billing}.help`)}</p>

        <div className="mt-3 grid gap-4">
          {months.map((amount, index) => (
            <RupiahField
              key={index}
              name={`month-${index + 1}`}
              label={monthCount === 1 ? t(`spend.${billing}.single`) : t("spend.monthLabel", { number: index + 1 })}
              value={amount}
              onChange={(next) =>
                onChange({ ...value, monthlySpendRp: setMonth(months, index, next) })
              }
              onBlur={() => touch(`monthlySpendRp.${index}`)}
              error={monthError(index)}
            />
          ))}
        </div>

        <p className="mt-4 text-sm text-soft">
          {monthCount < MAX_MONTHS
            ? t("spend.moreMonthsNote")
            : t("spend.fullYearNote")}
        </p>

        <div className="mt-3 grid items-center gap-x-[18px] sm:grid-cols-[auto_1fr]">
          <Button
            variant="outline"
            arrow={false}
            disabled={monthCount >= MAX_MONTHS}
            note={t("spend.count", { count: monthCount, max: MAX_MONTHS })}
            onClick={() => {
              focusNewMonth.current = true;
              onChange({ ...value, monthlySpendRp: addMonth(months) });
            }}
          >
            {t("spend.addMonth")}
          </Button>
          {monthCount > 1 && (
            <TextLink
              onClick={() =>
                onChange({ ...value, monthlySpendRp: removeLastMonth(months) })
              }
            >
              {t("spend.removeMonth")}
            </TextLink>
          )}
        </div>
      </fieldset>
    </QuestionList>
  );
}
