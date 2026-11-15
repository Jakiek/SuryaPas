import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Band, Inner, type BandTone } from "./Band";
import { cx } from "./cx";
import { LanguageToggle } from "./LanguageToggle";
import { Wordmark } from "./Wordmark";

// The row at the top of every screen: the wordmark on the left, the
// language toggle on the right. It has no colour of its own; it takes
// the colours of the band it is placed in.
export function SiteHeader() {
  return (
    <header className="flex items-center justify-between py-[18px]">
      <Wordmark />
      <LanguageToggle />
    </header>
  );
}

type SiteFooterProps = {
  // Navy on the landing page, white on the report.
  tone?: BandTone;
  // A line specific to this page, shown before the standing disclaimer.
  children?: ReactNode;
};

// The foot of every screen. It always carries the disclaimer that a
// SuryaPas result is an estimate and not a price offer.
export function SiteFooter({ tone = "paper", children }: SiteFooterProps) {
  const t = useTranslations("common");

  return (
    <Band as="footer" tone={tone} className="pb-[34px] pt-[26px] text-sm">
      <Inner>
        <p className={cx("max-w-[36em]", tone === "paper" && "text-soft")}>
          {children} {t("footer.disclaimer")}
        </p>
      </Inner>
    </Band>
  );
}

type PageShellProps = {
  // The colour behind the header. Make it the colour of the page's first
  // band, so header and first band read as one field: "sun" on the
  // landing page, "night" on the result, "paper" in the flow.
  headerTone?: BandTone;
  footerTone?: BandTone;
  // Passed on to the footer; see SiteFooter.
  footerNote?: ReactNode;
  // The page itself: bands, or content inside an <Inner>.
  children: ReactNode;
};

// The frame shared by every screen: header, main area, footer. The main
// area grows so the footer sits at the bottom of a short page.
export function PageShell({
  headerTone = "paper",
  footerTone = "paper",
  footerNote,
  children,
}: PageShellProps) {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-dvh flex-col">
      {/* For keyboard users: the first Tab stop jumps past the header.
          Invisible until it has focus. */}
      <a
        href="#main"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-2 focus-visible:top-2 focus-visible:z-10 focus-visible:bg-paper focus-visible:px-3 focus-visible:py-2 focus-visible:font-bold focus-visible:text-night"
      >
        {t("skipToContent")}
      </a>
      <Band tone={headerTone}>
        <Inner>
          <SiteHeader />
        </Inner>
      </Band>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter tone={footerTone}>{footerNote}</SiteFooter>
    </div>
  );
}
