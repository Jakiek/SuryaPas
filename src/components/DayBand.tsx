import { useTranslations } from "next-intl";
import { cx } from "./cx";

// The day of docs/DESIGN.md "Day band": night, day, night in the
// proportions 6:12:6, which is midnight to 06.00, 06.00 to 18.00, and
// 18.00 to midnight.
const HOURS_IN_DAY = 24;
const DAY_STARTS_AT = 6;
const DAY_ENDS_AT = 18;
// The hours written under the band.
const TICK_HOURS = [0, DAY_STARTS_AT, 12, DAY_ENDS_AT, HOURS_IN_DAY];

type DayBandProps = {
  // "chart": a thin strip with hour ticks, placed directly under a day
  // chart. "banner": a taller strip with no ticks, for the bottom edge of
  // the landing hero.
  variant?: "chart" | "banner";
  // The words in the middle part; "Siang" when left out.
  dayLabel?: string;
  // The colour of the middle part. It is yellow, except where the band
  // sits on a yellow field, where white keeps it visible.
  dayTone?: "sun" | "paper";
  className?: string;
};

// The strip that shows which part of a day is "sun": navy, yellow, navy,
// labelled malam, siang, malam.
//
// Under a chart, give the chart the same width as this band and draw
// hour h at h/24 of that width; the band then lines up with the chart.
//
// It is hidden from screen readers: the chart's caption states the
// finding in words.
export function DayBand({
  variant = "chart",
  dayLabel,
  dayTone = "sun",
  className,
}: DayBandProps) {
  const t = useTranslations("common");
  const isBanner = variant === "banner";

  const nightHours = DAY_STARTS_AT;
  const dayHours = DAY_ENDS_AT - DAY_STARTS_AT;
  const eveningHours = HOURS_IN_DAY - DAY_ENDS_AT;

  // Banner labels sit at the page gutter; chart labels are centred.
  // The letter-spacing is set here, next to the font size, because it is
  // measured in em of this size.
  const shared =
    "overflow-hidden whitespace-nowrap font-extrabold uppercase tracking-[0.12em]";
  const partClass = isBanner
    ? cx(shared, "px-gutter py-[7px] text-[11px] leading-[1.5]")
    : cx(shared, "text-center text-[10px] leading-[18px]");

  return (
    <div aria-hidden="true" className={className}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `${nightHours}fr ${dayHours}fr ${eveningHours}fr`,
        }}
      >
        <span className={cx(partClass, "bg-night text-paper")}>
          {t("dayBand.night")}
        </span>
        <span
          className={cx(
            partClass,
            "text-center text-night",
            dayTone === "sun" ? "bg-sun" : "bg-paper",
          )}
        >
          {dayLabel ?? t("dayBand.day")}
        </span>
        <span
          className={cx(partClass, "bg-night text-paper", isBanner && "text-right")}
        >
          {t("dayBand.night")}
        </span>
      </div>

      {!isBanner && (
        <div className="relative h-[22px] text-[10.5px] font-bold tabular-nums text-soft">
          {TICK_HOURS.map((hour) => (
            <span
              key={hour}
              className={cx(
                "absolute top-[5px]",
                // The first and last ticks stay inside the band's edges;
                // the others are centred on their hour.
                hour === 0 && "left-0",
                hour === HOURS_IN_DAY && "right-0",
                hour > 0 && hour < HOURS_IN_DAY && "-translate-x-1/2",
              )}
              style={
                hour > 0 && hour < HOURS_IN_DAY
                  ? { left: `${(hour / HOURS_IN_DAY) * 100}%` }
                  : undefined
              }
            >
              {t("dayBand.hour", { hour: String(hour).padStart(2, "0") })}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
