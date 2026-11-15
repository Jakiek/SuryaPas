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

// One radio question with its own message. The message belongs to the
// question, so it appears under it, and only once the user has gone past
// the question without answering: focus left the group (`onLeave`), or
// the caller says a later question was answered (`error` is then set).
// Wrapping div's onBlur fires when focus moves between its radios too, so
// it only counts when the new focus is outside the group.
export function ChoiceQuestion({
  error,
  onLeave,
  children,
}: {
  error?: string;
  onLeave: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) onLeave();
      }}
    >
      {children}
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
