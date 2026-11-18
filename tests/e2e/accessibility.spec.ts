// An axe-core scan of every screen and every step of the flow, in both
// languages, failing on any WCAG 2.0 or 2.1 level A or AA violation
// (SPEC 6 item 4). A screen that has several states is scanned in each:
// the step with and without its errors, the result with each honest verdict.
//
// Screens that already have their own scan (the components page, T08) are
// scanned there. This file reaches every other one the same way: open it,
// wait until its heading is on screen, scan, and check nothing scrolls sideways.

import { expect, test, type Page } from "@playwright/test";
import { COPIES, type Copy } from "./support/copy";
import { expectNoAxeViolations } from "./support/journey";
import {
  HOUSE_INPUTS,
  VARIANTS,
  draftOnStep,
  keptUnsavedResult,
  saveResult,
  seedDraft,
  seedUnsaved,
} from "./support/screens";

type Setup = (page: Page, c: Copy, request: Parameters<typeof saveResult>[0]) => Promise<void>;

const h1 = (page: Page) => expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();

const visit =
  (path: string): Setup =>
  async (page, c) => {
    await page.goto(`/${c.locale}${path}`);
    await h1(page);
  };

const planStep =
  (step: number, afterLoad?: (page: Page, c: Copy) => Promise<void>, draft: object = draftOnStep(step)): Setup =>
  async (page, c) => {
    await seedDraft(page, draft);
    await page.goto(`/${c.locale}/plan`);
    await h1(page);
    await afterLoad?.(page, c);
  };

const savedResult =
  (inputs: typeof HOUSE_INPUTS, confirm?: (page: Page, c: Copy) => Promise<void>): Setup =>
  async (page, c, request) => {
    await page.goto(`/${c.locale}/r/${await saveResult(request, inputs, c.locale)}`);
    await h1(page);
    await confirm?.(page, c);
  };

// The fixture sun service answers 503 around Makassar (server-fixtures.cjs), so a house
// pinned there is computed from the bundled city figures and labelled approximate.
const MAKASSAR_HOUSE = { ...HOUSE_INPUTS, location: { latitude: -5.1442, longitude: 119.4079 } };

