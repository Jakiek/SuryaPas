"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Caveat, NumberField, QuestionList, SegmentedChoice, TextLink } from "@/components";
import { CURRENT_ASSUMPTIONS } from "@/engine";
import type { Facing, Shade, Slope } from "@/engine";
import { parseDecimal } from "@/features/plan/decimal";
import type { RoofDraft } from "@/features/plan/draft";
import { ChoiceQuestion } from "@/features/plan/FieldError";
import { useStepValidity, useVisibleErrors, type StepProps } from "@/features/plan/step";
import { planStore } from "@/features/plan/planStore";
import { MAX_ROOF_AREA_M2, roofSchema } from "@/lib/schema";
import { esriApiKey } from "./imageryStyle";
import { facingPictures, shadePictures, slopePictures } from "./pictures";
import {
  areaWarning,
  footprintAreaM2,
  MIN_CORNERS,
  roundArea,
  usableAreaM2,
  type Corner,
} from "./roofGeometry";
import { RoofTracer } from "./RoofTracer";

// Bounds for the usable-fraction slider. SPEC 2.2 says only "adjustable";
// the agreed range 0.60 to 0.70 is written in docs/ASSUMPTIONS.md and in the
// note of `roof.usableFraction`, but the entry is a fixed one with no min
// and max, so the range is repeated here until the set carries it. An
// adjustable entry's own min and max win as soon as it does.
const FALLBACK_USABLE_RANGE = { min: 0.6, max: 0.7 };
const USABLE_STEP = 0.01;

const usableEntry = CURRENT_ASSUMPTIONS.entries["roof.usableFraction"];
const USABLE_MIN = usableEntry.min ?? FALLBACK_USABLE_RANGE.min;
const USABLE_MAX = usableEntry.max ?? FALLBACK_USABLE_RANGE.max;

type AreaMode = "trace" | "type";

// Step 2 (SPEC 2.2): the roof's area by tracing or typing, then slope,
// facing, shade and the usable share. Traced and typed area are ONE value,
// `value.areaM2`: tracing writes it, typing writes it, and whichever came
// last is what the draft holds.
export function RoofStep({ value, onChange, onValidChange }: StepProps<RoofDraft>) {
  const t = useTranslations("roof");
  const locale = useLocale();
  const errors = useStepValidity(roofSchema, value, onValidChange);
  const { touch, messageFor } = useVisibleErrors(errors);

  // The pin of step 1 is not part of this step's slice, so it is read from
  // the same store the shell uses.
  const [center] = useState(readPin);

  // A returning visitor with an area already saved starts in the typing view.
  const [mode, setMode] = useState<AreaMode>(value.areaM2 === null ? "trace" : "type");
  const [corners, setCorners] = useState<Corner[]>([]);
  const [closed, setClosed] = useState(false);
  const [areaText, setAreaText] = useState(value.areaM2 === null ? "" : formatArea(value.areaM2, locale));
  const [mapUnsupported, setMapUnsupported] = useState(false);

  const tracedArea = footprintAreaM2(corners);

  // Switching to typing puts the cursor in the field, so a keyboard user
  // who pressed the switch link can type at once. (The field sits above the
  // link, and Tab would otherwise move away from it.)
  const areaQuestion = useRef<HTMLDivElement>(null);
  const previousMode = useRef(mode);
  useEffect(() => {
    if (previousMode.current !== mode && mode === "type") {
      areaQuestion.current?.querySelector("input")?.focus();
    }
    previousMode.current = mode;
  }, [mode]);

  /** Tracing changed the shape: the area follows it, in the typed box too. */
  function applyCorners(next: Corner[], nextClosed = closed) {
    const area = footprintAreaM2(next);
    const rounded = area === null ? null : roundArea(area);
    setCorners(next);
    setClosed(next.length >= MIN_CORNERS ? nextClosed : false);
    setAreaText(rounded === null ? "" : formatArea(rounded, locale));
    onChange({ ...value, areaM2: rounded });
  }

  function typeArea(text: string) {
    setAreaText(text);
    onChange({ ...value, areaM2: parseDecimal(text) });
  }

  // SPEC 2.2: the facing question is hidden when the slope is flat, and a
  // flat roof has no facing ("none").
  function chooseSlope(slope: Slope) {
    if (slope === "flat") {
      onChange({ ...value, slope, facing: "none" });
    } else {
      onChange({ ...value, slope, facing: value.facing === "none" ? null : value.facing });
    }
  }

  const showTracer = mode === "trace" && !mapUnsupported;
  const warning = areaWarning(value.areaM2);
  // Above the limit the area is refused (SPEC 2.2): the step cannot be
  // continued, and the notice shows in both views of the area question.
  const refused = value.areaM2 !== null && value.areaM2 > MAX_ROOF_AREA_M2;

  return (
    <QuestionList>
      <div ref={areaQuestion}>
        {showTracer ? (
          <RoofTracer
            center={center}
            corners={corners}
            closed={closed}
            areaM2={tracedArea === null ? null : roundArea(tracedArea)}
            imageryKey={esriApiKey}
            onTap={(corner) => applyCorners([...corners, corner])}
            onCornersChange={applyCorners}
            onUndo={() => applyCorners(corners.slice(0, -1))}
            onClear={() => applyCorners([], false)}
            onToggleClosed={() => setClosed(!closed)}
            onUnsupported={() => setMapUnsupported(true)}
          />
        ) : (
          <>
            {mapUnsupported && <p className="mb-4 text-[17px] font-semibold">{t("area.mapUnsupported")}</p>}
            <NumberField
              label={t("area.label")}
              help={t("area.help")}
              suffix="m²"
              decimal
              value={areaText}
              onChange={(event) => typeArea(event.target.value)}
              onBlur={() => touch("areaM2")}
              error={refused ? undefined : messageFor("areaM2")}
              autoComplete="off"
            />
          </>
        )}

        {refused && (
          <div role="alert" className="mt-4">
            <Caveat title={t("refused.title")}>
              <p>{t("refused.body", { max: MAX_ROOF_AREA_M2.toLocaleString(locale) })}</p>
            </Caveat>
          </div>
        )}

        {warning && !refused && (
          <div role="alert" className="mt-4">
            <Caveat title={t(`warning.${warning}.title`)}>
              <p>{t(`warning.${warning}.body`)}</p>
            </Caveat>
          </div>
        )}

        {!mapUnsupported && (
          <TextLink onClick={() => setMode(mode === "trace" ? "type" : "trace")} className="mt-2">
            {mode === "trace" ? t("area.switchToType") : t("area.switchToTrace")}
          </TextLink>
        )}
      </div>

      <ChoiceQuestion
        onLeave={() => touch("slope")}
        error={messageFor("slope", value.facing !== null || value.shade !== null)}
      >
        <SegmentedChoice<Slope>
          legend={t("slope.legend")}
          help={t("slope.help")}
          name="slope"
          value={value.slope}
          onChange={chooseSlope}
          options={[
            { value: "flat", label: t("slope.flat"), note: t("slope.flatNote"), picture: slopePictures.flat },
            { value: "gentle", label: t("slope.gentle"), note: t("slope.gentleNote"), picture: slopePictures.gentle },
            { value: "steep", label: t("slope.steep"), note: t("slope.steepNote"), picture: slopePictures.steep },
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
            help={t("facing.help")}
            name="facing"
            size="short"
            value={value.facing}
            onChange={(facing) => onChange({ ...value, facing })}
            options={[
              { value: "N", label: t("facing.north"), picture: facingPictures.N },
              { value: "E", label: t("facing.east"), picture: facingPictures.E },
              { value: "S", label: t("facing.south"), picture: facingPictures.S },
              { value: "W", label: t("facing.west"), picture: facingPictures.W },
            ]}
          />
        </ChoiceQuestion>
      )}

      <ChoiceQuestion onLeave={() => touch("shade")} error={messageFor("shade")}>
        <SegmentedChoice<Shade>
          legend={t("shade.legend")}
          help={t("shade.help")}
          name="shade"
          value={value.shade}
          onChange={(shade) => onChange({ ...value, shade })}
          options={[
            { value: "none", label: t("shade.none"), picture: shadePictures.none },
            { value: "some", label: t("shade.some"), note: t("shade.someNote"), picture: shadePictures.some },
            { value: "heavy", label: t("shade.heavy"), picture: shadePictures.heavy },
          ]}
        />
      </ChoiceQuestion>

      <UsableFraction
        fraction={value.usableFraction}
        areaM2={value.areaM2}
        onChange={(usableFraction) => onChange({ ...value, usableFraction })}
      />
    </QuestionList>
  );
}

