"use client";

import { useTranslations } from "next-intl";
import { QuestionList, SegmentedChoice } from "@/components";
import { lifestyleSchema } from "@/lib/schema";
import type { LifestyleDraft } from "./draft";
import { useStepValidity, type StepProps } from "./step";

type Answer = "yes" | "no";

// The four questions of step 4 (SPEC 2.2). The engine uses them to shape
// when the home uses power through the day (SPEC 3.2).
const QUESTIONS = [
  "homeOnWeekdays",
  "daytimeAc",
  "workFromHome",
  "electricVehicle",
] as const;

/** A stored boolean as the radio's value; null stays "not answered". */
function toAnswer(value: boolean | null): Answer | null {
  if (value === null) return null;
  return value ? "yes" : "no";
}

export function LifestyleStep({
  value,
  onChange,
  onValidChange,
}: StepProps<LifestyleDraft>) {
  const t = useTranslations("plan.lifestyle");
  // No message is shown per question: an unanswered radio group has
  // nothing to correct, and the shell's hint says what is missing.
  useStepValidity(lifestyleSchema, value, onValidChange);

  return (
    <QuestionList>
      {QUESTIONS.map((question) => (
        <SegmentedChoice
          key={question}
          legend={t(`${question}.legend`)}
          help={t(`${question}.help`)}
          name={question}
          size="short"
          value={toAnswer(value[question])}
          onChange={(answer) => onChange({ ...value, [question]: answer === "yes" })}
          options={[
            { value: "yes", label: t("yes") },
            { value: "no", label: t("no") },
          ]}
        />
      ))}
    </QuestionList>
  );
}
