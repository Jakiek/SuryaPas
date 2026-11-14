import { setRequestLocale } from "next-intl/server";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default async function InstallersPage({ params }: PageProps<"/[locale]/installers">) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <PlaceholderPage route="installers" comingSoon />;
}
