import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageShell } from "@/components";
import { AssumptionsScreen } from "@/features/assumptions/AssumptionsScreen";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/assumptions">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "assumptions" });
  return { title: t("title") };
}

// A result id is letters, digits, "-" and "_" (the reserved id "example" is one too).
const RESULT_ID = /^[A-Za-z0-9_-]{1,64}$/;

// The assumptions screen (SPEC 2.4). A result page links here as
// /assumptions?from=<result id>, which turns on the "back to result" action.
// Anything in `from` that is not an id is ignored, so the page cannot be
// made to link somewhere else.
export default async function AssumptionsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/assumptions">) {
  const { locale } = await params;
  setRequestLocale(locale);

  const { from } = await searchParams;
  const resultId = typeof from === "string" && RESULT_ID.test(from) ? from : null;

  return (
    <PageShell>
      <AssumptionsScreen resultId={resultId} />
    </PageShell>
  );
}
