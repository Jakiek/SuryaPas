import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components";
import { ArgumentSection } from "@/features/landing/ArgumentSection";
import { compareExampleHouse } from "@/features/landing/exampleComparison";
import { Hero } from "@/features/landing/Hero";
import { formatDecimal, formatMoneyExact } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  return {
    title: { absolute: t("title") },
    description: t("description"),
    openGraph: { title: t("title"), description: t("description"), locale, type: "website" },
  };
}

// The landing page (SPEC 2.1). Rendered once per language at build time: the
// comparison is computed by the engine from the example house, on the server.
export default async function LandingPage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const comparison = await compareExampleHouse();
  const t = await getTranslations({ locale, namespace: "landing" });
  const exampleLine = t("footer.example", {
    place: comparison.place,
    power: formatDecimal(comparison.connectedVa, locale, 0),
    bill: formatMoneyExact(comparison.monthlySpendRp, locale),
  });

  return (
    <PageShell headerTone="sun" footerTone="night" footerNote={exampleLine}>
      <Hero />
      <ArgumentSection comparison={comparison} />
    </PageShell>
  );
}
