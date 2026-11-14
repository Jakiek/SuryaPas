import type { JsonValue } from "./types";

// Turns a value into JSON text with object keys in sorted order, so two
// values with the same content give the same text whatever order their keys
// were written in. Postgres json columns do not keep key order, so comparing
// by plain JSON.stringify would call equal assumption sets different.
export function canonicalJson(value: JsonValue): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const keys = Object.keys(value).sort();
    const pairs = keys.map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    );
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(value);
}

// A deep copy that behaves like a round trip through a json column:
// undefined fields disappear, and later changes to the original cannot reach
// the copy. The memory store uses it so it cannot behave more leniently than
// the database does.
export function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
