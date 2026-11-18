// The failure cases of SPEC 2.5, one test each, in both languages where a
// person sees words. "Saving fails" needs a database that is down, so it has
// its own spec and its own server: store-down.spec.ts.
//
// The sun-data cases are real: the test server's outside requests are answered
// by tests/e2e/support/server-fixtures.cjs, which makes NASA POWER answer 503
// around Makassar and never answer around Medan.

import { expect, test } from "@playwright/test";
import exampleHouse from "../../data/example-house.json";
import { COPIES, templateToRegExp } from "./support/copy";
import { DRAFT_KEY, HOUSE, expectPlausible, nextButton, readHeadline, runJourney } from "./support/journey";

const KUALA_LUMPUR = { latitude: 3.139, longitude: 101.6869 };

for (const c of COPIES) {
  test.describe(`failure cases in ${c.locale}`, () => {
    // SPEC 2.5, "Pin outside Indonesia": step 1 blocks with a message.
    test("a pin outside Indonesia blocks step 1, and the server refuses it too", async ({ page }) => {
      await page.addInitScript(
        ([key, pin]) => localStorage.setItem(key, JSON.stringify({ step: 1, location: pin })),
        [DRAFT_KEY, KUALA_LUMPUR] as const,
      );
      await page.goto(`/${c.locale}/plan`);
      await expect(page.getByText(c.location.outside.title)).toBeVisible();
      await expect(nextButton(page, c, "location")).toBeDisabled();

      // The browser is not the only line of defence: a request made by hand is refused as well.
      const response = await page.request.post("/api/assessments", {
        data: { inputs: { ...exampleHouse.inputs, location: KUALA_LUMPUR }, overrides: {}, locale: c.locale },
      });
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error: "outside_indonesia" });
    });

    // SPEC 2.5, "Roof too small": the result explains and states the area the smallest system needs.
    test("a roof too small for the smallest system gets an explanation and the area it needs", async ({ page }) => {
      await runJourney(page, c, HOUSE.address, { areaM2: 4 });
      const main = page.locator("main");
      await expect(main.getByRole("heading", { name: c.result.tooSmall.heading })).toBeVisible();
      // "The smallest system needs about N m² of roof. The roof you marked is 4 m²."
      const body = main.getByText(templateToRegExp(c.result.tooSmall.body));
      await expect(body).toBeVisible();
      const required = Number((await body.innerText()).match(/about ([\d.,]+)|sekitar ([\d.,]+)/)!.slice(1).find(Boolean)!.replace(",", "."));
      expect(required).toBeGreaterThan(4);
      expect(required).toBeLessThan(50);
      await expect(main.getByText(c.result.tooSmall.hint)).toBeVisible();
      // No system is recommended, so there is no payback to show.
      await expect(page.locator('[data-band="night"]').getByText(c.result.verdict.payback, { exact: false })).toHaveCount(0);
    });

    // SPEC 2.5, "Sun-data service ... down": the nearest city's bundled figures, labelled approximate.
    test("sun data down: the result still comes, labelled approximate", async ({ page }) => {
      await runJourney(page, c, "Pantai Losari, Makassar");
      await expect(page.getByText(c.result.warnings.approximate.title)).toBeVisible();
      await expect(page.getByText(c.result.warnings.approximate.body)).toBeVisible();
      expectPlausible(await readHeadline(page, c), HOUSE.areaM2);
    });

    // SPEC 2.5, "Sun-data service slow": the same, after the service's time limit.
    test("sun data slow: the result still comes after the time limit, labelled approximate", async ({ page }) => {
      test.setTimeout(90_000);
      await runJourney(page, c, "Istana Maimun, Medan");
      await expect(page.getByText(c.result.warnings.approximate.title)).toBeVisible();
      expectPlausible(await readHeadline(page, c), HOUSE.areaM2);
    });
  });
}

test("a slow sun service is cut off at its time limit, not waited for", async ({ page }) => {
  test.setTimeout(60_000);
  const started = Date.now();
  const response = await page.request.get("/api/sun?lat=3.58&lon=98.67"); // Medan
  const seconds = (Date.now() - started) / 1000;
  const body = await response.json();
  expect(body.source).toBe("fallback");
  // The service waits 8 s for NASA, then answers from the bundled file.
  expect(seconds).toBeGreaterThan(7);
  expect(seconds).toBeLessThan(20);

  const live = await (await page.request.get("/api/sun?lat=-7.78&lon=110.37")).json(); // Yogyakarta, from the fixture
  expect(live.source).toBe("live");
});

test("with a working store the route saves, and answers with the id alone", async ({ page }) => {
  // The counterpart of store-down.spec.ts: with a working store the route saves, and says so.
  const response = await page.request.post("/api/assessments", {
    data: { inputs: exampleHouse.inputs, overrides: {}, locale: "id" },
  });
  expect(response.status()).toBe(201);
  expect(Object.keys(await response.json())).toEqual(["id"]);
});
