import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Showcase } from "./Showcase";

// A review page, not part of the product: keep it out of search engines.
export async function generateMetadata({
  params,
}: PageProps<"/[locale]/dev/components">): Promise<Metadata> {
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
  const { locale } = await params;
  setRequestLocale(locale);
  return <Showcase />;
}
