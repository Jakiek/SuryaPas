import { afterEach, describe, expect, it, vi } from "vitest";
import { loadFallbackFile } from "../../../lib/sun/fallback";
import { GET } from "./route";

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
});
