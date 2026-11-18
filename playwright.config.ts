import { defineConfig, devices } from "@playwright/test";
import { BASE_URL, PORT, STORE_DOWN_PORT, STORE_DOWN_URL } from "./tests/e2e/support/server";

// The end-to-end tests run against a production build (`next build` then
// `next start`), so they also cover what only a build contains, such as
// MapLibre's worker file. Decided 2026-11-15.
//
// They need no network and no account:
//   - The server runs with tests/e2e/support/server-fixtures.cjs preloaded. It
//     answers NASA POWER, Photon and the database from recorded fixtures and
//     refuses every other outside request.
//   - Supabase variables are set to nothing for the main server, so Next uses
//     the in-memory store whatever is in .env.local.
//   - Chromium cannot resolve any host but localhost, so map tiles and every
//     other outside address fail at once, as they would on a plane.
//
// A second server, from the same build, points at a database that fails every call.
// Only tests/e2e/store-down.spec.ts talks to it.

// Set on the servers only, not on the build or on npm, which would be refused
// the outside requests they make (npm's advisory check, for one).
const serverEnv = {
  NODE_OPTIONS: "--require ./tests/e2e/support/server-fixtures.cjs",
  NEXT_TELEMETRY_DISABLED: "1",
};
// `next` itself, not `npm run start`, so no npm process sits in between.
const NEXT = "./node_modules/.bin/next";
const nodeOptions = `NODE_OPTIONS="${serverEnv.NODE_OPTIONS}"`;
// E2E_REUSE_SERVER=1 reuses servers already running on the two ports, for
// writing a test without waiting for a build each time. Never set in a real run.
const reuse = Boolean(process.env.E2E_REUSE_SERVER);
const storeDownSpec = /store-down\.spec\.ts$/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  // Four browsers at a time leave the three servers room to answer, so a slow
  // machine does not turn a correct page into a timeout.
  workers: 4,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    // Phone first: every test runs at 375 px wide unless it says otherwise.
    viewport: { width: 375, height: 812 },
    launchOptions: { args: ["--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost"] },
  },
  projects: [
    {
      name: "chromium",
      testIgnore: storeDownSpec,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "chromium-store-down",
      testMatch: storeDownSpec,
      use: { ...devices["Desktop Chrome"], viewport: { width: 375, height: 812 }, baseURL: STORE_DOWN_URL },
    },
  ],
  webServer: [
    {
      // The build is done once, here; the second server reuses it.
      command: `npm run build && ${nodeOptions} ${NEXT} start --port ${PORT}`,
      url: `${BASE_URL}/id`,
      reuseExistingServer: reuse,
      timeout: 600_000,
      // NODE_OPTIONS is in the command, so that it reaches `next start` and not the build or npm.
      env: { NEXT_TELEMETRY_DISABLED: "1", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" },
    },
    {
      command: `${NEXT} start --port ${STORE_DOWN_PORT}`,
      url: `${STORE_DOWN_URL}/id`,
      reuseExistingServer: reuse,
      timeout: 120_000,
      env: { ...serverEnv, SUPABASE_URL: "http://supabase.test", SUPABASE_SERVICE_ROLE_KEY: "test-key-not-real" },
    },
  ],
});
