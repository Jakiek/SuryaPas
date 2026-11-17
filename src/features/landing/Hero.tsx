import { useTranslations } from "next-intl";
import { Band, BoxedWord, DayBand, Inner, PosterHeading } from "@/components";
import { HeroForm } from "./HeroForm";

// The yellow band at the top of the page: the headline, then the tool's
// first input, then the one-line promise. From 880 px the input sits beside
// the line (docs/DESIGN.md "Layout"). The day band closes it, as in the mock.
export function Hero() {
  const t = useTranslations("landing.hero");

  return (
    <Band tone="sun">
      <Inner className="pb-[34px] pt-1.5 lg:pb-14">
        <PosterHeading as="h1" size="hero" className="mt-[22px] lg:mt-9">
          {t.rich("heading", { box: (chunks) => <BoxedWord>{chunks}</BoxedWord> })}
        </PosterHeading>
        <div className="lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-12">
          <HeroForm />
          <p className="mt-[22px] max-w-[26em] text-[19px] font-semibold leading-[1.35] lg:mt-0 lg:text-[22px]">
            {t("lede")}
          </p>
        </div>
      </Inner>
      <DayBand variant="banner" dayTone="paper" dayLabel={t("dayLabel")} />
    </Band>
  );
}
