// The assumptions screen (T14), driven at 375 px in both languages.
// The result page does not exist yet, so "back to result" is checked up to
// the request it sends: the POST to /api/assessments is intercepted and its
// body inspected. Whether the new result shows a different upfront cost
// needs T13's page and is not covered here.

import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en/assumptions.json";
import id from "../../messages/id/assumptions.json";
import { CURRENT_ASSUMPTIONS, type AssumptionKey } from "../../src/engine/assumptions";
import { STORAGE_KEY } from "../../src/features/plan/planStore";

const AXE_SCRIPT = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

const LOCALES = [
  { locale: "id", m: id, typed: "18.000.000", range: "5.000.000" },
  { locale: "en", m: en, typed: "18,000,000", range: "5,000,000" },
] as const;

const KEY: AssumptionKey = "capex.perKwp.typical";

/** A complete draft, so the page can recompute: the same answers the plan flow collects. */
const COMPLETE_DRAFT = {
  step: 4,
  location: { latitude: -7.78, longitude: 110.37 },
  roof: { areaM2: 48, usableFraction: 0.65, facing: "E", slope: "gentle", shade: "none" },
  electricity: { billing: "postpaid", connectedVa: 2200, subsidised: false, monthlySpendRp: [650000] },
  lifestyle: { homeOnWeekdays: true, daytimeAc: true, workFromHome: true, electricVehicle: true },
  overrides: {},
};

async function open(page: Page, locale: string) {
  await page.goto(`/${locale}/assumptions?from=example`);
  await page.evaluate(([key, draft]) => localStorage.setItem(key as string, JSON.stringify(draft)), [STORAGE_KEY, COMPLETE_DRAFT]);
  await page.reload();
}

const costField = (page: Page, c: (typeof LOCALES)[number]) =>
  page.getByLabel(c.m.edit.label.replace("{name}", c.m.entries.capex.perKwp.typical.name));

for (const c of LOCALES) {
  test.describe(`assumptions in ${c.locale}`, () => {
    test("shows every entry of the set with its name", async ({ page }) => {
      await open(page, c.locale);
      for (const key of Object.keys(CURRENT_ASSUMPTIONS.entries)) {
        const entries = c.m.entries as unknown as Record<string, unknown>;
        let node: unknown = entries;
        for (const part of key.split(".")) node = (node as Record<string, unknown>)[part];
        const name = (node as { name: string }).name;
        await expect(page.getByText(name, { exact: true }).first(), key).toBeVisible();
      }
    });

    test("a change is marked, written to the draft and reset to the set's own value", async ({ page }) => {
      await open(page, c.locale);
      const field = costField(page, c);
      await field.fill(c.typed);
      await field.blur();

      await expect(page.getByText(c.m.row.changedByYou)).toBeVisible();
      const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").overrides, STORAGE_KEY);
      expect(stored).toEqual({ [KEY]: 18_000_000 });

      await page.getByRole("button", { name: c.m.row.reset }).click();
      await expect(page.getByText(c.m.row.changedByYou)).toHaveCount(0);
      await expect(field).toHaveValue(new Intl.NumberFormat(c.locale).format(CURRENT_ASSUMPTIONS.entries[KEY].value));
      const after = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").overrides, STORAGE_KEY);
      expect(after).toEqual({});
    });

    test("an out-of-range value is rejected with the allowed range", async ({ page }) => {
      await open(page, c.locale);
      const field = costField(page, c);
      await field.fill("1000");
      await field.blur();
      await expect(page.getByText(c.range).first()).toBeVisible();
      await expect(page.getByText(c.m.errors.outOfRange.split("{range}")[0].trim())).toBeVisible();
      const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").overrides, STORAGE_KEY);
      expect(stored).toEqual({});
      // The way out is held back while a box holds a bad value.
      await expect(page.getByRole("link", { name: c.m.actions.backToResult })).toBeVisible();
    });

    test("a share is shown and typed as percent but stored as a fraction", async ({ page }) => {
      await open(page, c.locale);
      const field = page.getByLabel(c.m.edit.label.replace("{name}", c.m.entries.finance.tariffEscalationPerYear.name));
      await field.fill(c.locale === "id" ? "0,5" : "0.5");
      await field.blur();
      await expect(page.getByText(c.locale === "id" ? "0,5%" : "0.5%", { exact: true }).first()).toBeVisible();
      const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").overrides, STORAGE_KEY);
      expect(stored).toEqual({ "finance.tariffEscalationPerYear": 0.005 });
    });

    test("a low estimate above the typical one is rejected, naming the neighbour", async ({ page }) => {
      await open(page, c.locale);
      const low = page.getByLabel(c.m.edit.label.replace("{name}", c.m.entries.capex.perKwp.low.name));
      await low.fill(c.typed);
      await low.blur();
      const neighbour = c.m.entries.capex.perKwp.typical.name;
      await expect(page.getByText(`"${neighbour}"`)).toBeVisible();
      const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").overrides, STORAGE_KEY);
      expect(stored).toEqual({});
    });

    test("back to result after a change sends the override as a new assessment", async ({ page }) => {
      let body: { overrides?: Record<string, number> } | null = null;
      await page.route("**/api/assessments", async (route) => {
        body = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: "new-id" }) });
      });
      await open(page, c.locale);
      await costField(page, c).fill(c.typed);
      await page.getByRole("button", { name: c.m.actions.backAndRecalculate }).click();
      await expect.poll(() => body?.overrides).toEqual({ [KEY]: 18_000_000 });
      await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/new-id$`));
    });

    test("back to result with no change links to the same result", async ({ page }) => {
      await open(page, c.locale);
      await expect(page.getByRole("link", { name: c.m.actions.backToResult })).toHaveAttribute("href", `/${c.locale}/r/example`);
    });

    test("has no axe violations and no sideways scroll", async ({ page }) => {
      await open(page, c.locale);
      await costField(page, c).fill(c.typed);
      await page.addScriptTag({ path: AXE_SCRIPT });
      const violations = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (d: Document, o: object) => Promise<{ violations: { id: string; help: string; nodes: { target: string[] }[] }[] }> } }).axe;
        const result = await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
          exclude: [["nextjs-portal"]],
        });
        return result.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
      });
      expect(violations).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}
