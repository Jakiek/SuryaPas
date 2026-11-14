import { setRequestLocale } from "next-intl/server";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default async function AssumptionsPage({ params }: PageProps<"/[locale]/assumptions">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlaceholderPage route="assumptions" />;
}
