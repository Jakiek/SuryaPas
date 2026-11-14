import { expect, test } from "@playwright/test";
import en from "../../messages/en/common.json";
import id from "../../messages/id/common.json";

const cases = [
  { locale: "id", messages: id },
  { locale: "en", messages: en },
] as const;

for (const { locale, messages } of cases) {
  test(`landing page loads in ${locale}`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      messages.routes.landing.title,
    );
  });
}

test("the root path redirects to /id", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/id$/);
});
