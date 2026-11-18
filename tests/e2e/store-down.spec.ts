// SPEC 2.5, "Saving fails". This spec runs against the second test server
// (see playwright.config.ts), whose database answers every call with an error, as a
// paused free Supabase project does. Reading the sun cache and writing the
// assumption set and the result all fail, so the route must compute the result
// anyway and return it marked as not saved.

import { expect, test } from "@playwright/test";
import exampleHouse from "../../data/example-house.json";
import { COPIES } from "./support/copy";
import { HOUSE, UNSAVED_KEY, expectPlausible, readHeadline, submitJourney } from "./support/journey";

test("the route computes the result and says it was not saved", async ({ request }) => {
  const response = await request.post("/api/assessments", {
    data: { inputs: exampleHouse.inputs, overrides: {}, locale: "id" },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.saved).toBe(false);
  expect(body.id).toBeUndefined();
  expect(body.assessment.candidates.length).toBeGreaterThan(1);
});

for (const c of COPIES) {
  test(`the journey ends on the not-saved result, with the note and a retry, in ${c.locale}`, async ({ page }) => {
    await submitJourney(page, c);
    await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/unsaved$`), { timeout: 30_000 });

    // The report is there, with the note that there is no share link.
    await expectPlausible(await readHeadline(page, c), HOUSE.areaM2);
    await expect(page.getByText(c.result.unsaved.title)).toBeVisible();
    await expect(page.getByText(c.result.unsaved.body)).toBeVisible();
    await expect(page.getByRole("button", { name: c.result.actions.copy })).toHaveCount(0);
    // The tab keeps the result for the session.
    expect(await page.evaluate((key) => sessionStorage.getItem(key) !== null, UNSAVED_KEY)).toBe(true);
    await page.reload();
    await expectPlausible(await readHeadline(page, c), HOUSE.areaM2);

    // Retrying while the database is still down says so and keeps the result.
    await page.getByRole("button", { name: c.result.unsaved.retry }).click();
    await expect(page.getByText(c.result.unsaved.stillUnsaved)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/unsaved$`));
  });
}
