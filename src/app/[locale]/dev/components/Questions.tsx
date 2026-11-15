"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  NumberField,
  QuestionList,
  SegmentedChoice,
  TextField,
} from "@/components";
import { formatDecimal } from "@/lib/format";
import { facingDrawings, shadeDrawings, slopeDrawings } from "./drawings";
import { SAMPLE } from "./sample";

type Slope = "flat" | "gentle" | "steep";
type Facing = "north" | "east" | "south" | "west";
type Shade = "none" | "some" | "heavy";

// The interactive part of the review page: the questions of the roof
// step in the mock, then every state of the text and number fields.
// It is a client component because it remembers what was picked or typed.
export function Questions() {
  const t = useTranslations("common.dev");
  const locale = useLocale();

  // Same starting picks as the mock; shade starts empty to show a group
  // with nothing selected yet.
  const [slope, setSlope] = useState<Slope | null>("gentle");
  const [facing, setFacing] = useState<Facing | null>("east");
  const [shade, setShade] = useState<Shade | null>(null);
  const [address, setAddress] = useState("");
  const [bill, setBill] = useState(formatDecimal(SAMPLE.monthlyBillRp, locale));
  const [area, setArea] = useState(formatDecimal(SAMPLE.tracedAreaM2, locale));
  const [emptyBill, setEmptyBill] = useState("");

  return (
    <QuestionList>
      <SegmentedChoice
        legend={t("slope.legend")}
        help={t("slope.help")}
        name="slope"
        value={slope}
        onChange={setSlope}
        options={[
          { value: "flat", label: t("slope.flat"), picture: slopeDrawings.flat },
          { value: "gentle", label: t("slope.gentle"), picture: slopeDrawings.gentle },
          { value: "steep", label: t("slope.steep"), picture: slopeDrawings.steep },
        ]}
      />

      <SegmentedChoice
        legend={t("facing.legend")}
        help={t("facing.help")}
        name="facing"
        size="short"
        value={facing}
        onChange={setFacing}
        options={[
          { value: "north", label: t("facing.north"), picture: facingDrawings.north },
          { value: "east", label: t("facing.east"), picture: facingDrawings.east },
          { value: "south", label: t("facing.south"), picture: facingDrawings.south },
          { value: "west", label: t("facing.west"), picture: facingDrawings.west },
        ]}
      />

      <SegmentedChoice
        legend={t("shade.legend")}
        help={t("shade.help")}
        name="shade"
        value={shade}
        onChange={setShade}
        options={[
          { value: "none", label: t("shade.none"), picture: shadeDrawings.none },
          {
            value: "some",
            label: t("shade.some"),
            note: t("shade.someNote"),
            picture: shadeDrawings.some,
          },
          { value: "heavy", label: t("shade.heavy"), picture: shadeDrawings.heavy },
        ]}
      />

      <TextField
        label={t("fields.addressLabel")}
        help={t("fields.addressHelp")}
        placeholder={t("hero.placeholder")}
        autoComplete="street-address"
        value={address}
        onChange={(event) => setAddress(event.target.value)}
      />

      <NumberField
        label={t("fields.billLabel")}
        help={t("fields.billHelp")}
        prefix="Rp"
        value={bill}
        onChange={(event) => setBill(event.target.value)}
      />

      <NumberField
        label={t("fields.areaLabel")}
        help={t("fields.areaHelp")}
        suffix="m²"
        decimal
        value={area}
        onChange={(event) => setArea(event.target.value)}
      />

      <NumberField
        label={t("fields.billLabel")}
        error={t("fields.billError")}
        prefix="Rp"
        value={emptyBill}
        onChange={(event) => setEmptyBill(event.target.value)}
      />

      <TextField
        label={t("fields.powerLabel")}
        help={t("fields.powerHelp")}
        defaultValue={t("fields.powerValue", {
          power: formatDecimal(SAMPLE.powerVa, locale),
        })}
        disabled
      />
    </QuestionList>
  );
}
