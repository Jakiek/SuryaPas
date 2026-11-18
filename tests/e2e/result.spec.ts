// The result page (T13), driven in a real browser at 375 px against the dev
// server, which uses the in-memory store (no account).
//
// The headline test computes the expected figures itself with the engine and
// the page's own formatters, from the same year of sun the server used
// (GET /api/sun for the same point), so a wrong number on screen fails it.

import path from "node:path";
import { expect, test, type Page, type Request } from "@playwright/test";
import exampleHouse from "../../data/example-house.json";
import en from "../../messages/en/result.json";
import idPlan from "../../messages/id/plan.json";
import id from "../../messages/id/result.json";
import { assess, CURRENT_ASSUMPTIONS, type EngineInputs } from "../../src/engine";
import { costRangeFigure, kwpText, paybackFigure } from "../../src/features/result/figures";
import { BASE_URL } from "./support/server";

const HOUSE = exampleHouse.inputs as EngineInputs;
const AXE_SCRIPT = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

/** Saves a result through the real route and returns its id. */
async function saveResult(page: Page, inputs: EngineInputs, locale = "id"): Promise<string> {
  const response = await page.request.post("/api/assessments", { data: { inputs, overrides: {}, locale } });
  expect(response.status()).toBe(201);
  return ((await response.json()) as { id: string }).id;
}

/** The text of the navy verdict band: headline numbers and any warnings. */
const verdictBand = (page: Page) => page.locator('[data-band="night"]').first();

/** The headline figures the page must show for these inputs, in Indonesian. */
async function expectedHeadline(page: Page, inputs: EngineInputs) {
  const { latitude, longitude } = inputs.location;
  const sun = (await (await page.request.get(`/api/sun?lat=${latitude}&lon=${longitude}`)).json()) as {
    series: number[];
    source: "live" | "fallback";
  };
  const result = assess(inputs, { ghiWm2: sun.series, source: sun.source }, CURRENT_ASSUMPTIONS);
  const recommended = result.candidates.find((candidate) => candidate.panels === result.recommendedPanels)!;
  const money = recommended.withoutBattery.money;
  const cost = costRangeFigure(money.upfrontCostRp, "id");
  const payback = paybackFigure(money.paybackYears, "id");
  return {
    answer: `${recommended.panels} panel`, // CSS sets it in capitals
    size: `${kwpText(recommended.kwp, "id")} kWp`,
    cost: `${cost.figure} ${cost.unit}`,
    payback: payback.kind === "never" ? id.verdict.paybackNever : payback.value.figure,
  };
}

test("submitting the flow lands on a result whose headline equals the engine's output", async ({ page }) => {
  // A finished draft at step 4, as the flow leaves it in browser storage.
  await page.addInitScript((inputs) => {
    localStorage.setItem("suryapas.plan.v1", JSON.stringify({ step: 4, ...inputs, overrides: {} }));
  }, HOUSE);
  await page.goto("/id/plan");
  await page.getByRole("button", { name: idPlan.steps.lifestyle.next }).click();
  await expect(page).toHaveURL(/\/id\/r\/[A-Za-z0-9_-]{22}$/, { timeout: 30_000 });

  const expected = await expectedHeadline(page, HOUSE);
  const band = verdictBand(page);
  for (const text of Object.values(expected)) await expect(band).toContainText(text);

  // The browser that made it may change its answers.
  await expect(page.getByRole("link", { name: id.actions.edit })).toBeVisible();
});

/** Every figure on the page: the verdict band, the ledger, both chart captions and the battery section. */
const figuresOf = (page: Page) =>
  page.evaluate(() =>
    [
      document.querySelector('[data-band="night"]')?.textContent,
      document.querySelector("dl")?.textContent,
      ...[...document.querySelectorAll("figcaption, table")].map((element) => element.textContent),
    ].join("|"),
  );

test("reloading the link, and opening it in a fresh browser profile, shows the same figures", async ({ page, browser }) => {
  const resultId = await saveResult(page, HOUSE);
  await page.goto(`/id/r/${resultId}`);
  const first = await figuresOf(page);
  expect(first).toContain(" panel");

  await page.reload();
  expect(await figuresOf(page)).toBe(first);

  const fresh = await browser.newContext({ viewport: { width: 375, height: 812 }, baseURL: BASE_URL });
  const visitor = await fresh.newPage();
  await visitor.goto(`${BASE_URL}/id/r/${resultId}`);
  expect(await figuresOf(visitor)).toBe(first);
  // The visitor gets the read-only view: "plan your own" in place of "edit".
  await expect(visitor.getByText(id.actions.shared)).toBeVisible();
  await expect(visitor.getByRole("link", { name: id.actions.planOwn })).toBeVisible();
  await expect(visitor.getByRole("link", { name: id.actions.edit })).toHaveCount(0);
  await fresh.close();
});

