"use client";

import type { MouseEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

// The language switch in the header: "ID EN", the current one underlined.
// Choosing the other language reloads the same page in that language.
export function LanguageToggle() {
  const t = useTranslations("common");
  const currentLocale = useLocale();
  // The path without its language: "/plan" for both /id/plan and /en/plan.
  const pathname = usePathname();
  const router = useRouter();

  // The link below points at the same path in the other language, which
  // is enough for most pages. When the address also has a query string or
  // a hash (?address=...), a plain link would drop them, so this handler
  // takes over and carries them across.
  function keepQueryAndHash(event: MouseEvent, locale: Locale) {
    const { search, hash } = window.location;
    if (!search && !hash) return;
    event.preventDefault();
    router.push(`${pathname}${search}${hash}`, { locale });
  }

  return (
    <nav aria-label={t("language.navLabel")} className="flex text-sm font-bold">
      {routing.locales.map((locale) => {
        const isCurrent = locale === currentLocale;
        // Each item is a 44 × 44 px touch target with the two letters at
        // its right edge, so "EN" lines up with the page gutter.
        const boxClass = "flex min-h-11 min-w-11 items-center justify-end no-underline";
        const text = (
          <span
            className={
              isCurrent
                ? "border-b-heavy border-current px-0.5 pb-[9px] pt-[11.5px]"
                : "px-0.5 pb-[9px] pt-[9px] text-soft"
            }
          >
            <span aria-hidden="true">{locale.toUpperCase()}</span>
            {/* Screen readers get the language's full name. */}
            <span className="sr-only">{t(`language.names.${locale}`)}</span>
          </span>
        );

        if (isCurrent) {
          return (
            <span key={locale} aria-current="true" className={boxClass}>
              {text}
            </span>
          );
        }

        return (
          <Link
            key={locale}
            href={pathname}
            locale={locale}
            lang={locale}
            hrefLang={locale}
            onClick={(event) => keepQueryAndHash(event, locale)}
            className={boxClass}
          >
            {text}
          </Link>
        );
      })}
    </nav>
  );
}
