// The whole product, from the landing page to a result, at 375 px, against the
// production build with sun data and address search served from fixtures.
// The per-screen specs prove each screen; these prove the screens join up.

import { expect, test, type Page } from "@playwright/test";
import { BASE_URL } from "./support/server";
import { COPIES } from "./support/copy";
import {
  DRAFT_KEY,
  HOUSE,
  expectPlausible,
  finishFlow,
  nextButton,
  pickFirstAddress,
  readHeadline,
  runJourney,
  startFromLanding,
  stepHeading,
} from "./support/journey";

/** Every response that came from outside the test server. There must be none. */
function watchOutsideResponses(page: Page): string[] {
  const outside: string[] = [];
  page.on("response", (response) => {
    if (!response.url().startsWith(BASE_URL) && !response.url().startsWith("data:") && !response.url().startsWith("blob:")) {
      outside.push(response.url());
    }
  });
  return outside;
}

for (const c of COPIES) {
  test.describe(`journey in ${c.locale}`, () => {
    test("landing, four steps by typing the roof area, submit, result with plausible headline numbers", async ({ page }) => {
      const outside = watchOutsideResponses(page);

      await startFromLanding(page, c);
      // The address typed on the landing page is waiting in step 1's search box.
      await expect(page.getByLabel(c.location.search.label)).toHaveValue(HOUSE.address);
      await pickFirstAddress(page, c);
      await expect(page.getByText(c.plan.privacy)).toHaveCount(0); // the privacy line belongs to step 4

      await finishFlow(page, c);
      await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/[A-Za-z0-9_-]{22}$`), { timeout: 30_000 });

      // The result: the page is in the language we started in, and shows a saved result.
      await expect(page.locator("html")).toHaveAttribute("lang", c.locale);
      await expectPlausible(await readHeadline(page, c), HOUSE.areaM2);
      // Sun data came from the (fixture) live service, so nothing says "approximate".
      await expect(page.getByText(c.result.warnings.approximate.title)).toHaveCount(0);
      // A saved result can be shared and changed by the browser that made it.
      await expect(page.getByRole("button", { name: c.result.actions.copy })).toBeVisible();
      await expect(page.getByRole("link", { name: c.result.actions.edit })).toBeVisible();

      expect(outside).toEqual([]);
    });

    test("the example path: landing, example link, a result", async ({ page }) => {
      await page.goto(`/${c.locale}`);
      await page.getByRole("link", { name: c.landing.hero.example }).click();
      await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/example$`));
      await expectPlausible(await readHeadline(page, c), 1000);
      await expect(page.getByText(c.result.actions.exampleNote)).toBeVisible();
    });

    test("resume: two steps filled, a reload, and every answer is back", async ({ page }) => {
      await startFromLanding(page, c);
      await pickFirstAddress(page, c);
      await nextButton(page, c, "location").click();
      await page.getByRole("button", { name: c.roof.area.switchToType }).click();
      await page.getByLabel(c.roof.area.label).fill(String(HOUSE.areaM2));
      await page.getByRole("radio", { name: c.roof.slope.steep }).check();
      await page.getByRole("radio", { name: c.roof.facing.west }).check();
      await page.getByRole("radio", { name: c.roof.shade.some }).check();
      await nextButton(page, c, "roof").click();
      await stepHeading(page, c, "electricity");

      await page.reload();

      // Back at the step the visit stopped on...
      await stepHeading(page, c, "electricity");
      // ...with the roof answers still there one step back...
      await page.getByRole("button", { name: c.plan.nav.back }).click();
      await stepHeading(page, c, "roof");
      await expect(page.getByLabel(c.roof.area.label)).toHaveValue(String(HOUSE.areaM2));
      await expect(page.getByRole("radio", { name: c.roof.slope.steep })).toBeChecked();
      await expect(page.getByRole("radio", { name: c.roof.facing.west })).toBeChecked();
      await expect(page.getByRole("radio", { name: c.roof.shade.some })).toBeChecked();
      // ...and the pin of step 1, so "next" is enabled without searching again.
      await page.getByRole("button", { name: c.plan.nav.back }).click();
      await stepHeading(page, c, "location");
      await expect(nextButton(page, c, "location")).toBeEnabled();
      const draft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), DRAFT_KEY);
      expect(draft.location.latitude).toBeCloseTo(-7.76, 1);
      expect(draft.roof.areaM2).toBe(HOUSE.areaM2);
    });

    test("a returning visitor is offered the saved plan on the landing page", async ({ page }) => {
      await startFromLanding(page, c);
      await pickFirstAddress(page, c);
      await nextButton(page, c, "location").click();
      await stepHeading(page, c, "roof");
      await page.goto(`/${c.locale}`);
      await page.getByRole("link", { name: c.landing.continue.button }).click();
      await stepHeading(page, c, "roof");
    });
  });
}

test("the same journey in the other language gives the same panel count", async ({ browser }) => {
  // Two fresh browsers, one per language, run the same house; the engine does not care which language asked.
  const counts: number[] = [];
  for (const c of COPIES) {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 }, baseURL: BASE_URL });
    const page = await context.newPage();
    await runJourney(page, c);
    counts.push((await readHeadline(page, c)).panels);
    await context.close();
  }
  expect(counts[0]).toBe(counts[1]);
});
