import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // The same "@/..." shortcut as tsconfig.json, so tests can import the way the app does.
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // Unit tests sit next to the code they test; Playwright owns tests/e2e.
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
});
