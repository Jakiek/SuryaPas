import { setRequestLocale } from "next-intl/server";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default async function PlanPage({ params }: PageProps<"/[locale]/plan">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlaceholderPage route="plan" />;
}
