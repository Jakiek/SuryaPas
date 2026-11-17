// docs/ASSUMPTIONS.md is the research record behind the assumption set, under the
// same keys. This test keeps the two from drifting: add an entry to the code without
// a row in the document (or the other way round) and it fails, naming the keys.

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CURRENT_ASSUMPTIONS } from "../src/engine/assumptions";

// Sections whose rows are not entries of the set: rules the engine code applies, and settings of the sun-data code.
const SECTIONS_OUTSIDE_THE_SET = ["Rules built into the engine", "Sun data"];

/** The data fields of a block such as `orientation` (every field but its note), named as the document names them. */
function fieldKeys(blockName: string, block: object): string[] {
  return Object.keys(block)
    .filter((field) => field !== "note")
    .map((field) => `${blockName}.${field}`);
}

/** Every key the code holds: the scalar entries, plus the tariff classes, the orientation table and the battery sizes. */
function keysInCode(): string[] {
  const { entries, powerClasses, orientation, batterySizesKwh } = CURRENT_ASSUMPTIONS;
  return [
    ...Object.keys(entries),
    ...Object.keys(powerClasses.classes).map((name) => `powerClasses.classes.${name}`),
    ...fieldKeys("orientation", orientation),
    ...fieldKeys("batterySizesKwh", batterySizesKwh),
  ];
}

// A key cell is exactly one dotted name between backticks, such as "| `capex.perKwp.low` |".
const KEY_CELL = /^\| `([A-Za-z0-9_.]+\.[A-Za-z0-9_.]+)` \|/;

interface DocumentScan {
  /** The key in the first cell of every well-formed row, outside the excluded sections. */
  keys: string[];
  /** Rows inside the checked sections whose first cell is backticked but is not one dotted key. */
  malformedRows: string[];
}

function scanDocument(): DocumentScan {
  const text = readFileSync(path.join(process.cwd(), "docs", "ASSUMPTIONS.md"), "utf8");
  const keys: string[] = [];
  const malformedRows: string[] = [];
  // The intro before the first "##" heading holds the confidence-label legend, not keys, so it starts outside.
  let inSection = false;
  for (const line of text.split("\n")) {
    const heading = /^#{2,3} (.*)/.exec(line);
    // Only a "##" heading changes the section; "###" subsections stay inside their parent.
    if (heading && line.startsWith("## ")) inSection = !SECTIONS_OUTSIDE_THE_SET.includes(heading[1].trim());
    if (!inSection || !line.startsWith("| `")) continue;
    const keyCell = KEY_CELL.exec(line);
    if (keyCell) keys.push(keyCell[1]);
    else malformedRows.push(line);
  }
  return { keys, malformedRows };
}

describe("docs/ASSUMPTIONS.md", () => {
  const scan = scanDocument();
  const inCode = new Set(keysInCode());
  const inDocument = new Set(scan.keys);

  it("has a row for every key of the assumption set", () => {
    const missing = [...inCode].filter((key) => !inDocument.has(key));
    expect(missing, `in the code but not in the document: ${missing.join(", ")}`).toEqual([]);
  });

  it("has no row for a key the assumption set lacks", () => {
    const extra = [...inDocument].filter((key) => !inCode.has(key));
    expect(extra, `in the document but not in the code: ${extra.join(", ")}`).toEqual([]);
  });

  it("lists no key twice", () => {
    expect(scan.keys.length).toBe(inDocument.size);
  });

  it("has only single dotted keys in the first cell of its rows", () => {
    expect(scan.malformedRows, `rows whose first cell is not one dotted key: ${scan.malformedRows.join(" / ")}`).toEqual([]);
  });
});
