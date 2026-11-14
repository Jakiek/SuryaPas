import { defineConfig, devices } from "@playwright/test";

const port = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    // Phone first: every test runs at 375 px wide unless it says otherwise.
    viewport: { width: 375, height: 812 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } } }],
  webServer: {
    command: `npm run dev -- --port ${port}`,
    url: `http://localhost:${port}/id`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
