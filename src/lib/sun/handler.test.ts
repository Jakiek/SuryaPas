import { describe, expect, it, vi } from "vitest";
import { MemorySunCache } from "./cache";
import { handleSunRequest } from "./handler";
import { defaultDeps } from "./service";
import { PinOutsideIndonesiaError } from "../timezone/legalTimeZone";

// The sun service looks up the pin's legal time zone, which is "server-only";
// that package throws outside the Next.js server build, and tests are plain Node.
vi.mock("server-only", () => ({}));

const neverCalled = vi.fn(async () => {
  throw new Error("the network must not be used for a rejected request");
}) as unknown as typeof fetch;

const deps = () => ({ ...defaultDeps(new MemorySunCache()), fetchFn: neverCalled });
const ask = (query: string) => handleSunRequest(new Request(`http://localhost/api/sun${query}`), deps());

describe("malformed coordinates", () => {
  it.each([
    ["no parameters", ""],
    ["missing lon", "?lat=-7.75"],
    ["missing lat", "?lon=110.3"],
    ["empty value", "?lat=&lon=110.3"],
    ["not a number", "?lat=abc&lon=110.3"],
    ["exponent notation", "?lat=-7e0&lon=110.3"],
    ["two numbers in one", "?lat=-7.75,3&lon=110.3"],
    ["latitude past the pole", "?lat=95&lon=110.3"],
    ["longitude past the date line", "?lat=-7.75&lon=190"],
  ])("answers 400 for %s", async (_name, query) => {
    const response = await ask(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_coordinates" });
  });
});

describe("a valid point outside Indonesia", () => {
  // The same answer as POST /api/assessments (SPEC 2.2 step 1).
  it.each([
    ["London", "?lat=51.5&lon=-0.12"],
    ["Singapore, inside the box around Indonesia but not in it", "?lat=1.35&lon=103.82"],
    ["Dili, Timor-Leste", "?lat=-8.56&lon=125.58"],
  ])("answers 400 for %s, without asking NASA", async (_name, query) => {
    const response = await ask(query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "outside_indonesia" });
  });

  it("answers 400 when the zone lookup finds no province for a pin the outline let through", async () => {
    const noZone = () => {
      throw new PinOutsideIndonesiaError(-7.8, 110.37);
    };
    const response = await handleSunRequest(new Request("http://localhost/api/sun?lat=-7.8&lon=110.37"), {
      ...deps(),
      legalUtcOffsetHours: noZone,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "outside_indonesia" });
  });
});
