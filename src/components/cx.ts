// Joins class names, skipping the ones that are switched off:
//   cx("a", isOn && "b", undefined)  ->  "a b" when isOn, otherwise "a"
export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}
