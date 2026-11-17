import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { UnsavedResultPage } from "@/features/result/UnsavedResult";

export async function generateMetadata({ params }: PageProps<"/[locale]/r/unsaved">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "result" });
  return { title: t("title"), robots: { index: false } };
}

// A result the server computed but could not save (SPEC 2.5 "Saving fails").
// It lives only in the browser tab that made it, so the server has nothing to
// load here; the page reads it from session storage in the browser. This
// fixed segment wins over /r/[id].
export default async function UnsavedResultRoute({ params }: PageProps<"/[locale]/r/unsaved">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <UnsavedResultPage />;
}
