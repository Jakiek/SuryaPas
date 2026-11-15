// The map's look, written as a MapLibre style. The tiles are OpenFreeMap's
// vector tiles (OpenStreetMap data in the OpenMapTiles layout); only the
// colours and line widths here are ours, so the map follows docs/DESIGN.md:
// white land, navy lines, a yellow tint for buildings, no gradients.
//
// A WebGL map cannot read CSS variables, so the colours are repeated here.
// They are the tokens `night`, `sun-soft` and `paper` of globals.css.

import type { StyleSpecification } from "maplibre-gl";

const NIGHT = "#0f1b3d";
const SUN_SOFT = "#fff1bf";
const PAPER = "#ffffff";
// `night` at 15% over white: the sea and lakes.
const WATER = "#dbdde2";

const OPENFREEMAP_TILES = "https://tiles.openfreemap.org/planet";
const OPENFREEMAP_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";

// Road classes of the OpenMapTiles schema, drawn from small to large.
const MINOR_ROADS = ["minor", "service", "track", "path"];
const MAIN_ROADS = ["tertiary", "secondary", "primary", "trunk", "motorway"];

export const mapStyle: StyleSpecification = {
  version: 8,
  glyphs: OPENFREEMAP_GLYPHS,
  sources: {
    openmaptiles: { type: "vector", url: OPENFREEMAP_TILES },
  },
  layers: [
    { id: "land", type: "background", paint: { "background-color": PAPER } },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      paint: { "fill-color": WATER },
    },
    {
      id: "buildings",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 14,
      paint: { "fill-color": SUN_SOFT, "fill-outline-color": NIGHT },
    },
    {
      id: "roads-minor",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 13,
      filter: ["in", ["get", "class"], ["literal", MINOR_ROADS]],
      layout: { "line-cap": "butt" },
      paint: {
        "line-color": NIGHT,
        "line-opacity": 0.45,
        "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 18, 3],
      },
    },
    {
      id: "roads-main",
      type: "line",
      source: "openmaptiles",
      "source-layer": "transportation",
      minzoom: 6,
      filter: ["in", ["get", "class"], ["literal", MAIN_ROADS]],
      layout: { "line-cap": "butt" },
      paint: {
        "line-color": NIGHT,
        "line-width": ["interpolate", ["linear"], ["zoom"], 6, 0.6, 12, 1.5, 18, 6],
      },
    },
    {
      id: "road-names",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "transportation_name",
      minzoom: 15,
      layout: {
        "symbol-placement": "line",
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 12,
      },
      paint: { "text-color": NIGHT, "text-halo-color": PAPER, "text-halo-width": 2 },
    },
    {
      id: "place-names",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["city", "town", "village", "suburb", "neighbourhood"]]],
      layout: {
        "text-field": ["get", "name"],
        "text-font": ["Noto Sans Bold"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 4, 11, 14, 15],
        "text-max-width": 8,
      },
      paint: { "text-color": NIGHT, "text-halo-color": PAPER, "text-halo-width": 2 },
    },
  ],
};
