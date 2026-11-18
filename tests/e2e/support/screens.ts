// Getting a browser onto a particular screen without clicking through to it:
// a saved draft for each step of the flow, a saved result for each kind of
// verdict, and a result the server could not save. Used by the language and
// accessibility specs, which visit every screen.

import type { APIRequestContext, Page } from "@playwright/test";
import exampleHouse from "../../../data/example-house.json";
import { STORE_DOWN_URL } from "./server";
import { DRAFT_KEY, UNSAVED_KEY } from "./journey";

export const HOUSE_INPUTS = exampleHouse.inputs;

type Inputs = typeof exampleHouse.inputs;

/** A browser-storage draft: the example house, saved on the step given. */
export const draftOnStep = (step: number, inputs: Inputs = HOUSE_INPUTS) => ({ step, ...inputs, overrides: {} });

/**
 * Puts a value in localStorage or sessionStorage before the page's own scripts run,
 * but only the first time: a later load, such as the one a language switch makes,
 * must find what the page itself saved, not the seed.
 */
async function seedStorage(page: Page, kind: "localStorage" | "sessionStorage", key: string, value: unknown) {
  await page.addInitScript(
    ([storageKind, storageKey, text]) => {
      const storage = window[storageKind as "localStorage" | "sessionStorage"];
      if (storage.getItem(storageKey) === null) storage.setItem(storageKey, text);
    },
    [kind, key, JSON.stringify(value)] as const,
  );
}

export const seedDraft = (page: Page, draft: object) => seedStorage(page, "localStorage", DRAFT_KEY, draft);
export const seedUnsaved = (page: Page, kept: object) => seedStorage(page, "sessionStorage", UNSAVED_KEY, kept);

/** Saves a result through the real route and returns its id. */
export async function saveResult(request: APIRequestContext, inputs: Inputs = HOUSE_INPUTS, locale = "id"): Promise<string> {
  const response = await request.post("/api/assessments", { data: { inputs, overrides: {}, locale } });
  if (response.status() !== 201) throw new Error(`saving a result failed: ${response.status()}`);
  return ((await response.json()) as { id: string }).id;
}

/**
 * What the browser keeps after an answer that was not saved: asked of the
 * second test server, whose database is down, so it is the real thing.
 */
export async function keptUnsavedResult(request: APIRequestContext, inputs: Inputs = HOUSE_INPUTS, locale = "id") {
  const body = { inputs, overrides: {}, locale };
  const response = await request.post(`${STORE_DOWN_URL}/api/assessments`, { data: body });
  const answer = (await response.json()) as { saved?: boolean; assessment?: unknown };
  if (answer.saved !== false) throw new Error("the second test server saved a result; its database should be down");
  return { request: body, assessment: answer.assessment };
}

/** The example house with the changes that make each honest verdict appear. */
export const VARIANTS: Record<"tooSmall" | "heavyShade" | "doesNotPayBack", Inputs> = {
  tooSmall: { ...HOUSE_INPUTS, roof: { ...HOUSE_INPUTS.roof, areaM2: 4 } },
  heavyShade: { ...HOUSE_INPUTS, roof: { ...HOUSE_INPUTS.roof, shade: "heavy" } },
  doesNotPayBack: {
    ...HOUSE_INPUTS,
    electricity: { billing: "prepaid", connectedVa: 450, subsidised: true, monthlySpendRp: [60_000] },
  },
};
