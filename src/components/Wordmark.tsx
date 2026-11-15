import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

// The product name: SURYA followed by boxed PAS (docs/DESIGN.md "Type").
// It links to the landing page of the current language.
export function Wordmark() {
  const t = useTranslations("common");

  return (
    <Link
      href="/"
      aria-label={t("wordmark.homeLabel")}
      // min-h-11: the link is 44 px tall, a full touch target, though the
      // letters are 22 px.
      className="type-wordmark inline-flex min-h-11 items-center gap-[3px] no-underline"
    >
      Surya
      <span className="border-heavy border-current px-1 pb-px pt-0.5">Pas</span>
    </Link>
  );
}
