// The steps of the journey, one helper each, shared by the whole-journey specs.
// A helper does what a person does and returns; the test says what must be true.
// The per-screen specs next to this folder keep their own small helpers; these
// are the ones the journeys need, written once.

import path from "node:path";
import { expect, type Page } from "@playwright/test";
import type { Copy } from "./copy";

export const DRAFT_KEY = "suryapas.plan.v1";
export const UNSAVED_KEY = "suryapas.result.unsaved.v1";

/** The house every journey describes. The tests read these back from the page, so a change here is a change in one place. */
export const HOUSE = {
  address: "Jl. Kaliurang Km 5, Sleman",
  areaM2: 48,
  connectedVa: 2200,
  monthlyBillRp: 650_000,
} as const;

export const LIFESTYLE_QUESTIONS = ["homeOnWeekdays", "daytimeAc", "workFromHome", "electricVehicle"] as const;

/** A thousands-grouped number the way the page writes it: "2.200" in id, "2,200" in en. */
export const grouped = (c: Copy, value: number) => new Intl.NumberFormat(c.locale).format(value);

export const nextButton = (page: Page, c: Copy, step: keyof Copy["plan"]["steps"]) =>
  page.getByRole("button", { name: c.plan.steps[step].next });

export const stepHeading = (page: Page, c: Copy, step: keyof Copy["plan"]["steps"]) =>
  expect(page.getByRole("heading", { level: 1 })).toHaveText(c.plan.steps[step].heading, { ignoreCase: true });

// ----------------------------------------------------------------- the steps

/** Landing: type the address in the hero field and press "Calculate". */
export async function startFromLanding(page: Page, c: Copy, address: string = HOUSE.address) {
  await page.goto(`/${c.locale}`);
  await page.getByLabel(c.landing.hero.label).fill(address);
  await page.getByRole("button", { name: c.landing.hero.button }).click();
  await expect(page).toHaveURL(new RegExp(`/${c.locale}/plan$`));
}

/** Step 1: the search box already holds the landing address; pick the first result. */
export async function pickFirstAddress(page: Page, c: Copy) {
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.plan.steps.location.heading, { ignoreCase: true });
  await expect(page.getByRole("option").first()).toBeVisible();
  await page.getByRole("option").first().click();
  await expect(nextButton(page, c, "location")).toBeEnabled();
}

export interface RoofAnswers {
  areaM2: number;
  slope?: "flat" | "gentle" | "steep";
  facing?: "north" | "east" | "south" | "west";
  shade?: "none" | "some" | "heavy";
}

/** Step 2 by the typed-area path, which is the keyboard-accessible one. */
export async function fillRoofTyped(page: Page, c: Copy, roof: RoofAnswers) {
  await page.getByRole("button", { name: c.roof.area.switchToType }).click();
  await page.getByLabel(c.roof.area.label).fill(String(roof.areaM2));
  await page.getByRole("radio", { name: c.roof.slope[roof.slope ?? "gentle"] }).check();
  if ((roof.slope ?? "gentle") !== "flat") {
    await page.getByRole("radio", { name: c.roof.facing[roof.facing ?? "east"] }).check();
  }
  await page.getByRole("radio", { name: c.roof.shade[roof.shade ?? "none"] }).check();
}

/** Step 3: a postpaid home on one month's bill. */
export async function fillElectricity(page: Page, c: Copy, va: number = HOUSE.connectedVa, billRp: number = HOUSE.monthlyBillRp) {
  await page.getByLabel(c.plan.electricity.power.label).selectOption(String(va));
  await page.getByLabel(c.plan.electricity.spend.postpaid.single).fill(String(billRp));
}

/** Step 4: one answer per question, in the order of LIFESTYLE_QUESTIONS. */
export async function answerLifestyle(page: Page, c: Copy, answers: readonly boolean[] = [true, true, false, false]) {
  for (const [index, question] of LIFESTYLE_QUESTIONS.entries()) {
    const group = page.getByRole("group", { name: c.plan.lifestyle[question].legend });
    await group.getByRole("radio", { name: answers[index] ? c.plan.lifestyle.yes : c.plan.lifestyle.no }).check();
  }
}

/** The four steps in order, from step 1 (address already picked) to the result page. */
export async function finishFlow(page: Page, c: Copy, roof: RoofAnswers = { areaM2: HOUSE.areaM2 }) {
  await nextButton(page, c, "location").click();
  await fillRoofTyped(page, c, roof);
  await nextButton(page, c, "roof").click();
  await fillElectricity(page, c);
  await nextButton(page, c, "electricity").click();
  await answerLifestyle(page, c);
  await nextButton(page, c, "lifestyle").click();
}

/** The whole journey up to pressing "Show my result", for one address. Where it lands is the caller's to check. */
export async function submitJourney(page: Page, c: Copy, address: string = HOUSE.address, roof?: RoofAnswers) {
  await startFromLanding(page, c, address);
  await pickFirstAddress(page, c);
  await finishFlow(page, c, roof);
}

