# Indonesia outline

`indonesia-outline.json` is the outline the location step checks a pin against (SPEC 2.2 step 1). A pin inside it, or within 2 km of it, counts as inside Indonesia. The check is `isInsideIndonesia` in `src/features/location/indonesia.ts`.

- **Source:** geoBoundaries gbOpen, Indonesia ADM2 (districts), release built 2023-12-12, https://www.geoboundaries.org (file `geoBoundaries-IDN-ADM2.geojson`, https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM2/geoBoundaries-IDN-ADM2.geojson, 159 MB). Fetched 2026-11-16.
- **Original data:** Badan Pusat Statistik (BPS, Statistics Indonesia), World Food Programme, OCHA ROAP.
- **Licence:** Creative Commons Attribution 3.0 IGO. The credit "Indonesia outline: geoBoundaries, from BPS, WFP and OCHA ROAP (CC BY 3.0 IGO)" is carried here and in the README (T18); it is not on the step's screen.
- **Why district level:** a country-level file (Natural Earth 1:10m, and geoBoundaries ADM0) has no Pulau Pramuka, Pari, Tidung, Derawan or Bunaken within 6 km or more. The district file holds 8,580 polygons, so small inhabited islands are in it.
- **Simplification:** `node data/indonesia-outline.build.mjs geoBoundaries-IDN-ADM2.geojson 0.005 data/indonesia-outline.json`. Exterior rings only; Douglas-Peucker at 0.005 degrees (about 550 m); every polygon kept, a ring never shrinks below a triangle; coordinates in thousandths of a degree, stored as steps from the previous vertex.
- **Size:** 538 KB, about 189 KB gzipped, 8,580 islands. It loads with the plan page's script, not the landing page.
- **Format:** `{ unitsPerDegree, islands: number[][] }`; an island is `[lon0, lat0, dLon1, dLat1, ...]`.
- **Known limits:** ring edges can sit up to about 550 m from the true coast, covered by the 2 km margin. Islets with a ring under a triangle's worth of detail are a few hundred metres across. Borders follow BPS, so East Timor, Malaysia and Papua New Guinea are outside.
