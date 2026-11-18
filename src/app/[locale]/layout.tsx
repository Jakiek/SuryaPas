import type { Metadata } from "next";
import localFont from "next/font/local";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "../globals.css";

// The two families of docs/DESIGN.md "Type", kept in src/app/fonts (both are
// under the SIL Open Font License; the licence texts sit beside the files).
// They are self-hosted with next/font/local, so a build needs no network and
// the browser never calls Google. Each font is exposed as a CSS variable that
// globals.css reads. Both files are the latin subset of the variable fonts.

// Archivo is a variable font. Its width axis (62% to 125%) is what the poster
// (62%), wordmark (75%) and figure (88%) styles need; weight runs 100 to 900.
const archivo = localFont({
  src: "../fonts/Archivo-latin-variable.woff2",
  weight: "100 900",
  style: "normal",
  // Tells every browser the width axis runs 62% to 125%, as the old Google CSS did.
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
  variable: "--font-archivo",
  display: "swap",
});

// Plus Jakarta Sans, weight 200 to 800.
const jakarta = localFont({
  src: "../fonts/PlusJakartaSans-latin-variable.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-jakarta",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "common" });
  return { title: t("appName") };
}

export default async function LocaleLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  // Lets pages render statically for this locale.
  setRequestLocale(locale);

  return (
    <html lang={locale} className={`${archivo.variable} ${jakarta.variable}`}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
