import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Engine purity (SPEC 5): code in src/engine/ imports only other
// files inside src/engine/. No packages, no "@/" aliases, no node: modules.
//
// The pattern below matches every import path that does not start with ".",
// which is exactly the set of package, alias and node: imports.
const BARE_IMPORT = "^[^.]";
// Test files may import vitest and nothing else.
const BARE_IMPORT_EXCEPT_VITEST = "^(?!vitest$)[^.]";

const noOutsideImports = (barePattern) => ({
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          regex: barePattern,
          message:
            "src/engine/ may not import packages or anything outside src/engine/.",
        },
      ],
    },
  ],
  // Dynamic import() and require() are not covered by no-restricted-imports.
  "no-restricted-syntax": [
    "error",
    {
      selector: "ImportExpression",
      message: "src/engine/ may not use dynamic import().",
    },
    {
      selector: "CallExpression[callee.name='require']",
      message: "src/engine/ may not use require().",
    },
  ],
});

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/engine/**/*.{ts,tsx}"],
    rules: noOutsideImports(BARE_IMPORT),
  },
  {
    files: ["src/engine/**/*.test.ts"],
    rules: noOutsideImports(BARE_IMPORT_EXCEPT_VITEST),
  },
  {
    // A relative path such as "../../app/x" starts with "." but still leaves
    // the engine; this rule resolves the path and catches that case.
    files: ["src/engine/**/*.{ts,tsx}"],
    rules: {
      "import/no-restricted-paths": [
        "error",
        {
          zones: [
            {
              target: "./src/engine",
              // Packages live in node_modules, outside src, so they are not
              // this rule's job; BARE_IMPORT above already bans them.
              from: "./src",
              except: ["./engine"],
              message: "src/engine/ may not import from outside src/engine/.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
  ]),
]);

export default eslintConfig;
