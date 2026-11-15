// The input flow (T10), driven in a real browser at 375 px. These are the
// component-level checks the task asks for (wording change, months up to
// twelve, next-button gating) plus restore, keyboard-only and submit.
// They live here, not beside the components, because Vitest has no DOM and
// no "@/" alias in this repo.

import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en/plan.json";
import id from "../../messages/id/plan.json";

const LOCALES = [
  { locale: "id", m: id, decimalComma: true, typedPower: "2.2", rupiahGrouped: "12.500.000" },
  { locale: "en", m: en, decimalComma: false, typedPower: "2,2", rupiahGrouped: "12,500,000" },
] as const;

type Copy = (typeof LOCALES)[number];

const next = (page: Page, c: Copy, step: keyof typeof id.steps) =>
  page.getByRole("button", { name: c.m.steps[step].next });

/** Steps 1 and 2: the placeholder inputs, filled with the mouse. */
async function fillLocationAndRoof(page: Page, c: Copy) {
  const point = (n: string) => (c.decimalComma ? n.replace(".", ",") : n);
  await page.getByLabel(c.m.location.latitude.label).fill(point("-7.78"));
  await page.getByLabel(c.m.location.longitude.label).fill(point("110.37"));
  await next(page, c, "location").click();

  await page.getByLabel(c.m.roof.area.label).fill("48");
  await page.getByRole("radio", { name: c.m.roof.slope.gentle }).check();
  await page.getByRole("radio", { name: c.m.roof.facing.east }).check();
  await page.getByRole("radio", { name: c.m.roof.shade.none }).check();
  await next(page, c, "roof").click();
}

async function fillElectricity(page: Page, c: Copy) {
  await page.getByLabel(c.m.electricity.power.label).selectOption({ label: c.m.electricity.power.option.replace("{va}", c.locale === "id" ? "2.200" : "2,200") });
  await page.getByLabel(c.m.electricity.spend.postpaid.single).fill("650000");
  await next(page, c, "electricity").click();
}

async function answerLifestyle(page: Page, c: Copy) {
  for (const q of ["homeOnWeekdays", "daytimeAc", "workFromHome", "electricVehicle"] as const) {
    const group = page.getByRole("group", { name: c.m.lifestyle[q].legend });
    await group.getByRole("radio", { name: c.m.lifestyle.yes }).check();
  }
}

