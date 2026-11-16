// Step 1, the location step (T11), driven in a real browser at 375 px in
// both languages. The address search is answered by a fake /api/geocode so
// the tests do not depend on the public geocoder, and map tiles are blocked
// (the map still works without them: pin, drag and tap are what is tested).

import { expect, test, type Page } from "@playwright/test";
import en from "../../messages/en/location.json";
import enPlan from "../../messages/en/plan.json";
import id from "../../messages/id/location.json";
import idPlan from "../../messages/id/plan.json";

const LOCALES = [
  { locale: "id", m: id, plan: idPlan },
  { locale: "en", m: en, plan: enPlan },
] as const;

type Copy = (typeof LOCALES)[number];

const MALIOBORO = [
  { label: "Grand Inna Malioboro, Jalan Malioboro, Yogyakarta", lat: -7.790843, lon: 110.366873 },
  { label: "KHAS Malioboro Hotel, Jalan Gadean, Yogyakarta", lat: -7.79826, lon: 110.3633 },
];

const STORAGE_KEY = "suryapas.plan.v1";

async function stubExternalServices(page: Page) {
  await page.route("**/api/geocode*", (route) => route.fulfill({ json: MALIOBORO }));
  await page.route("**/tiles.openfreemap.org/**", (route) => route.abort());
}

/** Starts the flow at step 1 with a pin already placed (a restored draft). */
async function startWithPin(page: Page, locale: string, latitude: number, longitude: number) {
  await page.addInitScript(
    ([key, lat, lon]) => {
      localStorage.setItem(key as string, JSON.stringify({ step: 1, location: { latitude: lat, longitude: lon } }));
    },
    [STORAGE_KEY, latitude, longitude] as const,
  );
  await page.goto(`/${locale}/plan`);
}

const nextButton = (page: Page, c: Copy) => page.getByRole("button", { name: c.plan.steps.location.next });
const searchBox = (page: Page, c: Copy) => page.getByRole("combobox", { name: c.m.search.label });

