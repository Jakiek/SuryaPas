import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Unit tests sit next to the code they test; Playwright owns tests/e2e.
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
