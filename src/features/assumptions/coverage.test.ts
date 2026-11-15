// The assumptions screen must explain every entry of the set in both
// languages. Add an entry to the engine without words for it and this fails.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_ASSUMPTIONS, type AssumptionKey } from "../../engine/assumptions";
import { CONFIDENCE_LABELS } from "./confidenceLabels";
import { classifyUnit } from "./units";

type Tree = { [key: string]: Tree | string };

function readNamespace(locale: string): Tree {
  const file = path.join(process.cwd(), "messages", locale, "assumptions.json");
  return JSON.parse(readFileSync(file, "utf8")) as Tree;
}

/** Follows "a.b.c" down a nested message file; undefined when the path is missing. */
function lookup(tree: Tree, dotted: string): string | Tree | undefined {
  let node: Tree | string | undefined = tree;
  for (const part of dotted.split(".")) {
    if (typeof node !== "object") return undefined;
    node = node[part];
  }
  return node;
}

const keys = Object.keys(CURRENT_ASSUMPTIONS.entries) as AssumptionKey[];

for (const locale of ["id", "en"]) {
  describe(`assumptions messages (${locale})`, () => {
    const messages = readNamespace(locale);

    it("name and explain every entry of the set", () => {
      for (const key of keys) {
        for (const part of ["name", "explanation"]) {
          const text = lookup(messages, `entries.${key}.${part}`);
          expect(typeof text === "string" && text.trim().length > 0, `${key}.${part}`).toBe(true);
        }
      }
    });

    it("explain all five confidence labels", () => {
      for (const label of CONFIDENCE_LABELS) {
        expect(typeof lookup(messages, `confidence.labels.${label}.name`)).toBe("string");
        expect(typeof lookup(messages, `confidence.labels.${label}.meaning`)).toBe("string");
      }
    });
  });
}

describe("units", () => {
  it("are all known to the screen", () => {
    const units = Object.values(CURRENT_ASSUMPTIONS.entries).map((entry) => entry.unit);
    for (const unit of units) expect(classifyUnit(unit), unit).not.toBeNull();
  });

  it("have a message for every word unit", () => {
    for (const locale of ["id", "en"]) {
      const messages = readNamespace(locale);
      for (const unit of ["hours", "year", "years", "share", "shareYear", "multiplier", "per"]) {
        expect(typeof lookup(messages, `units.${unit}`), `${locale} ${unit}`).toBe("string");
      }
    }
  });
});
