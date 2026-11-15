import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components";
import { PlanFlow } from "@/features/plan/PlanFlow";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/plan">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("routes.plan.title") };
}

// The four-step input flow (SPEC 2.2). The page is a frame; everything
// interactive is in PlanFlow, which runs in the browser because the draft
// lives in browser storage.
export default async function PlanPage({ params }: PageProps<"/[locale]/plan">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <PageShell>
      <PlanFlow />
    </PageShell>
  );
}
