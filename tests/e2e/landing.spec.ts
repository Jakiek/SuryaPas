// The landing page (T15), driven in a real browser at 375 px against the dev
// server. Every test that touches storage runs in its own browser context, so
// none of them can read or overwrite another's saved plan.

import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import exampleHouse from "../../data/example-house.json";
import enCommon from "../../messages/en/common.json";
import enLanding from "../../messages/en/landing.json";
import enLocation from "../../messages/en/location.json";
import enPlan from "../../messages/en/plan.json";
import idCommon from "../../messages/id/common.json";
import idLanding from "../../messages/id/landing.json";
import idLocation from "../../messages/id/location.json";
import idPlan from "../../messages/id/plan.json";

const AXE_SCRIPT = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");
const ADDRESS = "Jl. Kaliurang Km 5, Sleman";
const DRAFT_KEY = "suryapas.plan.v1";

const cases = [
  { locale: "id", landing: idLanding, common: idCommon, plan: idPlan, location: idLocation },
  { locale: "en", landing: enLanding, common: enCommon, plan: enPlan, location: enLocation },
] as const;

/** A finished draft for the example house, saved on the step given. */
function savedDraft(step: number, withLocation = true) {
  const { inputs } = exampleHouse;
  return { step, ...inputs, ...(withLocation ? {} : { location: { latitude: null, longitude: null } }), overrides: {} };
}

async function saveDraft(page: Page, draft: object) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [DRAFT_KEY, JSON.stringify(draft)] as const,
  );
}

test("the root path redirects to /id", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/id$/);
});

