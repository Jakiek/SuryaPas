// The whole journey with the keyboard alone (SPEC 6 item 4): landing, four
// steps through the typed-area path, submit, and exploring the result. A
// listener counts pointer events, so a stray mouse click cannot slip in.

import { expect, test } from "@playwright/test";
import { COPIES } from "./support/copy";
import { HOUSE, countPointerEvents, expectPlausible, grouped, readHeadline, stepHeading, tabTo, nextButton } from "./support/journey";

for (const c of COPIES) {
  test(`keyboard only, landing to result and a new panel count, in ${c.locale}`, async ({ page }) => {
    const pointerEvents = await countPointerEvents(page);
    await page.goto(`/${c.locale}`);

    // Landing: the address field, then Enter sends the form.
    await tabTo(page, c.landing.hero.label);
    await page.keyboard.type(HOUSE.address);
    await page.keyboard.press("Enter");

    // Step 1: the search lists results; arrow down and Enter choose one.
    await expect(page.getByRole("option").first()).toBeVisible();
    await tabTo(page, c.location.search.label);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(nextButton(page, c, "location")).toBeEnabled();
    await tabTo(page, c.plan.steps.location.next);
    await page.keyboard.press("Enter");

    // Step 2: type the area (the keyboard path), then slope, facing, shade.
    await stepHeading(page, c, "roof");
    await tabTo(page, c.roof.area.switchToType);
    await page.keyboard.press("Enter"); // the cursor moves into the area field
    await page.keyboard.type(String(HOUSE.areaM2));
    await tabTo(page, c.roof.slope.flat);
    await page.keyboard.press("ArrowRight"); // flat -> gentle
    await tabTo(page, c.roof.facing.north);
    await page.keyboard.press("ArrowRight"); // north -> east
    await tabTo(page, c.roof.shade.none);
    await page.keyboard.press("Space");
    await expect(nextButton(page, c, "roof")).toBeEnabled();
    await tabTo(page, c.plan.steps.roof.next);
    await page.keyboard.press("Enter");

    // Step 3: the power class by type-ahead in the select, then the bill.
    await stepHeading(page, c, "electricity");
    await tabTo(page, c.plan.electricity.power.label);
    await page.keyboard.type(grouped(c, HOUSE.connectedVa).slice(0, 3)); // "2.2" or "2,2"
    await tabTo(page, c.plan.electricity.spend.postpaid.single);
    await page.keyboard.type(String(HOUSE.monthlyBillRp));
    await expect(nextButton(page, c, "electricity")).toBeEnabled();
    await page.keyboard.press("Enter");

    // Step 4: Yes to each of the four questions, then submit.
    await stepHeading(page, c, "lifestyle");
    for (let question = 0; question < 4; question++) {
      await tabTo(page, c.plan.lifestyle.yes);
      await page.keyboard.press("Space");
    }
    await expect(nextButton(page, c, "lifestyle")).toBeEnabled();
    await tabTo(page, c.plan.steps.lifestyle.next);
    await page.keyboard.press("Enter");

    // The result, and a different panel count chosen from the picker with Enter.
    await expect(page).toHaveURL(new RegExp(`/${c.locale}/r/[A-Za-z0-9_-]{22}$`), { timeout: 30_000 });
    const recommended = await readHeadline(page, c);
    expectPlausible(recommended, HOUSE.areaM2, { paysBack: true });
    for (let presses = 0; presses < 80; presses++) {
      await page.keyboard.press("Tab");
      if (await page.evaluate(() => document.activeElement?.getAttribute("aria-pressed") === "false")) break;
    }
    await page.keyboard.press("Enter");
    await expect(page.locator("h1")).toContainText(c.result.verdict.ledeChosen, { ignoreCase: true });
    const chosen = await readHeadline(page, c);
    expect(chosen.panels).not.toBe(recommended.panels);

    // Not one pointer event in the whole journey.
    expect(await pointerEvents()).toEqual([]);
  });
}
