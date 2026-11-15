import { describe, expect, it } from "vitest";
import { buildPhotonUrl, MAX_PLACES, parsePhotonResponse } from "./photon";

function feature(countrycode: string, name: string, lon = 110.36, lat = -7.79) {
  return {
    properties: { name, street: "Jalan Malioboro", city: "Yogyakarta", state: "DIY", countrycode },
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

describe("buildPhotonUrl", () => {
  it("carries the text and limits the search to Indonesia's bounding box", () => {
    const url = new URL(buildPhotonUrl("Malioboro Yogyakarta"));
    expect(url.origin).toBe("https://photon.komoot.io");
    expect(url.searchParams.get("q")).toBe("Malioboro Yogyakarta");
    expect(url.searchParams.get("bbox")).toBe("95,-11.5,141.5,6.5");
  });
});

describe("parsePhotonResponse", () => {
  it("reads label, latitude and longitude, in that order of axes", () => {
    const [place] = parsePhotonResponse({ features: [feature("ID", "Hotel", 110.3669, -7.7908)] });
    expect(place).toEqual({
      label: "Hotel, Jalan Malioboro, Yogyakarta, DIY",
      lat: -7.7908,
      lon: 110.3669,
    });
  });

  it("drops results from other countries", () => {
    const places = parsePhotonResponse({
      features: [feature("MY", "Kuala Lumpur"), feature("ID", "Jakarta")],
    });
    expect(places.map((place) => place.label)).toEqual(["Jakarta, Jalan Malioboro, Yogyakarta, DIY"]);
  });

  it("returns at most five places", () => {
    const features = Array.from({ length: 9 }, (_, i) => feature("ID", `Place ${i}`));
    expect(parsePhotonResponse({ features })).toHaveLength(MAX_PLACES);
  });

  it("does not repeat a part that appears twice in the label", () => {
    const [place] = parsePhotonResponse({
      features: [{ ...feature("ID", "Yogyakarta"), properties: { name: "Yogyakarta", city: "Yogyakarta", countrycode: "ID" } }],
    });
    expect(place.label).toBe("Yogyakarta");
  });

  it("returns nothing for an answer it does not understand", () => {
    expect(parsePhotonResponse(null)).toEqual([]);
    expect(parsePhotonResponse({ features: "no" })).toEqual([]);
    expect(parsePhotonResponse({ features: [{ properties: { countrycode: "ID", name: "x" }, geometry: { type: "Polygon", coordinates: [] } }] })).toEqual([]);
  });
});
