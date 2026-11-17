// The satellite photo, as a MapLibre style: one raster layer of Esri's
// World Imagery tiles, fetched with the owner's developer key.
// The key is public by design (the tiles load in the browser); restrict it
// by referrer in the Esri dashboard. Without a key there is no imagery, and
// the step falls back to the street map (see RoofMap).

import type { StyleSpecification } from "maplibre-gl";

/** The key, or null when the owner has not added one to .env.local. */
export const esriApiKey: string | null = process.env.NEXT_PUBLIC_ESRI_API_KEY?.trim() || null;

// Esri's tiles are 256 px and exist up to level 19; MapLibre enlarges them
// beyond that, which is blurry but lets the user zoom to a single roof.
const TILE_URL =
  "https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

export function imageryStyle(apiKey: string): StyleSpecification {
  return {
    version: 8,
    sources: {
      imagery: {
        type: "raster",
        tiles: [`${TILE_URL}?token=${encodeURIComponent(apiKey)}`],
        tileSize: 256,
        maxzoom: 19,
      },
    },
    layers: [{ id: "imagery", type: "raster", source: "imagery" }],
  };
}
