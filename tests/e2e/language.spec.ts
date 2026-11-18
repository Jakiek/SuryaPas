// The language switch on every screen: choosing the other language keeps the
// user on the same screen (SPEC 6 item 5; SPEC 2.2 "a refresh resumes where
// the user left off" applies to a language change, which is a reload).
//
// Each case names how to reach a screen and what proves the user is on it.
// The proof is the screen's own heading in the new language, never only the URL.

import { expect, test, type Page } from "@playwright/test";
import { COPY, COPIES, withoutTags, type Copy } from "./support/copy";
import { HOUSE_INPUTS, VARIANTS, draftOnStep, keptUnsavedResult, saveResult, seedDraft, seedUnsaved } from "./support/screens";

type Screen = {
  name: string;
  /** Opens the screen in language `c`. */
  open: (page: Page, c: Copy, request: Parameters<typeof saveResult>[0]) => Promise<{ path: string }>;
  /** What the user sees on that screen, in language `c`. */
  proof: (page: Page, c: Copy) => Promise<void>;
};

const heading = (page: Page, text: string) =>
  expect(page.getByRole("heading", { level: 1 }).first()).toContainText(text, { ignoreCase: true });

const stepScreen = (step: 1 | 2 | 3 | 4): Screen => {
  const key = (["location", "roof", "electricity", "lifestyle"] as const)[step - 1];
  return {
    name: `plan, step ${step}`,
    open: async (page, c) => {
      await seedDraft(page, draftOnStep(step));
      await page.goto(`/${c.locale}/plan`);
      return { path: "/plan" };
    },
    proof: (page, c) => heading(page, c.plan.steps[key].heading),
  };
};

const SCREENS: Screen[] = [
  {
    name: "landing",
    open: async (page, c) => {
      await page.goto(`/${c.locale}`);
      return { path: "" };
    },
    proof: (page, c) => heading(page, withoutTags(c.landing.hero.heading)),
  },
  stepScreen(1),
  stepScreen(2),
  stepScreen(3),
  stepScreen(4),
  {
    name: "a saved result",
    open: async (page, c, request) => {
      const id = await saveResult(request, HOUSE_INPUTS, c.locale);
      await page.goto(`/${c.locale}/r/${id}`);
      return { path: `/r/${id}` };
    },
    proof: (page, c) => heading(page, c.result.verdict.ledeRecommended),
  },
  {
    name: "a saved result that is too small",
    open: async (page, c, request) => {
      const id = await saveResult(request, VARIANTS.tooSmall, c.locale);
      await page.goto(`/${c.locale}/r/${id}`);
      return { path: `/r/${id}` };
    },
    proof: (page, c) => expect(page.getByRole("heading", { name: c.result.tooSmall.heading })).toBeVisible(),
  },
  {
    name: "the example result",
    open: async (page, c) => {
      await page.goto(`/${c.locale}/r/example`);
      return { path: "/r/example" };
    },
    proof: (page, c) => heading(page, c.result.verdict.ledeRecommended),
  },
  {
    name: "a result that was not saved",
    open: async (page, c, request) => {
      await seedUnsaved(page, await keptUnsavedResult(request, HOUSE_INPUTS, c.locale));
      await page.goto(`/${c.locale}/r/unsaved`);
      return { path: "/r/unsaved" };
    },
    proof: (page, c) => expect(page.getByText(c.result.unsaved.title)).toBeVisible(),
  },
  {
    name: "the assumptions",
    open: async (page, c) => {
      await page.goto(`/${c.locale}/assumptions`);
      return { path: "/assumptions" };
    },
    proof: (page, c) => heading(page, c.assumptions.title),
  },
  ...(["account", "installers", "admin"] as const).map(
    (route): Screen => ({
      name: `the ${route} placeholder`,
      open: async (page, c) => {
        await page.goto(`/${c.locale}/${route}`);
        return { path: `/${route}` };
      },
      proof: (page, c) => heading(page, c.common.routes[route].title),
    }),
  ),
];

for (const from of COPIES) {
  const to = from.locale === "id" ? COPY.en : COPY.id;
  test.describe(`language switch ${from.locale} to ${to.locale}`, () => {
    for (const screen of SCREENS) {
      test(`${screen.name} stays on the same screen`, async ({ page, request }) => {
        const { path } = await screen.open(page, from, request);
        await screen.proof(page, from);

        // The switch is the one link in the language navigation: the other language.
        const switcher = page.getByRole("navigation", { name: from.common.language.navLabel });
        await expect(switcher.getByRole("link")).toHaveCount(1);
        await switcher.getByRole("link").click();

        await expect(page).toHaveURL(`/${to.locale}${path}`.replace(/^(\/\w+)\/$/, "$1"));
        await expect(page.locator("html")).toHaveAttribute("lang", to.locale);
        await screen.proof(page, to);
      });
    }

    test("the plan's answers survive the switch", async ({ page }) => {
      await seedDraft(page, draftOnStep(3));
      await page.goto(`/${from.locale}/plan`);
      await page.getByRole("navigation", { name: from.common.language.navLabel }).getByRole("link").click();
      await expect(page.locator("html")).toHaveAttribute("lang", to.locale);
      // Step 3's power class and the bill typed in the example house are still filled in.
      await expect(page.getByLabel(to.plan.electricity.power.label)).toHaveValue(String(HOUSE_INPUTS.electricity.connectedVa));
      await expect(page.getByLabel(to.plan.electricity.spend.postpaid.single)).not.toHaveValue("");
    });
  });
}
