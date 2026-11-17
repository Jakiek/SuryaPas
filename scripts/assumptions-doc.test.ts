// docs/ASSUMPTIONS.md is the research record behind the assumption set, under the
// same keys. This test keeps the two from drifting: add an entry to the code without
// a row in the document (or the other way round) and it fails, naming the keys.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_ASSUMPTIONS } from "../src/engine/assumptions";

// Sections whose rows are not entries of the set: rules the engine code applies, and settings of the sun-data code.
const SECTIONS_OUTSIDE_THE_SET = ["Rules built into the engine", "Sun data"];

/** Every key the code holds: the scalar entries, plus the tariff classes, the orientation table and the battery sizes. */
function keysInCode(): string[] {
  const { entries, powerClasses } = CURRENT_ASSUMPTIONS;
  return [
    ...Object.keys(entries),
    ...Object.keys(powerClasses.classes).map((name) => `powerClasses.classes.${name}`),
    "orientation.table",
    "batterySizesKwh.sizes",
  ];
}

/** The key in the first cell of every table row, such as "| `capex.perKwp.low` | ...", outside the excluded sections. */
function keysInDocument(): string[] {
  const text = readFileSync(path.join(process.cwd(), "docs", "ASSUMPTIONS.md"), "utf8");
  const keys: string[] = [];
  let inSection = true;
  for (const line of text.split("\n")) {
    const heading = /^#{2,3} (.*)/.exec(line);
    // Only a "##" heading changes the section; "###" subsections stay inside their parent.
    if (heading && line.startsWith("## ")) inSection = !SECTIONS_OUTSIDE_THE_SET.includes(heading[1].trim());
    const firstCell = /^\| `([A-Za-z0-9_.]+\.[A-Za-z0-9_.]+)` \|/.exec(line);
    if (inSection && firstCell) keys.push(firstCell[1]);
  }
  return keys;
}

describe("docs/ASSUMPTIONS.md", () => {
  const inCode = new Set(keysInCode());
  const inDocument = new Set(keysInDocument());

  it("has a row for every key of the assumption set", () => {
    const missing = [...inCode].filter((key) => !inDocument.has(key));
    expect(missing, `in the code but not in the document: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no row for a key the assumption set lacks", () => {
    const extra = [...inDocument].filter((key) => !inCode.has(key));
    expect(extra, `in the document but not in the code: ${extra.join(", ")}`).toEqual([]);
  });

  it("lists no key twice", () => {
    expect(keysInDocument().length).toBe(inDocument.size);
  });
});
