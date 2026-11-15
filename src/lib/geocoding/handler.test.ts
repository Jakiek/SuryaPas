import { describe, expect, it, vi } from "vitest";
import { handleGeocodeRequest } from "./handler";

const request = (query: string) => new Request(`http://localhost/api/geocode${query}`);

const photonAnswer = {
  features: [
    {
      properties: { name: "Malioboro", city: "Yogyakarta", countrycode: "ID" },
      geometry: { type: "Point", coordinates: [110.3659, -7.7929] },
    },
  ],
};

describe("handleGeocodeRequest", () => {
  it("answers with places and forbids caching", async () => {
    const fetcher = vi.fn(async () => Response.json(photonAnswer));
    const response = await handleGeocodeRequest(request("?q=Malioboro"), fetcher);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual([
      { label: "Malioboro, Yogyakarta", lat: -7.7929, lon: 110.3659 },
    ]);
  });

  it("rejects a missing, short or very long query without calling the geocoder", async () => {
    const fetcher = vi.fn();
    for (const query of ["", "?q=", "?q=ab", `?q=${"a".repeat(201)}`]) {
      expect((await handleGeocodeRequest(request(query), fetcher)).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports 502 when the geocoder fails or errors", async () => {
    const down = vi.fn(async () => {
      throw new Error("offline");
    });
    expect((await handleGeocodeRequest(request("?q=Malioboro"), down)).status).toBe(502);
    const broken = vi.fn(async () => new Response("no", { status: 500 }));
    expect((await handleGeocodeRequest(request("?q=Malioboro"), broken)).status).toBe(502);
  });
});
