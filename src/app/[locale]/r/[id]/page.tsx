import { getTranslations, setRequestLocale } from "next-intl/server";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export default async function ResultPage({
  params,
}: PageProps<"/[locale]/r/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "common" });
  return (
    <PlaceholderPage route="result" detail={t("placeholder.resultId", { id })} />
  );
}
