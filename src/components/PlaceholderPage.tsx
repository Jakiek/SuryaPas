import { useTranslations } from "next-intl";

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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-3 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t(`routes.${route}.title`)}</h1>
      <p>{comingSoon ? t("comingSoon.title") : t("placeholder.body")}</p>
      {comingSoon && <p>{t("comingSoon.body")}</p>}
      {detail && <p>{detail}</p>}
    </main>
  );
}