/** The whole journey, landing to a saved result page. */
export async function runJourney(page: Page, c: Copy, address: string = HOUSE.address, roof?: RoofAnswers) {
  await submitJourney(page, c, address, roof);
  await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/[A-Za-z0-9_-]{22}$`), { timeout: 30_000 });
}

// --------------------------------------------------------------- the result

export interface Headline {
  panels: number;
  /** Roof the panels take, m². */
  usedAreaM2: number;
  kwp: number;
  /** Upfront cost, whole millions of rupiah, low to high. */
  costMillions: { low: number; high: number };
  /** Years, low to high; "atLeast" when only the low-cost year is known; null when it does not pay back. */
  payback: { kind: "range"; low: number; high: number } | { kind: "atLeast"; years: number } | { kind: "never" };
}

const number = (text: string) => Number(text.replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));

/** Reads the three headline numbers off the navy band at the top of a result page. */
export async function readHeadline(page: Page, c: Copy): Promise<Headline> {
  const band = page.locator('[data-band="night"]').first();
  await expect(band).toContainText(/\d/);
  const text = await band.innerText();

  const panels = Number(/(\d+)\s+panel/i.exec(text)?.[1]);
  const [, kwpText, areaText] = /([\d.,]+)\s*kWp[^\d]+([\d.,]+)\s*m²/.exec(text) ?? [];
  const cost = /Rp\s?([\d.,]+)\s*[–-]\s*([\d.,]+)/.exec(text);
  const paybackLabel = c.result.verdict.payback.toUpperCase();
  const paybackText = text.toUpperCase().split(paybackLabel)[1] ?? "";
  const never = text.toUpperCase().includes(c.result.verdict.paybackNever.toUpperCase());
  const range = /(\d+)\s*[–-]\s*(\d+)/.exec(paybackText);
  const atLeast = /(\d+)\+/.exec(paybackText);

  return {
    panels,
    usedAreaM2: number(areaText ?? "NaN"),
    kwp: number(kwpText ?? "NaN"),
    costMillions: { low: number(cost?.[1] ?? "NaN"), high: number(cost?.[2] ?? "NaN") },
    payback: never
      ? { kind: "never" }
      : range
        ? { kind: "range", low: Number(range[1]), high: Number(range[2]) }
        : { kind: "atLeast", years: Number(atLeast?.[1]) },
  };
}

/**
 * The three headline numbers are there and sensible for a roof of `roofAreaM2`.
 * The bounds come from the inputs and from arithmetic, never from a copied figure:
 * at least the smallest system, no more panels than the roof can hold, a cost
 * of a plausible size per kWp, and a payback that is a year range inside the
 * horizon or the words that say it does not pay back.
 */
export function expectPlausible(headline: Headline, roofAreaM2: number) {
  const { panels, kwp, usedAreaM2, costMillions, payback } = headline;
  expect(Number.isInteger(panels) && panels >= 2, `panel count ${panels}`).toBe(true);
  expect(usedAreaM2, "roof the panels take").toBeGreaterThan(0);
  expect(usedAreaM2, "roof the panels take").toBeLessThanOrEqual(roofAreaM2);
  // A panel is a few hundred watts: between 0.2 and 1 kWp each.
  expect(kwp / panels).toBeGreaterThan(0.2);
  expect(kwp / panels).toBeLessThan(1);
  expect(costMillions.low).toBeGreaterThan(0);
  expect(costMillions.high).toBeGreaterThanOrEqual(costMillions.low);
  // Rooftop systems here cost somewhere between 3 and 40 million rupiah per kWp.
  expect(costMillions.low / kwp).toBeGreaterThan(3);
  expect(costMillions.high / kwp).toBeLessThan(40);
  if (payback.kind === "range") {
    expect(payback.low).toBeGreaterThanOrEqual(1);
    expect(payback.high).toBeGreaterThanOrEqual(payback.low);
    expect(payback.high).toBeLessThanOrEqual(25);
  } else if (payback.kind === "atLeast") {
    expect(payback.years).toBeGreaterThanOrEqual(1);
    expect(payback.years).toBeLessThanOrEqual(25);
  }
}

// -------------------------------------------------------------------- axe

const AXE_SCRIPT = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

type AxeResult = { violations: { id: string; help: string; nodes: { target: string[] }[] }[] };

/**
 * Runs axe-core on the page as it is now and fails on any WCAG 2.0 or 2.1
 * level A or AA violation. Motion is switched off first, so no colour is
 * caught half way through a fade.
 */
export async function expectNoAxeViolations(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addScriptTag({ path: AXE_SCRIPT });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (c: Document, o: object) => Promise<AxeResult> } }).axe;
    const result = await axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
      exclude: [["nextjs-portal"]],
    });
    return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
  });
  expect(violations).toEqual([]);
}

// ---------------------------------------------------------------- keyboard

/** Presses Tab until the focused control's label or text contains `label`. Fails after 80 presses. */
export async function tabTo(page: Page, label: string) {
  for (let presses = 0; presses < 80; presses++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLInputElement | HTMLButtonElement | null;
      return element?.labels?.[0]?.textContent ?? element?.getAttribute("aria-label") ?? element?.textContent ?? "";
    });
    if (focused.includes(label)) return;
  }
  throw new Error(`Tab never reached "${label}"`);
}

/**
 * Counts every pointer event the page receives from now on. A keyboard-only
 * journey must leave the count at zero: Enter and Space make clicks, but a
 * click made by the keyboard comes with no pointerdown, mousedown or touchstart.
 */
export async function countPointerEvents(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __pointerEvents: string[] };
    w.__pointerEvents = [];
    for (const type of ["pointerdown", "pointerup", "mousedown", "mouseup", "touchstart"]) {
      window.addEventListener(type, () => w.__pointerEvents.push(type), true);
    }
  });
  return () => page.evaluate(() => (window as unknown as { __pointerEvents: string[] }).__pointerEvents);
}