test("picking another count updates every number and both charts, quickly on a throttled phone", async ({ page }) => {
  await page.goto("/id/r/example");
  // A mid-range phone: the CPU four times slower than this machine.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });

  const snapshot = () =>
    page.evaluate(() => ({
      band: document.querySelector('[data-band="night"]')!.textContent,
      ledger: document.querySelector("dl")!.textContent,
      charts: [...document.querySelectorAll("figure svg path")].map((p) => p.getAttribute("d")).join("|"),
      captions: [...document.querySelectorAll("figcaption")].map((c) => c.textContent).join("|"),
    }));
  const before = await snapshot();

  const started = Date.now();
  await page.getByRole("button", { name: "5 panel", exact: true }).click();
  await expect(page.locator("h1")).toContainText("5 panel");
  // Let the 200 ms ease finish, then read the settled values.
  await expect.poll(async () => (await snapshot()).charts, { intervals: [50] }).not.toBe(before.charts);
  const elapsed = Date.now() - started;
  await page.waitForTimeout(400);
  const after = await snapshot();

  expect(after.band).not.toBe(before.band);
  expect(after.ledger).not.toBe(before.ledger);
  expect(after.charts).not.toBe(before.charts);
  expect(after.captions).not.toBe(before.captions);
  expect(elapsed).toBeLessThan(1000);
});

test("/r/example renders with the network blocked", async ({ page }) => {
  // Everything that is not this server fails. The page itself computes the
  // example from bundled files on the server (unit test: exampleHouse.test.ts).
  await page.route((url) => url.origin !== BASE_URL, (route) => route.abort());
  await page.goto("/id/r/example");
  await expect(page.locator("h1")).toContainText(" panel");
  await expect(page.getByText(id.day.heading)).toBeVisible();
});

test.describe("honest verdicts", () => {
  const cases: { name: string; inputs: EngineInputs; text: string }[] = [
    {
      name: "a subsidised 450 VA home",
      inputs: { ...HOUSE, electricity: { billing: "prepaid", connectedVa: 450, subsidised: true, monthlySpendRp: [60_000] } },
      text: id.warnings.doesNotPayBack.title,
    },
    { name: "heavy shade", inputs: { ...HOUSE, roof: { ...HOUSE.roof, shade: "heavy" } }, text: id.warnings.heavyShade.title },
    { name: "a 4 m² roof", inputs: { ...HOUSE, roof: { ...HOUSE.roof, areaM2: 4 } }, text: id.tooSmall.heading },
  ];
  for (const { name, inputs, text } of cases) {
    test(`${name}: the verdict is shown`, async ({ page }) => {
      await page.goto(`/id/r/${await saveResult(page, inputs)}`);
      await expect(page.locator("main")).toContainText(text);
    });
  }
  // The fourth, fallback sun data ("approximate"), cannot be forced through
  // the live route from here; view.test.ts runs it through the engine.
});

test("tapping the quote button records exactly one event and sends no personal data", async ({ page }) => {
  const resultId = await saveResult(page, HOUSE);
  const sent: Request[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/api/events")) sent.push(request);
  });
  await page.goto(`/id/r/${resultId}`);

  const button = page.getByRole("button", { name: new RegExp(id.actions.quote) });
  await button.click();
  await button.click({ force: true }).catch(() => {}); // a second tap must not send again
  await expect(page.getByText(id.actions.quoteThanks)).toBeVisible();
  await page.waitForTimeout(500);

  expect(sent).toHaveLength(1);
  expect(sent[0].postDataJSON()).toEqual({ name: "quote_interest", assessmentId: resultId });
  await expect(button).toBeDisabled();
});

for (const [locale, m] of [["id", id], ["en", en]] as const) {
  test(`the result page has no axe violations in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/r/example`);
    await expect(page.getByText(m.day.heading)).toBeVisible();
    await page.addScriptTag({ path: AXE_SCRIPT });
    const violations: string[] = await page.evaluate(async () => {
      type Axe = { run: (c: Document, o: object) => Promise<{ violations: { id: string; nodes: { target: string[] }[] }[] }> };
      const axe = (window as unknown as { axe: Axe }).axe;
      const result = await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        exclude: [["nextjs-portal"]],
      });
      return result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
    });
    expect(violations).toEqual([]);
  });
}
