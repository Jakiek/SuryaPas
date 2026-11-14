import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// SPEC 4 and T09: the Supabase service-role key is read in server code only.
// Two checks guard that. The first reads the source and runs on every
// `npm run check`. The second reads a finished build, when one exists.

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const KEY_NAME = "SUPABASE_SERVICE_ROLE_KEY";
// The one file allowed to read the key.
const KEY_READER = join(SRC, "lib", "store", "server.ts");

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const isSource = (path: string) => /\.(ts|tsx)$/.test(path) && !/\.test\.tsx?$/.test(path);
const sourceFiles = filesUnder(SRC).filter(isSource);

describe("service-role key stays on the server", () => {
  it("is read by server.ts and by no other source file", () => {
    const readers = sourceFiles.filter((file) => readFileSync(file, "utf8").includes(KEY_NAME));
    expect(readers.map((file) => relative(ROOT, file))).toEqual([relative(ROOT, KEY_READER)]);
  });

  it("is read only in a file that imports 'server-only'", () => {
    const text = readFileSync(KEY_READER, "utf8");
    expect(text).toMatch(/^import "server-only";$/m);
  });

  it("never appears under a NEXT_PUBLIC_ name, which Next.js sends to the browser", () => {
    const publicNames = [...sourceFiles, join(ROOT, ".env.example")]
      .filter((file) => existsSync(file))
      .filter((file) => /NEXT_PUBLIC_SUPABASE_SERVICE/.test(readFileSync(file, "utf8")));
    expect(publicNames).toEqual([]);
  });

  it("is not reachable from a client component by importing the server store", () => {
    // A file that starts with "use client" may import types from the store
    // but not its code. (The 'server-only' import would also fail the build;
    // this gives the earlier, clearer message.)
    const offenders = sourceFiles.filter((file) => {
      const text = readFileSync(file, "utf8");
      if (!/^\s*["']use client["']/.test(text)) return false;
      const storeImports = text.match(/^import(?! type).*["'][^"']*lib\/store[^"']*["']/gm);
      return storeImports !== null;
    });
    expect(offenders.map((file) => relative(ROOT, file))).toEqual([]);
  });
});

describe("a finished build", () => {
  const clientBundleDir = join(ROOT, ".next", "static");

  // Only meaningful after `next build`. When there is no build, say so in the
  // test name instead of passing silently.
  const hasBuild = existsSync(clientBundleDir);
  const runIfBuilt = hasBuild ? it : it.skip;

  runIfBuilt("has neither the key's name nor its value in .next/static", () => {
    const secret = process.env[KEY_NAME];
    const leaks: string[] = [];
    for (const file of filesUnder(clientBundleDir)) {
      const text = readFileSync(file, "utf8");
      if (text.includes(KEY_NAME)) leaks.push(`${relative(ROOT, file)} names ${KEY_NAME}`);
      if (secret && text.includes(secret)) leaks.push(`${relative(ROOT, file)} holds the key value`);
    }
    expect(leaks).toEqual([]);
  });
});
