import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFallbackFile } from "../../../lib/sun/fallback";
import { getStore } from "../../../lib/store/server";
import { GET } from "./route";

// The sun service looks up the pin's legal time zone, which is "server-only";
// that package throws outside the Next.js server build, and tests are plain Node.
vi.mock("server-only", () => ({}));

// store/server.ts is "server-only" and would build a Supabase client; the
// route is tested with one in-memory store that the test can break.
vi.mock("../../../lib/store/server", async () => {
  const { MemoryStore } = await import("../../../lib/store/memory");
  const store = new MemoryStore();
  return { getStore: () => store };
});

afterEach(() => vi.unstubAllGlobals());

describe("GET /api/sun with the network blocked", () => {
  it("returns source fallback and the nearest city's series", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });

    const response = await GET(new Request("http://localhost/api/sun?lat=-7.7956&lon=110.3695"));
    const body = await response.json();
    const yogyakarta = await loadFallbackFile("yogyakarta");

    expect(response.status).toBe(200);
    expect(body.source).toBe("fallback");
    expect(body.cellId).toBe("-7.75,110.25");
    expect(body.year).toBe(yogyakarta.year);
    expect(body.series).toHaveLength(8760);
    expect(body.series).toEqual(yogyakarta.series);
  });

  it("still answers when the store behind the cache fails, treating it as a cache miss", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("fetch failed");
    });
    const store = getStore();
    const broken = async () => {
      throw new Error("database paused");
    };
    vi.spyOn(store, "getSunCache").mockImplementation(broken);
    vi.spyOn(store, "putSunCache").mockImplementation(broken);

    const response = await GET(new Request("http://localhost/api/sun?lat=-7.7956&lon=110.3695"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.series).toHaveLength(8760);
    vi.restoreAllMocks();
  });
});
