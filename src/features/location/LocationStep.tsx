"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NumberField, QuestionList } from "@/components";
import { parseDecimal } from "@/features/plan/decimal";
import { useStepValidity, useVisibleErrors, type StepProps } from "@/features/plan/step";
import { locationSchema } from "@/lib/schema";
import type { LocationDraft } from "@/features/plan/draft";

// STUB for step 1. T11 replaces this file with the map, the address
// search and the Indonesia check. Until then: two typed numbers that meet
// the step contract (SPEC 5.2), so the flow can be walked end to end.
export function LocationStep({
  value,
  onChange,
  onValidChange,
}: StepProps<LocationDraft>) {
  const t = useTranslations("plan.location");
  const errors = useStepValidity(locationSchema, value, onValidChange);

  // The text as typed is kept here, because "-7," is not yet a number but
  // must stay in the box while the user types on.
  const [latitudeText, setLatitudeText] = useState(value.latitude?.toString() ?? "");
  const [longitudeText, setLongitudeText] = useState(value.longitude?.toString() ?? "");
  const { touch, messageFor } = useVisibleErrors(errors);

  return (
    <QuestionList>
      <NumberField
        label={t("latitude.label")}
        help={t("latitude.help")}
        decimal
        value={latitudeText}
        onChange={(event) => {
          setLatitudeText(event.target.value);
          onChange({ ...value, latitude: parseDecimal(event.target.value) });
        }}
        onBlur={() => touch("latitude")}
        error={messageFor("latitude")}
        autoComplete="off"
      />
      <NumberField
        label={t("longitude.label")}
        help={t("longitude.help")}
        decimal
        value={longitudeText}
        onChange={(event) => {
          setLongitudeText(event.target.value);
          onChange({ ...value, longitude: parseDecimal(event.target.value) });
        }}
        onBlur={() => touch("longitude")}
        error={messageFor("longitude")}
        autoComplete="off"
      />
    </QuestionList>
  );
}
