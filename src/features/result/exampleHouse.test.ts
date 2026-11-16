import { afterEach, describe, expect, it, vi } from "vitest";
import { assess, CURRENT_ASSUMPTIONS } from "../../engine";
import { loadFallbackFile } from "../../lib/sun/fallback";
import { assessExampleHouse, EXAMPLE_INPUTS } from "./exampleHouse";

afterEach(() => vi.unstubAllGlobals());

describe("the example house (/r/example)", () => {
  it("is computed from the bundled files alone, with the network blocked", async () => {
    let fetches = 0;
    vi.stubGlobal("fetch", async () => {
      fetches += 1;
      throw new TypeError("network blocked");
    });

    const result = await assessExampleHouse();

    expect(fetches).toBe(0);
    const sun = await loadFallbackFile("yogyakarta");
    expect(result).toEqual(assess(EXAMPLE_INPUTS, { ghiWm2: sun.series, source: "live" }, CURRENT_ASSUMPTIONS));
  });

  it("is a 2,200 VA postpaid home in Yogyakarta with a system to recommend", async () => {
    expect(EXAMPLE_INPUTS.electricity).toMatchObject({ billing: "postpaid", connectedVa: 2200, subsidised: false });
    const result = await assessExampleHouse();
    expect(result.recommendedPanels).not.toBeNull();
    expect(result.flags).toEqual({ fallbackSunData: false, heavyShade: false, doesNotPayBack: false });
  });
});
