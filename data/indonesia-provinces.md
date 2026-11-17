# Indonesia provinces

`indonesia-provinces.json` is how the server finds the legal time zone of a pin (SPEC 3.4, "Requested in UTC"). The lookup is `legalUtcOffsetHours` in `src/lib/timezone/legalTimeZone.ts`. The file is server-only (the module imports `server-only`); the browser never loads it.

- **Source:** geoBoundaries gbOpen, Indonesia ADM1 (provinces), https://www.geoboundaries.org (file `geoBoundaries-IDN-ADM1.geojson`, https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/ADM1/geoBoundaries-IDN-ADM1.geojson, 15 MB; the same release as `indonesia-outline.json`). Read 2026-11-17.
- **Original data:** Badan Pusat Statistik (BPS, Statistics Indonesia), World Food Programme, OCHA ROAP.
- **Licence:** Creative Commons Attribution 3.0 IGO. The credit "Indonesia outline: geoBoundaries, from BPS, WFP and OCHA ROAP (CC BY 3.0 IGO)" is carried here and in the README; the file is never shown in the browser.
- **Provinces:** 34, the set before the 2022 splits of Papua. Papua and West Papua are in it; the newer Papua provinces fall inside them and share their zone (WIT).
- **Zone per province:** a table in the build script, from SPEC 3.4. WIB (UTC+7): Sumatra, Java, West and Central Kalimantan. WITA (UTC+8): Bali, West and East Nusa Tenggara, South, East and North Kalimantan, all of Sulawesi. WIT (UTC+9): Maluku, North Maluku, Papua. The script stops if a province has no entry.
- **Simplification:** `node data/indonesia-provinces.build.mjs geoBoundaries-IDN-ADM1.geojson 0.003 data/indonesia-provinces.json`. Exterior rings only; Douglas-Peucker at 0.003 degrees (about 330 m); every island kept, a ring never shrinks below a triangle; coordinates in thousandths of a degree, stored as steps from the previous vertex.
- **Size:** 273 KB, about 95 KB gzipped, 34 provinces, 1,334 islands.
- **Format:** `{ unitsPerDegree, provinces: [{ name, iso, utcOffsetHours, islands: number[][] }] }`; an island is `[lon0, lat0, dLon1, dLat1, ...]`.
- **Known limits:** province borders can sit a few hundred metres from the true line, so a pin within that distance of a zone border on land may get the neighbour's zone. Rings are exterior only, so a province's enclave is read as part of it (Yogyakarta lies inside Central Java, both WIB, so nothing changes). Where two provinces' rings overlap, the first in file order wins. A pin outside every province but within 2 km of one takes the nearest province's zone; farther out the lookup throws `PinOutsideIndonesiaError`.
