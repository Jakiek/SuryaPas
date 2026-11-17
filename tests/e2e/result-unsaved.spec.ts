// The result the server computed but could not save (SPEC 2.5 "Saving fails"),
// shown at /r/unsaved from what the tab kept in sessionStorage.
//
// Each test uses a fresh browser context, so its sessionStorage is empty until
// the test seeds the key itself, and nothing in the shared browser is touched.
// The retry is answered by a stubbed route, so the test does not depend on the
// dev server's store.

import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Browser } from "@playwright/test";
import exampleHouse from "../../data/example-house.json";
import en from "../../messages/en/result.json";
import id from "../../messages/id/result.json";
import { assess, CURRENT_ASSUMPTIONS, type EngineInputs } from "../../src/engine";

const UNSAVED_KEY = "suryapas.result.unsaved.v1";
const HOUSE = exampleHouse.inputs as EngineInputs;
const messages = { id, en } as const;

/** What the browser keeps after an unsaved answer: the request and the engine's output. */
async function keptResult() {
  // The bundled Yogyakarta year (read as a file: Node's test runner cannot import json directly).
  const file = path.join(process.cwd(), "data/sun-fallback/yogyakarta.json");
  const { series } = JSON.parse(readFileSync(file, "utf8")) as { series: number[] };
  const assessment = assess(HOUSE, { ghiWm2: series, source: "live" }, CURRENT_ASSUMPTIONS);
  return { request: { inputs: HOUSE, overrides: {}, locale: "id" }, assessment };
}

/** A fresh context, optionally with the unsaved result already in its sessionStorage. */
async function freshPage(browser: Browser, kept: unknown | null) {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
  if (kept !== null) {
    await context.addInitScript(
      ([key, value]) => {
        if (sessionStorage.getItem(key) === null) sessionStorage.setItem(key, value);
      },
      [UNSAVED_KEY, JSON.stringify(kept)],
    );
  }
  return { context, page: await context.newPage() };
}

for (const locale of ["id", "en"] as const) {
  const m = messages[locale];

  test.describe(`not-saved result (${locale})`, () => {
    test("shows the note and the retry, and hides the copy-link button and the assumptions link", async ({ browser }) => {
      const { context, page } = await freshPage(browser, await keptResult());
      await page.goto(`/${locale}/r/unsaved`);

      await expect(page.getByText(m.unsaved.title)).toBeVisible();
      await expect(page.getByText(m.unsaved.body)).toBeVisible();
      await expect(page.getByRole("button", { name: m.unsaved.retry })).toBeVisible();

      // The report itself is there...
      await expect(page.locator("h1")).toContainText(/\d+ panel/i);
      await expect(page.getByRole("button", { name: new RegExp(m.actions.quote) })).toBeVisible();
      // ...but there is no link to share and no saved id for the assumptions screen.
      await expect(page.getByRole("button", { name: m.actions.copy })).toHaveCount(0);
      await expect(page.getByRole("link", { name: m.actions.assumptions })).toHaveCount(0);
      await context.close();
    });

    test("a retry that is not saved either says so and keeps the result", async ({ browser }) => {
      const kept = await keptResult();
      const { context, page } = await freshPage(browser, kept);
      await page.route("**/api/assessments", (route) =>
        route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ saved: false, assessment: kept.assessment }) }),
      );
      await page.goto(`/${locale}/r/unsaved`);

      await page.getByRole("button", { name: m.unsaved.retry }).click();
      await expect(page.getByText(m.unsaved.stillUnsaved)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`/${locale}/r/unsaved$`));
      await expect(page.getByRole("button", { name: m.unsaved.retry })).toBeVisible();
      await context.close();
    });

    test("a retry that is saved moves to the saved link", async ({ browser }) => {
      const { context, page } = await freshPage(browser, await keptResult());
      await page.route("**/api/assessments", (route) =>
        route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: "A".repeat(22) }) }),
      );
      await page.goto(`/${locale}/r/unsaved`);
      await page.getByRole("button", { name: m.unsaved.retry }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/r/${"A".repeat(22)}$`));
      await context.close();
    });

    test("with nothing kept, the empty state explains and offers to plan again", async ({ browser }) => {
      const { context, page } = await freshPage(browser, null);
      await page.goto(`/${locale}/r/unsaved`);

      await expect(page.getByRole("heading", { name: m.unsaved.emptyTitle })).toBeVisible();
      await expect(page.getByText(m.unsaved.emptyBody)).toBeVisible();
      await expect(page.getByRole("link", { name: m.unsaved.emptyAction })).toBeVisible();
      // No result, so no note, no retry and no report.
      await expect(page.getByRole("button", { name: m.unsaved.retry })).toHaveCount(0);
      await expect(page.getByRole("button", { name: m.actions.copy })).toHaveCount(0);
      await context.close();
    });
  });
}
