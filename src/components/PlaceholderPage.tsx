import { useTranslations } from "next-intl";
import { Inner } from "./Band";
import { PageShell } from "./PageShell";
import { PosterHeading } from "./PosterHeading";

type PlaceholderPageProps = {
  // Which entry of common.routes supplies the title.
  route:
    | "landing"
    | "plan"
    | "result"
    | "assumptions"
    | "account"
    | "installers"
    | "admin";
  // Shown under the title, e.g. the result id on /r/[id].
  detail?: string;
  // The three stage-2/3 routes say "coming soon" instead of "being built".
  comingSoon?: boolean;
};

// A titled stub that later tasks replace with the real screen.
export function PlaceholderPage({
  route,
  detail,
  comingSoon = false,
}: PlaceholderPageProps) {
  const t = useTranslations("common");

  return (
    <PageShell>
      <Inner className="pb-12 pt-6">
        <PosterHeading as="h1" size="page">
          {t(`routes.${route}.title`)}
        </PosterHeading>
        <div className="mt-3 max-w-measure text-[17px] font-medium">
          <p>{comingSoon ? t("comingSoon.title") : t("placeholder.body")}</p>
          {comingSoon && <p>{t("comingSoon.body")}</p>}
          {detail && <p>{detail}</p>}
        </div>
      </Inner>
    </PageShell>
  );
}
