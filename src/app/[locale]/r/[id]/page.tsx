import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { loadResult } from "@/features/result/loadResult";
import { ResultScreen } from "@/features/result/ResultScreen";

export async function generateMetadata({ params }: PageProps<"/[locale]/r/[id]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "result" });
  return { title: t("title") };
}

// A saved result, read from the store, or the example house (SPEC 2.3, 5.1).
// The same link shows the same figures to anyone who opens it: they come from
// the saved engine output, not from a new calculation.
export default async function ResultPage({ params }: PageProps<"/[locale]/r/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const result = await loadResult(id);
  if (result === null) notFound();

  return <ResultScreen {...result} />;
}