/** The pin chosen in step 1, read once when this step opens. */
function readPin(): { latitude: number; longitude: number } | null {
  const { latitude, longitude } = planStore.getSnapshot().location;
  return latitude !== null && longitude !== null ? { latitude, longitude } : null;
}

/** "48,5" in Indonesian, "48.5" in English, never grouped ("1234,5"). */
function formatArea(areaM2: number, locale: string): string {
  return areaM2.toLocaleString(locale, { useGrouping: false, maximumFractionDigits: 1 });
}

// The share of the roof that can hold panels: a slider from the default,
// with the usable area in m² beside it and one line saying why (SPEC 2.2).
function UsableFraction({
  fraction,
  areaM2,
  onChange,
}: {
  fraction: number;
  areaM2: number | null;
  onChange: (fraction: number) => void;
}) {
  const t = useTranslations("roof.usable");
  const locale = useLocale();
  const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const area = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });

  return (
    <div>
      <label htmlFor="usable-fraction" className="block text-[19px] font-extrabold tracking-[-0.01em]">
        {t("label")}
      </label>
      <p className="pt-0.5 text-sm text-soft">{t("help")}</p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4">
        <output htmlFor="usable-fraction" className="type-figure text-figure-md">
          {percent.format(fraction)}
        </output>
        <span className="text-[17px] font-bold">
          {areaM2 === null
            ? t("unknown")
            : t("about", { area: area.format(usableAreaM2(areaM2, fraction)) })}
        </span>
      </div>
      <input
        id="usable-fraction"
        type="range"
        min={USABLE_MIN}
        max={USABLE_MAX}
        step={USABLE_STEP}
        value={fraction}
        onChange={(event) => onChange(snapToStep(Number(event.target.value)))}
        className="mt-1 block h-11 w-full cursor-pointer accent-night"
      />
    </div>
  );
}

/** Slider values such as 0.6000000000000001 are tidied to two decimals. */
function snapToStep(raw: number): number {
  return Math.round(raw * 100) / 100;
}
