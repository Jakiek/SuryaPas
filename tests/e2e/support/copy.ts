// The message files, for both languages, in one place. Tests look labels up
// here instead of typing them, so a reworded button never breaks a test, and a
// button with no label in one language does.

import enAssumptions from "../../../messages/en/assumptions.json";
import enCommon from "../../../messages/en/common.json";
import enLanding from "../../../messages/en/landing.json";
import enLocation from "../../../messages/en/location.json";
import enPlan from "../../../messages/en/plan.json";
import enResult from "../../../messages/en/result.json";
import enRoof from "../../../messages/en/roof.json";
import idAssumptions from "../../../messages/id/assumptions.json";
import idCommon from "../../../messages/id/common.json";
import idLanding from "../../../messages/id/landing.json";
import idLocation from "../../../messages/id/location.json";
import idPlan from "../../../messages/id/plan.json";
import idResult from "../../../messages/id/result.json";
import idRoof from "../../../messages/id/roof.json";

export type Locale = "id" | "en";

export const COPY = {
  id: { locale: "id", common: idCommon, landing: idLanding, plan: idPlan, location: idLocation, roof: idRoof, result: idResult, assumptions: idAssumptions },
  en: { locale: "en", common: enCommon, landing: enLanding, plan: enPlan, location: enLocation, roof: enRoof, result: enResult, assumptions: enAssumptions },
} as const;

export type Copy = (typeof COPY)[Locale];

export const COPIES: readonly Copy[] = [COPY.id, COPY.en];

/** The other language's copy. */
export const otherCopy = (c: Copy): Copy => (c.locale === "id" ? COPY.en : COPY.id);

/**
 * A regular expression for a message with {placeholders}: each placeholder
 * matches any number, and the rest of the text matches itself. Used to find
 * "needs about 7 m² of roof" without knowing the 7.
 */
export function templateToRegExp(template: string): RegExp {
  const escaped = template.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(escaped.replace(/\{[a-zA-Z]+\}/g, "[\\d.,]+"));
}

/** Text with the markup tags of a message removed: "<box>pas</box>" → "pas". */
export const withoutTags = (text: string): string => text.replace(/<\/?[a-z]+>/g, "");