for (const c of LOCALES) {
  test.describe(`location step in ${c.locale}`, () => {
    test.beforeEach(async ({ page }) => {
      await stubExternalServices(page);
    });

    test("an address from the landing page fills the search and lists its results", async ({ page }) => {
      // The landing page hands the address over in session storage, never the URL.
      await page.addInitScript(() => sessionStorage.setItem("suryapas.pendingAddress", "Malioboro Yogyakarta"));
      await page.goto(`/${c.locale}/plan`);
      await expect(searchBox(page, c)).toHaveValue("Malioboro Yogyakarta");
      await expect(page.getByRole("option")).toHaveCount(2);
      // No pin yet: nothing was chosen for the user.
      await expect(nextButton(page, c)).toBeDisabled();
      // Read once: it is gone from storage, and the URL never held it.
      expect(await page.evaluate(() => sessionStorage.getItem("suryapas.pendingAddress"))).toBeNull();
      expect(page.url()).not.toContain("Malioboro");
    });

    test("the search text travels in a POST body, never in a URL", async ({ page }) => {
      const requests: { method: string; url: string; body: string | null }[] = [];
      page.on("request", (request) => {
        if (request.url().includes("/api/geocode")) {
          requests.push({ method: request.method(), url: request.url(), body: request.postData() });
        }
      });
      await page.goto(`/${c.locale}/plan`);
      await searchBox(page, c).fill("Rahasia Malioboro");
      await expect(page.getByRole("option")).toHaveCount(2);
      expect(requests.length).toBeGreaterThan(0);
      for (const request of requests) {
        expect(request.method).toBe("POST");
        expect(request.url).not.toContain("Rahasia");
        expect(request.body).toContain("Rahasia Malioboro");
      }
    });

    test("Enter with no result highlighted sets no pin", async ({ page }) => {
      await page.goto(`/${c.locale}/plan`);
      await searchBox(page, c).fill("Malioboro");
      await expect(page.getByRole("option")).toHaveCount(2);
      await page.keyboard.press("Enter");
      await expect(nextButton(page, c)).toBeDisabled();
      const draft = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").location, STORAGE_KEY);
      expect(draft?.latitude ?? null).toBeNull();
    });

    test("too many searches show a calm message", async ({ page }) => {
      await page.route("**/api/geocode*", (route) => route.fulfill({ status: 429, json: { error: "rate_limited" } }));
      await page.goto(`/${c.locale}/plan`);
      await searchBox(page, c).fill("Malioboro");
      await expect(page.getByText(c.m.search.limited)).toBeVisible();
    });

    test("the zoom buttons are named in the page's language", async ({ page }) => {
      await page.goto(`/${c.locale}/plan`);
      await expect(page.getByRole("button", { name: c.m.map.zoomIn })).toBeVisible();
      await expect(page.getByRole("button", { name: c.m.map.zoomOut })).toBeVisible();
    });

    test("a home on a small island counts as inside", async ({ page }) => {
      // Pulau Pramuka, Kepulauan Seribu.
      await startWithPin(page, c.locale, -5.7436, 106.6153);
      await expect(nextButton(page, c)).toBeEnabled();
      await expect(page.getByText(c.m.outside.title)).toHaveCount(0);
    });

    test("choosing the first result places the pin in Yogyakarta and enables next", async ({ page }) => {
      await page.goto(`/${c.locale}/plan`);
      await searchBox(page, c).fill("Malioboro Yogyakarta");
      await page.getByRole("option").first().click();
      const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).location, STORAGE_KEY);
      expect(stored.latitude).toBeCloseTo(-7.790843, 5);
      expect(stored.longitude).toBeCloseTo(110.366873, 5);
      await expect(nextButton(page, c)).toBeEnabled();
      await expect(page.getByLabel(c.m.map.pin)).toBeAttached();
    });

    test("map and geocoder credit are on screen, and nothing scrolls sideways", async ({ page }) => {
      await page.goto(`/${c.locale}/plan`);
      await expect(page.getByRole("link", { name: "OpenFreeMap" })).toBeVisible();
      await expect(page.getByRole("link", { name: "OpenMapTiles" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Photon" })).toBeVisible();
      await expect(page.getByRole("link", { name: /OpenStreetMap/ }).first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test("denying the device location leaves the step usable and says so calmly", async ({ page, context }) => {
      await context.clearPermissions();
      await page.goto(`/${c.locale}/plan`);
      await page.getByRole("button", { name: c.m.device.button }).click();
      await expect(page.getByText(c.m.device.denied)).toBeVisible();
      // The other two ways still work.
      await searchBox(page, c).fill("Malioboro");
      await page.getByRole("option").first().click();
      await expect(nextButton(page, c)).toBeEnabled();
    });

    test("allowing the device location moves the pin there", async ({ page, context }) => {
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({ latitude: -6.2, longitude: 106.85 });
      await page.goto(`/${c.locale}/plan`);
      await page.getByRole("button", { name: c.m.device.button }).click();
      await expect(page.getByText(c.m.device.found)).toBeVisible();
      await expect(nextButton(page, c)).toBeEnabled();
    });

    test("a pin outside Indonesia blocks the step with the message", async ({ page }) => {
      // Kuala Lumpur, restored from a saved draft.
      await startWithPin(page, c.locale, 3.139, 101.6869);
      await expect(page.getByText(c.m.outside.title)).toBeVisible();
      await expect(nextButton(page, c)).toBeDisabled();
    });

    test("dragging the pin across the border blocks the step; dragging back frees it", async ({ page }) => {
      // Jayapura, about 30 km west of the border with Papua New Guinea.
      await startWithPin(page, c.locale, -2.5337, 140.7181);
      await expect(nextButton(page, c)).toBeEnabled();

      // Zoom out (to about 300 m a pixel) so the border is about 100 pixels away.
      const zoomOut = page.getByRole("button", { name: c.m.map.zoomOut });
      for (let i = 0; i < 8; i++) {
        await zoomOut.click();
        await page.waitForTimeout(350);
      }
      // Bring the map to the middle of the screen, clear of the sticky bar.
      await page.getByRole("region", { name: c.m.map.label }).evaluate((map) => map.scrollIntoView({ block: "center" }));
      const head = page.locator(".location-pin-head");
      const box = (await head.boundingBox())!;
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

      await page.mouse.move(start.x, start.y);
      await page.mouse.down();
      await page.mouse.move(start.x + 150, start.y, { steps: 10 });
      await page.mouse.up();

      await expect(page.getByText(c.m.outside.title)).toBeVisible();
      await expect(nextButton(page, c)).toBeDisabled();

      // Tapping the map back where the pin started moves it home again.
      await page.mouse.click(start.x - 40, start.y);
      await expect(page.getByText(c.m.outside.title)).toHaveCount(0);
      await expect(nextButton(page, c)).toBeEnabled();
    });
  });
}

test("the step can be completed with the keyboard alone, using search", async ({ page }) => {
  const c = LOCALES[0];
  await stubExternalServices(page);
  await page.goto(`/${c.locale}/plan`);

  /** Presses Tab until the focused element has the role or contains the text. */
  async function tabUntil(target: { role?: string; text?: string }) {
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const reached = await page.evaluate(({ role, text }) => {
        const element = document.activeElement;
        if (role) return element?.getAttribute("role") === role;
        return element?.textContent?.includes(text ?? "\u0000") === true;
      }, target);
      if (reached) return;
    }
    throw new Error("Tab never reached the target");
  }

  await tabUntil({ role: "combobox" });
  await page.keyboard.type("Malioboro Yogyakarta");
  await expect(page.getByRole("option")).toHaveCount(2);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(nextButton(page, c)).toBeEnabled();

  // Enter in the search box chose an address; it did not leave the step.
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.plan.steps.location.heading, { ignoreCase: true });

  await tabUntil({ text: c.plan.steps.location.next });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(c.plan.steps.roof.heading, { ignoreCase: true });
});
