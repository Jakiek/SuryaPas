import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { namespaces } from "./namespaces";
import { routing } from "./routing";

const messagesDir = path.join(process.cwd(), "messages");

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// Turns { a: { b: "x" } } into ["a.b"], so two files can be compared by key.
function flattenKeys(value: Json, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    flattenKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

function readMessages(locale: string, namespace: string): Json {
  const file = path.join(messagesDir, locale, `${namespace}.json`);
  return JSON.parse(readFileSync(file, "utf8")) as Json;
}

describe("message files", () => {
  const [first, ...others] = routing.locales;

  it("have the same namespace files in every locale", () => {
    const filesOf = (locale: string) => readdirSync(path.join(messagesDir, locale)).sort();
    for (const locale of others) {
      expect(filesOf(locale)).toEqual(filesOf(first));
    }
  });

  it("have a file for every registered namespace", () => {
    for (const locale of routing.locales) {
      const files = readdirSync(path.join(messagesDir, locale)).sort();
      expect(files).toEqual(namespaces.map((name) => `${name}.json`).sort());
    }
  });

  for (const namespace of namespaces) {
    it(`have identical keys in every locale for "${namespace}"`, () => {
      const expected = flattenKeys(readMessages(first, namespace)).sort();
      for (const locale of others) {
        const actual = flattenKeys(readMessages(locale, namespace)).sort();
        expect(actual, `${locale}/${namespace}.json vs ${first}/${namespace}.json`).toEqual(
          expected,
        );
      }
    });
  }
});
