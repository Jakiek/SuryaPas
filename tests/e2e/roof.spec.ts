// The roof step (T12), at 375 px with touch emulation: trace a roof with
// taps, correct a corner by dragging it, close the shape, then check that
// flat hides facing and that the typed path works. Run with
// `npx playwright test tests/e2e/roof.spec.ts` (not part of `npm run check`).

import { expect, test, type Page } from "@playwright/test";
import enRoof from "../../messages/en/roof.json";
import enPlan from "../../messages/en/plan.json";
import idRoof from "../../messages/id/roof.json";
import idPlan from "../../messages/id/plan.json";

const LOCALES = [
  { locale: "id", r: idRoof, plan: idPlan },
  { locale: "en", r: enRoof, plan: enPlan },
] as const;
type Copy = (typeof LOCALES)[number];

// Zoom 19.5 at -7.78 degrees: metres per pixel on screen (Web Mercator).
const METRES_PER_PIXEL = (40_075_016 * Math.cos((7.78 * Math.PI) / 180)) / (512 * 2 ** 19.5);

async function openRoofStep(page: Page, c: Copy) {
  await page.route("**/api/geocode*", (route) =>
    route.fulfill({ json: [{ label: "Jalan Malioboro, Yogyakarta", lat: -7.78, lon: 110.37 }] }),
  );
  await page.route("**/tiles.openfreemap.org/**", (route) => route.abort());
  await page.goto(`/${c.locale}/plan`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("combobox").fill("Malioboro");
  await page.getByRole("option").first().click();
  await page.getByRole("button", { name: c.plan.steps.location.next }).click();
}

/** A one-finger drag, sent as real touch events through the browser's protocol. */
async function touchDrag(page: Page, from: [number, number], to: [number, number]) {
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", [x, y]: [number, number]) =>
    cdp.send("Input.dispatchTouchEvent", {
      type,
      touchPoints: type === "touchEnd" ? [] : [{ x, y }],
    });
  await touch("touchStart", from);
  for (let step = 1; step <= 8; step++) {
    const along = step / 8;
    await touch("touchMove", [from[0] + (to[0] - from[0]) * along, from[1] + (to[1] - from[1]) * along]);
  }
  await touch("touchEnd", to);
}

for (const c of LOCALES) {
  test.describe(`roof step in ${c.locale}`, () => {
    test.use({ hasTouch: true });

    test("trace with taps, correct a corner by dragging, close the shape", async ({ page }) => {
      await openRoofStep(page, c);
      const map = page.locator(".roof-map");
      await map.scrollIntoViewIfNeeded();
      const box = (await map.boundingBox())!;
      const left = box.x + 80;
      const top = box.y + 120;

      // A rectangle 200 x 100 px on screen.
      const corners: [number, number][] = [
        [left, top],
        [left + 200, top],
        [left + 200, top + 100],
        [left, top + 100],
      ];
      for (const [x, y] of corners) await page.touchscreen.tap(x, y);
      await expect(page.getByRole("status").filter({ hasText: /4/ })).toBeVisible();
      await expect(page.locator(".roof-handle")).toHaveCount(4);

      const tag = page.locator(".roof-map + div");
      const expected = 200 * METRES_PER_PIXEL * 100 * METRES_PER_PIXEL;
      const shown = async () =>
        Number((await tag.innerText()).replace(/[^\d.,]/g, "").replace(",", ".").replace(/^\./, ""));
      expect(Math.abs((await shown()) - expected) / expected).toBeLessThan(0.05);

      // Drag the last corner 50 px to the left: the shape widens, so the area grows.
      const before = await shown();
      await touchDrag(page, corners[3], [corners[3][0] - 50, corners[3][1]]);
      await expect.poll(shown).toBeGreaterThan(before);

      // Close the shape: a further tap adds no corner.
      await page.getByRole("button", { name: c.r.tools.close }).click();
      await page.touchscreen.tap(left + 100, top + 300 > box.y + box.height ? top + 10 : top + 300);
      await expect(page.locator(".roof-handle")).toHaveCount(4);

      // Undo removes a corner (and the shape stays closed with three).
      await page.getByRole("button", { name: c.r.tools.undo }).click();
      await expect(page.locator(".roof-handle")).toHaveCount(3);
      await page.getByRole("button", { name: c.r.tools.clear }).click();
      await expect(page.locator(".roof-handle")).toHaveCount(0);
    });

    test("the traced area carries into the typed field, and flat hides facing", async ({ page }) => {
      await openRoofStep(page, c);
      const map = page.locator(".roof-map");
      await map.scrollIntoViewIfNeeded();
      const box = (await map.boundingBox())!;
      for (const [dx, dy] of [[60, 100], [260, 100], [260, 220]]) {
        await page.touchscreen.tap(box.x + dx, box.y + dy);
      }
      await page.getByRole("button", { name: c.r.area.switchToType }).click();
      await expect(page.getByLabel(c.r.area.label)).not.toHaveValue("");

      await page.getByRole("radio", { name: c.r.slope.gentle }).check();
      await expect(page.getByRole("radio", { name: c.r.facing.north })).toBeVisible();
      await page.getByRole("radio", { name: c.r.slope.flat }).check();
      await expect(page.getByRole("radio", { name: c.r.facing.north })).toHaveCount(0);
      await page.getByRole("radio", { name: c.r.shade.none }).check();
      await expect(page.getByRole("button", { name: c.plan.steps.roof.next })).toBeEnabled();
    });

    test("typing replaces the traced shape, so the map tag shows the typed area", async ({ page }) => {
      await openRoofStep(page, c);
      const map = page.locator(".roof-map");
      await map.scrollIntoViewIfNeeded();
      const box = (await map.boundingBox())!;
      for (const [dx, dy] of [[60, 100], [260, 100], [260, 220]]) {
        await page.touchscreen.tap(box.x + dx, box.y + dy);
      }
      await expect(page.locator(".roof-handle")).toHaveCount(3);

      await page.getByRole("button", { name: c.r.area.switchToType }).click();
      await page.getByLabel(c.r.area.label).fill("40");
      await page.getByRole("button", { name: c.r.area.switchToTrace }).click();

      // The traced corners are gone and the tag reads the typed 40, not the old shape.
      await expect(page.locator(".roof-handle")).toHaveCount(0);
      await expect(page.locator(".roof-map + div")).toContainText("40");
    });

    test("warns, without blocking, below 5 m² and above 500 m²", async ({ page }) => {
      await openRoofStep(page, c);
      await page.getByRole("button", { name: c.r.area.switchToType }).click();
      await page.getByRole("radio", { name: c.r.slope.flat }).check();
      await page.getByRole("radio", { name: c.r.shade.none }).check();
      await page.getByLabel(c.r.area.label).fill("3");
      await expect(page.getByText(c.r.warning.tooSmall.title)).toBeVisible();
      await expect(page.getByRole("button", { name: c.plan.steps.roof.next })).toBeEnabled();
      await page.getByLabel(c.r.area.label).fill("600");
      await expect(page.getByText(c.r.warning.tooLarge.title)).toBeVisible();
      await expect(page.getByRole("button", { name: c.plan.steps.roof.next })).toBeEnabled();
    });

    test("refuses a roof above 2,000 m² and accepts 2,000", async ({ page }) => {
      await openRoofStep(page, c);
      await page.getByRole("button", { name: c.r.area.switchToType }).click();
      await page.getByRole("radio", { name: c.r.slope.flat }).check();
      await page.getByRole("radio", { name: c.r.shade.none }).check();
      await page.getByLabel(c.r.area.label).fill("2000");
      await expect(page.getByRole("button", { name: c.plan.steps.roof.next })).toBeEnabled();
      await page.getByLabel(c.r.area.label).fill("2001");
      await expect(page.getByText(c.r.refused.title)).toBeVisible();
      await expect(page.getByRole("button", { name: c.plan.steps.roof.next })).toBeDisabled();
    });
  });
}
