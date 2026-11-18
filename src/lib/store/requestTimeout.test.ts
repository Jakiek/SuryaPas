import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWithTimeout } from "./requestTimeout";

afterEach(() => vi.unstubAllGlobals());

describe("fetchWithTimeout", () => {
  it("fails within the limit when the request hangs", async () => {
    // A server that never answers: the promise settles only when aborted.
    vi.stubGlobal(
      "fetch",
      (_input: unknown, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const started = Date.now();
    await expect(fetchWithTimeout(100)("http://db.test/rest/v1/x")).rejects.toBeDefined();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("passes a quick answer through untouched", async () => {
    vi.stubGlobal("fetch", async () => new Response("ok"));
    const response = await fetchWithTimeout(100)("http://db.test/rest/v1/x");
    expect(await response.text()).toBe("ok");
  });
});
