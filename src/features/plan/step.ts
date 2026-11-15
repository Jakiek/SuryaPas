// The contract every step follows (SPEC 5.2). A step receives its own slice
// of the draft and reports two things upward: a new value whenever the user
// changes something, and whether the slice is valid. The shell owns
// navigation and storage; a step never navigates or saves.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { z } from "zod";
import { messageKeysByField } from "@/lib/schema";

export interface StepProps<Value> {
  value: Value;
  onChange: (next: Value) => void;
  onValidChange: (valid: boolean) => void;
}

/**
 * Checks the slice against its schema and tells the shell whether it is
 * valid. Returns the message key of each invalid field, keyed by dotted
 * path ("connectedVa", "monthlySpendRp.0").
 *
 * `onValidChange` must keep the same identity between renders, or the
 * effect below runs every time.
 */
export function useStepValidity<Value>(
  schema: z.ZodType<unknown>,
  value: Value,
  onValidChange: (valid: boolean) => void,
): Record<string, string> {
  const result = schema.safeParse(value);
  const valid = result.success;

  useEffect(() => {
    onValidChange(valid);
  }, [valid, onValidChange]);

  return result.success ? {} : messageKeysByField(result.error);
}

/**
 * Decides which error messages are visible. A field is only scolded after
 * the user has left it, so nobody sees "required" on a box they have not
 * reached yet. Returns `touch(field)` for the field's onBlur, and
 * `messageFor(field)` giving the translated message or undefined.
 *
 * `errors` is what useStepValidity returned: message keys such as
 * "errors.billRequired", which live in the "plan" message file.
 */
export function useVisibleErrors(errors: Record<string, string>) {
  const t = useTranslations("plan");
  const [touched, setTouched] = useState<Set<string>>(new Set());

  return {
    touch: (field: string) => setTouched((all) => new Set(all).add(field)),
    messageFor: (field: string): string | undefined =>
      touched.has(field) && errors[field] ? t(errors[field] as never) : undefined,
  };
}
