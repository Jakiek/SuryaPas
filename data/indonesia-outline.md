# Indonesia outline

`indonesia-outline.json` is the country outline the location step checks a pin against (SPEC 2.2 step 1, 2.5).

- **Source:** Natural Earth, 1:10m Cultural Vectors, `ne_10m_admin_0_countries` (feature with `ADM0_A3` = `IDN`), from https://github.com/nvkelso/natural-earth-vector, fetched 2026-11-15.
- **Licence:** public domain (https://www.naturalearthdata.com/about/terms-of-use/). No attribution is required.
- **Changes:** simplified with the Douglas-Peucker method at a tolerance of 0.002 degrees (about 220 m) and coordinates rounded to 0.001 degrees, which brings 13 MB of all countries down to 246 KB for Indonesia alone. A pin within a few hundred metres of the coast (Sabang harbour, 5.8947 N 95.3193 E, is already about 250 m offshore in Natural Earth's own line) can therefore fall on the wrong side of the line.
- **Shape:** a GeoJSON `Feature` holding a `MultiPolygon`; each polygon is an exterior ring, then any holes. Coordinates are `[longitude, latitude]`.
- **Borders it follows:** Natural Earth's depiction of Indonesia, so East Timor, Malaysian Borneo and Papua New Guinea are outside it.