const SCREENS: { name: string; setup: Setup }[] = [
  { name: "landing", setup: visit("") },
  {
    name: "landing, returning visitor",
    setup: async (page, c) => {
      await seedDraft(page, draftOnStep(3));
      await page.goto(`/${c.locale}`);
      await expect(page.getByRole("link", { name: c.landing.continue.button })).toBeVisible();
    },
  },
  { name: "step 1, pin placed", setup: planStep(1) },
  {
    name: "step 1, search results showing",
    setup: planStep(1, async (page, c) => {
      await page.getByRole("combobox", { name: c.location.search.label }).fill("Malioboro");
      await expect(page.getByRole("option").first()).toBeVisible();
    }),
  },
  { name: "step 1, nothing chosen yet", setup: planStep(1, undefined, { step: 1 }) },
  {
    name: "step 1, pin outside Indonesia",
    setup: planStep(1, async (page, c) => {
      await expect(page.getByText(c.location.outside.title)).toBeVisible();
    }, { step: 1, location: { latitude: 3.139, longitude: 101.6869 } }),
  },
  {
    name: "step 2, marking the roof on the map",
    setup: planStep(2, async (page, c) => {
      const toTrace = page.getByRole("button", { name: c.roof.area.switchToTrace });
      if (await toTrace.isVisible()) await toTrace.click();
      await expect(page.getByRole("button", { name: c.roof.area.switchToType })).toBeVisible();
    }),
  },
  {
    name: "step 2, typing the area",
    setup: planStep(2, async (page, c) => {
      const toType = page.getByRole("button", { name: c.roof.area.switchToType });
      if (await toType.isVisible()) await toType.click();
      await expect(page.getByLabel(c.roof.area.label)).toBeVisible();
    }),
  },
  {
    name: "step 2, a very small roof warned about",
    setup: planStep(2, async (page, c) => {
      const toType = page.getByRole("button", { name: c.roof.area.switchToType });
      if (await toType.isVisible()) await toType.click();
      await page.getByLabel(c.roof.area.label).fill("2");
      await expect(page.getByText(c.roof.warning.tooSmall.title)).toBeVisible();
    }),
  },
  {
    name: "step 2, a roof too large refused",
    setup: planStep(2, async (page, c) => {
      const toType = page.getByRole("button", { name: c.roof.area.switchToType });
      if (await toType.isVisible()) await toType.click();
      await page.getByLabel(c.roof.area.label).fill("2500");
      await expect(page.getByText(c.roof.refused.title)).toBeVisible();
    }),
  },
  { name: "step 3, a monthly bill", setup: planStep(3) },
  {
    name: "step 3, tokens, twelve months and an error",
    setup: planStep(3, async (page, c) => {
      await page.getByRole("radio", { name: c.plan.electricity.billing.prepaid }).check();
      for (let month = 2; month <= 12; month++) {
        await page.getByRole("button", { name: c.plan.electricity.spend.addMonth }).click();
      }
      // With all twelve, the fields are named for the months, not numbered.
      const first = page.locator("input[name^='month-']").first();
      await first.fill("0");
      await first.blur();
      await expect(page.getByText(c.plan.errors.billZero)).toBeVisible();
    }),
  },
  { name: "step 4", setup: planStep(4) },
  {
    name: "step 4, a question left unanswered",
    setup: planStep(4, async (page, c) => {
      await page.getByRole("group", { name: c.plan.lifestyle.electricVehicle.legend }).getByRole("radio", { name: c.plan.lifestyle.yes }).check();
      await expect(page.getByText(c.plan.errors.answerRequired).first()).toBeVisible();
    }, { step: 4 }),
  },
  { name: "result", setup: savedResult(HOUSE_INPUTS) },
  { name: "example result", setup: visit("/r/example") },
  { name: "result, roof too small", setup: savedResult(VARIANTS.tooSmall) },
  {
    name: "result, does not pay back",
    setup: savedResult(VARIANTS.doesNotPayBack, (page, c) => expect(page.getByText(c.result.warnings.doesNotPayBack.title)).toBeVisible()),
  },
  {
    name: "result, heavy shade",
    setup: savedResult(VARIANTS.heavyShade, (page, c) => expect(page.getByText(c.result.warnings.heavyShade.title)).toBeVisible()),
  },
  {
    name: "result, approximate sun data",
    setup: savedResult(MAKASSAR_HOUSE, async (page, c) => {
      await expect(page.getByText(c.result.warnings.approximate.title)).toBeVisible();
      await expect(page.getByText(c.result.warnings.approximate.body)).toBeVisible();
    }),
  },
  {
    name: "result, not saved",
    setup: async (page, c, request) => {
      await seedUnsaved(page, await keptUnsavedResult(request, HOUSE_INPUTS, c.locale));
      await page.goto(`/${c.locale}/r/unsaved`);
      await expect(page.getByText(c.result.unsaved.title)).toBeVisible();
    },
  },
  {
    name: "result, nothing to show",
    setup: async (page, c) => {
      await page.goto(`/${c.locale}/r/unsaved`);
      await expect(page.getByRole("heading", { name: c.result.unsaved.emptyTitle })).toBeVisible();
    },
  },
  { name: "assumptions", setup: visit("/assumptions") },
  { name: "account placeholder", setup: visit("/account") },
  { name: "installers placeholder", setup: visit("/installers") },
  { name: "admin placeholder", setup: visit("/admin") },
];

for (const c of COPIES) {
  test.describe(`axe, ${c.locale}`, () => {
    for (const screen of SCREENS) {
      test(`${screen.name}: no WCAG 2.1 AA violations and nothing scrolls sideways`, async ({ page, request }) => {
        // No motion from the first paint, so no colour is caught half way through a fade.
        await page.emulateMedia({ reducedMotion: "reduce" });
        await screen.setup(page, c, request);
        await expectNoAxeViolations(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow).toBeLessThanOrEqual(0);
      });
    }
  });
}