for (const c of LOCALES) {
  test.describe(`plan flow in ${c.locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/${c.locale}/plan`);
      await page.evaluate(() => localStorage.clear());
      await page.reload();
    });

    test("next stays disabled until the step is valid, and errors name the fix", async ({ page }) => {
      const nextButton = next(page, c, "location");
      await expect(nextButton).toBeDisabled();
      const latitude = page.getByLabel(c.m.location.latitude.label);
      await latitude.fill("abc");
      await latitude.blur();
      await expect(page.getByText(c.m.errors.latitudeInvalid)).toBeVisible();
      await latitude.fill("200");
      await expect(nextButton).toBeDisabled();
      await latitude.fill(c.decimalComma ? "-7,78" : "-7.78");
      await page.getByLabel(c.m.location.longitude.label).fill(c.decimalComma ? "110,37" : "110.37");
      await expect(nextButton).toBeEnabled();
    });

    test("the electricity wording follows prepaid or postpaid", async ({ page }) => {
      await fillLocationAndRoof(page, c);
      const spend = c.m.electricity.spend;
      await expect(page.getByText(spend.postpaid.legend)).toBeVisible();
      await page.getByRole("radio", { name: c.m.electricity.billing.prepaid }).check();
      await expect(page.getByText(spend.prepaid.legend)).toBeVisible();
      await expect(page.getByText(spend.postpaid.legend)).toHaveCount(0);
      await page.getByRole("radio", { name: c.m.electricity.billing.postpaid }).check();
      await expect(page.getByText(spend.postpaid.legend)).toBeVisible();
    });

    test("months can be added up to twelve and no further", async ({ page }) => {
      await fillLocationAndRoof(page, c);
      const add = page.getByRole("button", { name: c.m.electricity.spend.addMonth });
      const fields = page.locator("input[name^='month-']");
      await expect(fields).toHaveCount(1);
      for (let n = 2; n <= 12; n++) {
        await add.click();
        await expect(fields).toHaveCount(n);
      }
      await expect(add).toBeDisabled();
      await expect(page.getByText(c.m.electricity.spend.fullYearNote)).toBeVisible();
      // With twelve fields the labels are month names, January first.
      await expect(page.getByLabel(c.locale === "id" ? "Januari" : "January")).toBeVisible();
      await expect(page.getByLabel(c.locale === "id" ? "Desember" : "December")).toBeVisible();
      await page.getByRole("button", { name: c.m.electricity.spend.removeMonth }).click();
      await expect(fields).toHaveCount(11);
      await expect(add).toBeEnabled();
    });

    test("rupiah is accepted with or without separators and shown grouped", async ({ page }) => {
      await fillLocationAndRoof(page, c);
      await page.getByLabel(c.m.electricity.power.label).selectOption("2200");
      const field = page.getByLabel(c.m.electricity.spend.postpaid.single);
      await expect(field).toHaveAttribute("placeholder", c.m.electricity.spend.placeholder.replace("{amount}", c.locale === "id" ? "650.000" : "650,000"));
      for (const typed of ["12500000", "12.500.000", "12,500,000"]) {
        await field.fill(typed);
        await field.blur(); // the text is rewritten grouped when the user leaves the field
        await expect(field).toHaveValue(c.rupiahGrouped);
      }
      for (const typed of ["12,5", "650.000,50"]) {
        await field.fill(typed);
        await field.blur();
        await expect(page.getByText(c.m.errors.billNotWhole)).toBeVisible();
      }
      await field.fill("0");
      await field.blur();
      await expect(page.getByText(c.m.errors.billZero)).toBeVisible();
      await field.fill("6500000"); // an extra zero on 2,200 VA
      await field.blur();
      await expect(page.getByText(c.m.errors.billTooHigh)).toBeVisible();
      await field.fill("");
      await field.blur();
      await expect(page.getByText(c.m.errors.billRequired)).toBeVisible();
    });

    test("a refresh restores the step and every value", async ({ page }) => {
      await fillLocationAndRoof(page, c);
      await page.getByRole("radio", { name: c.m.electricity.billing.prepaid }).check();
      await page.getByLabel(c.m.electricity.power.label).selectOption({ index: 1 });
      await page.getByLabel(c.m.electricity.spend.prepaid.single).fill("100000");
      await page.getByRole("button", { name: c.m.electricity.spend.addMonth }).click();
      await page.getByLabel(c.m.electricity.spend.monthLabel.replace("{number}", "2")).fill("120000");

      await page.reload();

      await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.m.steps.electricity.heading, { ignoreCase: true });
      await expect(page.getByRole("radio", { name: c.m.electricity.billing.prepaid })).toBeChecked();
      await expect(page.getByLabel(c.m.electricity.power.label)).toHaveValue("450-subsidised");
      await expect(page.getByLabel(c.m.electricity.spend.monthLabel.replace("{number}", "1"))).toHaveValue(c.locale === "id" ? "100.000" : "100,000");
      await expect(page.getByLabel(c.m.electricity.spend.monthLabel.replace("{number}", "2"))).toHaveValue(c.locale === "id" ? "120.000" : "120,000");
      // Back to step 2: the roof answers are still there.
      await page.getByRole("button", { name: c.m.nav.back }).click();
      await expect(page.getByLabel(c.m.roof.area.label)).toHaveValue("48");
    });

    test("submitting sends a valid body and goes to the result", async ({ page }) => {
      let body: unknown;
      await page.route("**/api/assessments", async (route) => {
        body = route.request().postDataJSON();
        await route.fulfill({ json: { id: "abc123" } });
      });
      await fillLocationAndRoof(page, c);
      await fillElectricity(page, c);
      await expect(page.getByText(c.m.privacy)).toBeVisible(); // step 4 shows it above the submit
      await answerLifestyle(page, c);
      await expect(page.getByText(c.m.privacy)).toBeVisible();
      await next(page, c, "lifestyle").click();
      await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/abc123$`), { timeout: 20_000 });
      expect(body).toMatchObject({
        locale: c.locale,
        inputs: {
          electricity: { billing: "postpaid", connectedVa: 2200, subsidised: false, monthlySpendRp: [650000] },
          roof: { areaM2: 48, facing: "E", slope: "gentle", shade: "none" },
        },
      });
    });

    test("a failed submit keeps the answers and offers a retry", async ({ page }) => {
      let attempts = 0;
      await page.route("**/api/assessments", async (route) => {
        attempts += 1;
        if (attempts === 1) await route.abort();
        else await route.fulfill({ json: { id: "abc123" } });
      });
      await fillLocationAndRoof(page, c);
      await fillElectricity(page, c);
      await answerLifestyle(page, c);
      await next(page, c, "lifestyle").click();
      await expect(page.getByText(c.m.submitFailed.title)).toBeVisible();
      await expect(page.getByRole("radio", { name: c.m.lifestyle.yes }).first()).toBeChecked();
      await page.getByRole("button", { name: c.m.nav.retry }).click();
      await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/abc123$`), { timeout: 20_000 });
    });

    test("a restored pair that the select does not offer is reset", async ({ page }) => {
      await page.evaluate(() =>
        localStorage.setItem("suryapas.plan.v1", JSON.stringify({ step: 3, electricity: { connectedVa: 2200, subsidised: true, monthlySpendRp: [100000] } })),
      );
      await page.reload();
      await expect(page.getByLabel(c.m.electricity.power.label)).toHaveValue("");
    });

    test("step 4 restored over an empty draft sends the user to the step to fix", async ({ page }) => {
      await page.evaluate(() => {
        const yes = { homeOnWeekdays: true, daytimeAc: true, workFromHome: true, electricVehicle: true };
        localStorage.setItem("suryapas.plan.v1", JSON.stringify({ step: 4, lifestyle: yes }));
      });
      await page.reload();
      await next(page, c, "lifestyle").click();
      await expect(page.getByText(c.m.submitInvalid.title)).toBeVisible();
      await expect(page.getByText(c.m.submitFailed.title)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.m.steps.location.heading, { ignoreCase: true });
    });

    test("an unanswered radio question shows its own message once passed", async ({ page }) => {
      await page.evaluate(() => localStorage.setItem("suryapas.plan.v1", JSON.stringify({ step: 4 })));
      await page.reload();
      const last = page.getByRole("group", { name: c.m.lifestyle.electricVehicle.legend });
      await last.getByRole("radio", { name: c.m.lifestyle.yes }).check();
      // The first three were skipped; each says so under its own question.
      await expect(page.getByText(c.m.errors.answerRequired)).toHaveCount(3);
    });

    test("the form stops at the 680 px measure on a wide screen", async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 900 });
      const width = await page.locator("main form").evaluate((el) => el.getBoundingClientRect().width);
      expect(width).toBeLessThanOrEqual(680);
    });

    test("the whole flow can be completed with the keyboard alone", async ({ page }) => {
      let body: { inputs?: { electricity?: { connectedVa?: number } } } | undefined;
      await page.route("**/api/assessments", async (route) => {
        body = route.request().postDataJSON();
        await route.fulfill({ json: { id: "kbd1" } });
      });

      /** Presses Tab until the focused control's label contains the text. */
      async function tabTo(label: string) {
        for (let i = 0; i < 60; i++) {
          await page.keyboard.press("Tab");
          const focused = await page.evaluate(() => {
            const el = document.activeElement as HTMLInputElement | HTMLButtonElement | null;
            const own = el?.labels?.[0]?.textContent ?? el?.textContent ?? "";
            return own;
          });
          if (focused.includes(label)) return;
        }
        throw new Error(`Tab never reached "${label}"`);
      }

      await tabTo(c.m.location.latitude.label);
      await page.keyboard.type(c.decimalComma ? "-7,78" : "-7.78");
      await page.keyboard.press("Tab");
      await page.keyboard.type(c.decimalComma ? "110,37" : "110.37");
      await expect(next(page, c, "location")).toBeEnabled();
      await page.keyboard.press("Enter"); // Enter in a field submits the step

      await tabTo(c.m.roof.area.label);
      await page.keyboard.type("48");
      await tabTo(c.m.roof.slope.flat);
      await page.keyboard.press("ArrowRight"); // flat -> gentle
      await tabTo(c.m.roof.facing.north);
      await page.keyboard.press("ArrowRight"); // north -> east
      await tabTo(c.m.roof.shade.none);
      await page.keyboard.press("Space");
      await expect(next(page, c, "roof")).toBeEnabled();
      await tabTo(c.m.steps.roof.next);
      await page.keyboard.press("Enter");

      await tabTo(c.m.electricity.power.label);
      await page.keyboard.type(c.typedPower); // select type-ahead: 2.200 VA
      await tabTo(c.m.electricity.spend.postpaid.single);
      await page.keyboard.type("650000");
      await expect(next(page, c, "electricity")).toBeEnabled();
      await page.keyboard.press("Enter");

      for (const q of ["homeOnWeekdays", "daytimeAc", "workFromHome", "electricVehicle"] as const) {
        await tabTo(c.m.lifestyle.yes);
        void q;
        await page.keyboard.press("Space");
      }
      await expect(next(page, c, "lifestyle")).toBeEnabled();
      await tabTo(c.m.steps.lifestyle.next);
      await page.keyboard.press("Enter");

      await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/kbd1$`), { timeout: 20_000 });
      expect(body?.inputs?.electricity?.connectedVa).toBe(2200);
    });
  });
}
