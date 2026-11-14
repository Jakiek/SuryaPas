import { describe, expect, it, vi } from "vitest";
import { MemorySunCache } from "./cache";
import { handleSunRequest } from "./handler";
import { defaultDeps } from "./service";

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
  it("answers 422", async () => {
    const response = await ask("?lat=51.5&lon=-0.12"); // London
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: "outside_indonesia" });
  });
});
