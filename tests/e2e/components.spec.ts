import path from "node:path";
import { expect, test } from "@playwright/test";

// T08: checks on the review page that shows every shared component,
// /[locale]/dev/components, in both languages.

// axe-core is the accessibility rules engine. Its script is read from
// node_modules and run inside the page. Tests run from the project root.
const AXE_SCRIPT = path.join(process.cwd(), "node_modules/axe-core/axe.min.js");

type AxeViolation = { id: string; help: string; nodes: { target: string[] }[] };
// The one call this test makes on window.axe.
type Axe = {
  run: (context: Document, options: object) => Promise<{ violations: AxeViolation[] }>;
};

for (const locale of ["id", "en"]) {
  test(`components page has no axe violations in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}/dev/components`);
    await page.addScriptTag({ path: AXE_SCRIPT });

    // WCAG 2.0 and 2.1, levels A and AA, as in docs/DESIGN.md's contrast rules.
    const violations: AxeViolation[] = await page.evaluate(async () => {
      const axe = (window as unknown as { axe: Axe }).axe;
      const result = await axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
        // The Next.js dev overlay is not part of the page.
        exclude: [["nextjs-portal"]],
      });
      return result.violations;
    });

    // On failure, print which rule failed and where.
    const summary = violations.map(
      (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).join(", ")})`,
    );
    expect(summary).toEqual([]);
  });

  test(`nothing animates with reduced motion in ${locale}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/${locale}/dev/components`);

    // Every element's transitions and animations must take no time
    // (docs/DESIGN.md "Motion").
    const moving: string[] = await page.evaluate(() => {
      const isZero = (list: string) => list.split(",").every((d) => parseFloat(d) === 0);
      return [...document.querySelectorAll("*")]
        .filter((element) => {
          const style = getComputedStyle(element);
          return !isZero(style.transitionDuration) || !isZero(style.animationDuration);
        })
        .map((element) => `${element.tagName.toLowerCase()}.${element.className}`);
    });
    expect(moving).toEqual([]);
  });
}

test("segmented choice moves with the arrow keys like a radio group", async ({ page }) => {
  await page.goto("/en/dev/components");
  const group = page.getByRole("group", { name: "Which way does it face?" });
  const east = group.getByRole("radio", { name: "East" });
  const south = group.getByRole("radio", { name: "South" });

  await east.focus();
  await page.keyboard.press("ArrowRight");
  await expect(south).toBeFocused();
  await expect(south).toBeChecked();
  await expect(east).not.toBeChecked();
});
