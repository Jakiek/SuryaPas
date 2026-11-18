import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Showcase } from "./Showcase";

// The page is for developers only. A production build answers 404, unless
// SURYAPAS_DEV_PAGES=1 is set; only playwright.config.ts sets it, so the
// end-to-end tests can reach this page on their production build. The check
// runs while the page is built, so the variable must be set for `next build`.
function devPagesAreOff(): boolean {
  return process.env.NODE_ENV === "production" && process.env.SURYAPAS_DEV_PAGES !== "1";
}

// A review page, not part of the product: keep it out of search engines.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dev/components">): Promise<Metadata> {
  if (devPagesAreOff()) return {};
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common.dev" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

// /id/dev/components and /en/dev/components: every shared component in
// every state, laid out in the order of the approved mock's three screens
// so the two can be compared side by side.
export default async function ComponentsPage({
  params,
}: PageProps<"/[locale]/dev/components">) {
  if (devPagesAreOff()) notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  return <Showcase />;
}
