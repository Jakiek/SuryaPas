import { defineRouting } from "next-intl/routing";

// Two languages. Indonesian is the default; every URL carries its locale
// (/id/... or /en/...), and "/" redirects to /id (SPEC 2).
export const routing = defineRouting({
  locales: ["id", "en"],
  defaultLocale: "id",
  localePrefix: "always",
  // "/" always goes to /id, whatever language the browser asks for.
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
