import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { namespaces } from "./namespaces";
import { routing } from "./routing";

// Loads every namespace file for the requested locale and nests each
// under its own name, so `useTranslations("common")` finds common.json.
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const entries = await Promise.all(
    namespaces.map(async (namespace) => {
      const file = await import(`../../messages/${locale}/${namespace}.json`);
      return [namespace, file.default] as const;
    }),
  );

  return { locale, messages: Object.fromEntries(entries) };
});
