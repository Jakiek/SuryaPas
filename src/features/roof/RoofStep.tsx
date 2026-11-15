"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { NumberField, QuestionList, SegmentedChoice } from "@/components";
import { parseDecimal } from "@/features/plan/decimal";
import type { RoofDraft } from "@/features/plan/draft";
import { ChoiceQuestion } from "@/features/plan/FieldError";
import { useStepValidity, useVisibleErrors, type StepProps } from "@/features/plan/step";
import { roofSchema } from "@/lib/schema";
import type { Facing, Shade, Slope } from "@/engine";

// STUB for step 2. T12 replaces this file with satellite tracing and the
// drawn choices. Until then: a typed area and three plain choices that
// meet the step contract (SPEC 5.2). The usable fraction keeps its default
// from the assumption set; T12 adds the control that changes it.
export function RoofStep({ value, onChange, onValidChange }: StepProps<RoofDraft>) {
  const t = useTranslations("plan.roof");
  const errors = useStepValidity(roofSchema, value, onValidChange);
  const { touch, messageFor } = useVisibleErrors(errors);
  const [areaText, setAreaText] = useState(value.areaM2?.toString() ?? "");

  // SPEC 2.2: the facing question is hidden when the slope is flat, and a
  // flat roof has no facing ("none").
  function chooseSlope(slope: Slope) {
    if (slope === "flat") {
      onChange({ ...value, slope, facing: "none" });
    } else {
      onChange({ ...value, slope, facing: value.facing === "none" ? null : value.facing });
    }
  }

  return (
    <QuestionList>
      <NumberField
        label={t("area.label")}
        help={t("area.help")}
        suffix="m²"
        decimal
        value={areaText}
        onChange={(event) => {
          setAreaText(event.target.value);
          onChange({ ...value, areaM2: parseDecimal(event.target.value) });
        }}
        onBlur={() => touch("areaM2")}
        error={messageFor("areaM2")}
        autoComplete="off"
      />

      <ChoiceQuestion
        onLeave={() => touch("slope")}
        error={messageFor("slope", value.facing !== null || value.shade !== null)}
      >
        <SegmentedChoice<Slope>
          legend={t("slope.legend")}
          name="slope"
          size="short"
          value={value.slope}
          onChange={chooseSlope}
          options={[
            { value: "flat", label: t("slope.flat") },
            { value: "gentle", label: t("slope.gentle") },
            { value: "steep", label: t("slope.steep") },
          ]}
        />
      </ChoiceQuestion>

      {value.slope !== "flat" && (
        <ChoiceQuestion
          onLeave={() => touch("facing")}
          error={messageFor("facing", value.shade !== null)}
        >
          <SegmentedChoice<Facing>
            legend={t("facing.legend")}
            name="facing"
            size="short"
            value={value.facing}
            onChange={(facing) => onChange({ ...value, facing })}
            options={[
              { value: "N", label: t("facing.north") },
              { value: "E", label: t("facing.east") },
              { value: "S", label: t("facing.south") },
              { value: "W", label: t("facing.west") },
            ]}
          />
        </ChoiceQuestion>
      )}

      <ChoiceQuestion onLeave={() => touch("shade")} error={messageFor("shade")}>
        <SegmentedChoice<Shade>
          legend={t("shade.legend")}
          name="shade"
          size="short"
          value={value.shade}
          onChange={(shade) => onChange({ ...value, shade })}
          options={[
            { value: "none", label: t("shade.none") },
            { value: "some", label: t("shade.some") },
            { value: "heavy", label: t("shade.heavy") },
          ]}
        />
      </ChoiceQuestion>
    </QuestionList>
  );
}
