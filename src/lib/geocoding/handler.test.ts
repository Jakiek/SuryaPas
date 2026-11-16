import { describe, expect, it, vi } from "vitest";
import { handleGeocodeRequest, type GeocodeDeps } from "./handler";
import { createRateLimiter } from "./rateLimit";

const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/geocode", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const photonAnswer = {
  features: [
    {
      properties: { name: "Malioboro", city: "Yogyakarta", countrycode: "ID" },
      geometry: { type: "Point", coordinates: [110.3659, -7.7929] },
    },
  ],
};

function deps(fetcher: GeocodeDeps["fetcher"], limit = 1000): GeocodeDeps {
  return { fetcher, limiter: createRateLimiter(() => 0, limit) };
}

describe("handleGeocodeRequest", () => {
  it("answers with places and forbids caching", async () => {
    const fetcher = vi.fn(async () => Response.json(photonAnswer));
    const response = await handleGeocodeRequest(post({ q: "Malioboro" }), deps(fetcher));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual([
      { label: "Malioboro, Yogyakarta", lat: -7.7929, lon: 110.3659 },
    ]);
  });

  it("rejects a missing, short, long or unreadable query without calling the geocoder", async () => {
    const fetcher = vi.fn();
    for (const body of [{}, { q: "" }, { q: "ab" }, { q: "a".repeat(201) }, { q: 5 }, "not json"]) {
      expect((await handleGeocodeRequest(post(body), deps(fetcher))).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("no longer answers a GET with the text in the URL", async () => {
    const fetcher = vi.fn();
    const request = new Request("http://localhost/api/geocode?q=Malioboro");
    // The route file exports only POST, so Next answers GET with 405; the
    // handler itself finds no body and refuses.
    expect((await handleGeocodeRequest(request, deps(fetcher))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports 502 when the geocoder fails or errors", async () => {
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    expect((await handleGeocodeRequest(post({ q: "Malioboro" }), deps(down))).status).toBe(502);
    const broken = vi.fn(async () => new Response("no", { status: 500 }));
    expect((await handleGeocodeRequest(post({ q: "Malioboro" }), deps(broken))).status).toBe(502);
  });

  it("answers 429 once a caller is over the limit, and counts callers apart", async () => {
    const fetcher = vi.fn(async () => Response.json(photonAnswer));
    const d = deps(fetcher, 2);
    const from = (ip: string) => handleGeocodeRequest(post({ q: "Malioboro" }, { "x-forwarded-for": ip }), d);
    expect((await from("1.1.1.1")).status).toBe(200);
    expect((await from("1.1.1.1")).status).toBe(200);
    expect((await from("1.1.1.1")).status).toBe(429);
    expect((await from("2.2.2.2")).status).toBe(200);
  });

  it("never writes the search text to the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) => vi.spyOn(console, m));
    const failing = vi.fn(async () => {
      throw new Error("offline");
    });
    await handleGeocodeRequest(post({ q: "Jalan Rahasia 7" }), deps(failing));
    await handleGeocodeRequest(post({ q: "Jalan Rahasia 7" }), deps(vi.fn(async () => Response.json(photonAnswer))));
    for (const spy of spies) expect(spy).not.toHaveBeenCalled();
    spies.forEach((spy) => spy.mockRestore());
  });
});
