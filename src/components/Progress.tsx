import { useTranslations } from "next-intl";
import { cx } from "./cx";

type ProgressProps = {
  // The step the user is on, counting from 1.
  current: number;
  // How many steps there are.
  total: number;
  // The name of the current step, such as "Atap".
  name: string;
  className?: string;
};

// Where the user is in the flow: "2/4" in the Figure style, the step name
// as a Label, and one thin segment per step (docs/DESIGN.md "Components").
export function Progress({ current, total, name, className }: ProgressProps) {
  const t = useTranslations("common");
  // [1, 2, 3, 4] for four steps.
  const steps = Array.from({ length: total }, (_, index) => index + 1);

  return (
    <div className={cx("flex items-baseline gap-3 pb-3.5 pt-1", className)}>
      {/* Hidden from screen readers: the segments below say the same
          thing in words. */}
      <span aria-hidden="true" className="type-figure text-figure-sm">
        {current}
        <span className="text-[0.55em] text-soft">/{total}</span>
      </span>
      <span className="type-label">{name}</span>
      <span
        role="img"
        aria-label={t("progress.label", { current, total })}
        className="grid flex-1 gap-[3px] self-center"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {steps.map((step) => (
          <span
            key={step}
            className={cx("h-1", step <= current ? "bg-fg" : "bg-rule")}
          />
        ))}
      </span>
    </div>
  );
}
