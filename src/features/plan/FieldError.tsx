import { cx } from "@/components/cx";

// A message under a field that has no error slot of its own (the select
// below). Same look as the error inside NumberField: a red bar on the
// left, navy words (docs/DESIGN.md "Components", Caveat).
export function FieldError({ id, children }: { id?: string; children: string }) {
  return (
    <p
      id={id}
      className={cx("mt-2.5 border-l-[6px] border-alert pl-3 text-[15px] font-bold")}
    >
      {children}
    </p>
  );
}
