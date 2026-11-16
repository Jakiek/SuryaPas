"use client";

import { useTranslations } from "next-intl";
import { cx } from "@/components/cx";
import type { PickerSlot } from "./view";

type PanelPickerProps = {
  slots: PickerSlot[];
  selected: number;
  recommended: number;
  onSelect: (panels: number) => void;
};

// A row of upright panels (docs/DESIGN.md "Components", SPEC 2.3 item 2).
// Tapping the fifth selects five; every panel up to the selected count is
// filled navy with a faint yellow cell cross. The recommended count carries
// the word "pas". Counts below the smallest system are filled and disabled.
//
// Each panel is a button whose number sits inside it, under the drawing, so
// the whole column is the touch target.
export function PanelPicker({ slots, selected, recommended, onSelect }: PanelPickerProps) {
  const t = useTranslations("result.picker");

  return (
    <div
      role="group"
      aria-label={t("group")}
      // Rows of eight, as in the mock; nine to twelve panels start a second row.
      className="mt-3.5 grid max-w-[440px] grid-cols-8 gap-x-[5px] gap-y-3"
    >
      {slots.map(({ panels, selectable }) => {
        const filled = panels <= selected || !selectable;
        const isRecommended = panels === recommended;

        return (
          <button
            key={panels}
            type="button"
            disabled={!selectable}
            aria-pressed={selectable ? panels === selected : undefined}
            onClick={() => onSelect(panels)}
            className="group flex min-w-0 cursor-pointer flex-col items-stretch disabled:cursor-default"
          >
            <span
              aria-hidden="true"
              className={cx(
                "relative block aspect-[5/8] border-heavy border-night",
                "transition-[background-color] duration-(--motion-ease)",
                filled ? "bg-night" : "bg-transparent group-hover:bg-night/10",
              )}
            >
              {filled && (
                <>
                  {/* The cell cross of a solar panel. */}
                  <span className="absolute inset-x-0 top-1/2 h-[1.5px] -translate-y-1/2 bg-sun" />
                  <span className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-sun opacity-55" />
                </>
              )}
            </span>
            {/* The button's name is its visible text plus a few words for
                screen readers: "2 panel pas, yang pas", "1 panel, di bawah
                ukuran terkecil". */}
            <span className="mt-[7px] text-center text-[13px] font-extrabold leading-[1.2] tabular-nums">
              {panels}
              <span className="sr-only"> {t("unit", { count: panels })}</span>
            </span>
            {isRecommended ? (
              <span className="text-center text-[10.5px] font-extrabold uppercase leading-[1.1] tracking-[0.12em]">
                {t("pas")}
                <span className="sr-only">, {t("pasMeaning")}</span>
              </span>
            ) : (
              // Keeps every column the same height as the recommended one.
              <span aria-hidden="true" className="invisible text-[10.5px] leading-[1.1]">
                {t("pas")}
              </span>
            )}
            {!selectable && <span className="sr-only">, {t("belowMinimum")}</span>}
          </button>
        );
      })}
    </div>
  );
}