for (const { locale, landing, common, plan, location } of cases) {
  test.describe(`landing page in ${locale}`, () => {
    test("shows the poster headline, the address field and the example link", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      // The boxed word is part of the headline's text.
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        landing.hero.heading.replace(/<\/?box>/g, ""),
      );
      await expect(page.getByLabel(landing.hero.label)).toBeVisible();
      await expect(page.getByRole("button", { name: landing.hero.button })).toBeVisible();
      await expect(page.getByRole("link", { name: landing.hero.example })).toHaveAttribute("href", `/${locale}/r/example`);
      await expect(page).toHaveTitle(landing.meta.title);
      await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", landing.meta.description);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /opengraph-image/);
      await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", landing.meta.imageAlt);
    });

    // The unit test (src/features/landing/exampleComparison.test.ts) proves the
    // figures equal the engine's output. This one proves what the browser
    // shows equals what the result page of the same house shows, at the same
    // two panel counts: the recommended one and the largest the roof holds.
    test("shows the same figures as the example result at the two panel counts", async ({ page }) => {
      await page.goto(`/${locale}`);
      const group = page.getByRole("group", { name: landing.argument.comparisonLabel });
      const sides = group.locator("> div");
      await expect(sides).toHaveCount(2);

      const shown = async (side: number) => {
        const block = sides.nth(side);
        const value = (label: string) => block.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd").innerText();
        return {
          panels: Number((await block.getByRole("heading", { level: 3 }).innerText()).match(/\d+/)![0]),
          wasted: await value(landing.argument.rows.wasted),
          cost: await value(landing.argument.rows.cost),
          payback: await value(landing.argument.rows.payback),
        };
      };
      const [fits, tooMany] = [await shown(0), await shown(1)];
      expect(tooMany.panels).toBeGreaterThan(fits.panels);

      await page.goto(`/${locale}/r/example`);
      const band = page.locator('[data-band="night"]').first();
      // The recommended count opens on the result page.
      await expect(band).toContainText(fits.cost);
      if (fits.payback !== landing.argument.paybackNever) await expect(band).toContainText(fits.payback);
      await page.getByRole("button", { name: new RegExp(`^${tooMany.panels}\\b`) }).click();
      await expect(band).toContainText(tooMany.cost);
      await expect(page.getByRole("status").first()).toContainText(tooMany.wasted);
      // Whether it pays back is decided in one place; both pages agree.
      if (tooMany.payback === landing.argument.paybackNever) {
        await expect(page.getByRole("note").first()).toBeVisible();
      } else {
        await expect(band).toContainText(tooMany.payback);
      }
    });

    test("links the regulation's text", async ({ page }) => {
      await page.goto(`/${locale}`);
      const link = page.getByRole("link", { name: landing.argument.sourceLink });
      await expect(link).toHaveAttribute("href", /Permen%20ESDM%20Nomor%202%20Tahun%202024\.pdf$/);
    });

    test("an address goes to step 1 through session storage, never the URL", async ({ page }) => {
      // Every URL the browser asks for, to prove the address is in none of them
      // (a URL is kept in server logs and browser history).
      const requested: string[] = [];
      page.on("request", (request) => requested.push(request.url()));
      await page.goto(`/${locale}`);
      await page.getByLabel(landing.hero.label).fill(ADDRESS);
      await page.getByRole("button", { name: landing.hero.button }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/plan$`));
      expect(page.url()).not.toContain("Kaliurang");
      expect(new URL(page.url()).search).toBe("");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(plan.steps.location.heading);
      // Step 1's search field starts with the address.
      await expect(page.getByLabel(location.search.label)).toHaveValue(ADDRESS);
      const encoded = [ADDRESS, encodeURIComponent(ADDRESS), ADDRESS.replace(/ /g, "+"), "Kaliurang"];
      for (const url of requested) {
        for (const form of encoded) expect(url).not.toContain(form);
      }
    });

    test("an empty field starts step 1 with nothing filled", async ({ page }) => {
      await page.goto(`/${locale}`);
      await page.getByRole("button", { name: landing.hero.button }).click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/plan$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(plan.steps.location.heading);
      await expect(page.getByLabel(location.search.label)).toHaveValue("");
    });

    test("the example link reaches a rendered result", async ({ page }) => {
      await page.goto(`/${locale}`);
      await page.getByRole("link", { name: landing.hero.example }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/r/example$`));
      await expect(page.locator('[data-band="night"]').first()).toContainText(/\d/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });

    test("a visitor with a saved plan is offered to continue, at the step they were on", async ({ page }) => {
      await saveDraft(page, savedDraft(3));
      await page.goto(`/${locale}`);
      const next = page.getByRole("link", { name: landing.continue.button });
      await expect(next).toBeVisible();
      // The address form is replaced by the primary action.
      await expect(page.getByRole("button", { name: landing.hero.button })).toHaveCount(0);
      await next.click();

      await expect(page).toHaveURL(new RegExp(`/${locale}/plan$`));
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(plan.steps.electricity.heading);
    });

    test("a saved plan with an earlier step incomplete resumes at that step", async ({ page }) => {
      await saveDraft(page, savedDraft(4, false));
      await page.goto(`/${locale}`);
      await page.getByRole("link", { name: landing.continue.button }).click();
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(plan.steps.location.heading);
    });

    test("a returning visitor can start again with another address", async ({ page }) => {
      await saveDraft(page, savedDraft(3));
      await page.goto(`/${locale}`);
      await page.getByRole("button", { name: landing.continue.startOver }).click();
      await page.getByLabel(landing.hero.label).fill(ADDRESS);
      await page.getByRole("button", { name: landing.hero.button }).click();

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(plan.steps.location.heading);
      await expect(page.getByLabel(location.search.label)).toHaveValue(ADDRESS);
      expect(await page.evaluate((key) => localStorage.getItem(key), DRAFT_KEY)).not.toContain("monthlySpendRp\":[650000]");
    });

    test("a visitor with nothing saved sees the address form", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByRole("link", { name: landing.continue.button })).toHaveCount(0);
      await expect(page.getByRole("button", { name: landing.hero.button })).toBeVisible();
    });

    test("loads no map code", async ({ page }) => {
      const scripts: string[] = [];
      const requested: string[] = [];
      page.on("request", (request) => requested.push(request.url()));
      page.on("response", async (response) => {
        if (response.request().resourceType() === "script") {
          scripts.push(await response.text().catch(() => ""));
        }
      });
      await page.goto(`/${locale}`, { waitUntil: "networkidle" });

      expect(requested.filter((url) => /maplibre|openfreemap|arcgis|esri|tiles/i.test(url))).toEqual([]);
      expect(scripts.length).toBeGreaterThan(0);
      expect(scripts.filter((code) => /maplibre/i.test(code))).toHaveLength(0);
    });

    test("has no axe violations and no horizontal scroll", async ({ page }) => {
      await page.goto(`/${locale}`);
      await expect(page.getByRole("heading", { level: 2 })).toHaveText(landing.argument.heading);
      await page.addScriptTag({ path: AXE_SCRIPT });
      const violations: string[] = await page.evaluate(async () => {
        type Axe = { run: (c: Document, o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> };
        const axe = (window as unknown as { axe: Axe }).axe;
        const result = await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
          exclude: [["nextjs-portal"]],
        });
        return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
      });
      expect(violations).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // The footer carries the standing "estimate, not a quote" line.
      await expect(page.locator("footer")).toContainText(common.footer.disclaimer);
    });
  });
}
