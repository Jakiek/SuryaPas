# Validation against PVGIS

The engine's solar yield checked against PVGIS, the European Commission's photovoltaic model (task T07, 2026-11-15), and checked again after the sun series were scaled to NASA POWER's twenty-year mean (task T19, 2026-11-15). Until T07 the yield had been tested only against its own arithmetic.

**Rerun after T20 (2026-11-17).** The sun series are now requested and bundled in UTC and moved to the home's legal time zone per request (SPEC 3.4). The bundled files were fetched again in UTC and the script rerun offline: every figure below is unchanged. Only the fetch date of the engine's sun changed in the output. A rotation of the hours cannot move a yearly total, and the one real change, described under "Sources", is far below the precision shown.

**Result.** On a flat, unshaded roof, with the scaled sun series and assumption set version 2, the engine's yearly yield per kWp is 4.3% below PVGIS at Medan, 3.6% below at Yogyakarta and **10.8% above at Makassar**. Makassar is outside 10%, and the cause is the sunlight databases, not the engine: over the same nineteen years NASA POWER gives Makassar 10.2% more sun than PVGIS-ERA5 does, and the loss model adds 1.0%. Before scaling, 2025's dull year at Makassar (4.7% below NASA's 2006–2025 mean) had been hiding that disagreement. Neither database is a ground measurement; the margin this leaves on the engine's yearly output, before any question of the household's load, is stated under "Margin".

## Sources

**PVGIS 5.3**, `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc`. Only city coordinates and system parameters were sent.

**Radiation database: PVGIS-ERA5.** ERA5 is the European Centre for Medium-Range Weather Forecasts' reanalysis: a weather model fitted to observations, worldwide, about 0.25° (28 km), here the years 2005 to 2023. It is the only PVGIS 5.3 database that covers Indonesia. Three pieces of evidence, all read on 2026-11-15:

1. The coverage map on the [PVGIS 5.3 release page](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/pvgis-releases/pvgis-53_en) ([image](https://joint-research-centre.ec.europa.eu/sites/default/files/styles/embed_medium/public/2024-09/PVGIS_53_DB_Coverage.png)) shows SARAH-3, the satellite database, covering Europe, Africa, the Middle East and eastern South America, and ending west of India. All of Indonesia lies in the ERA5 area. The page lists both databases as 2005–2023.
2. The [PVGIS user manual](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/pvgis-user-manual_en) names PVGIS-ERA5 the default for the rest of the world without coverage from a satellite database. The same manual describes SARAH-3 as covering "most of Asia"; the map shows that this means western and central Asia.
3. The API itself: asked for `raddatabase=PVGIS-SARAH3` at Medan, Yogyakarta and Makassar, it refuses with status 400, "Location out of the spatial coverage of the radiation database selected", and points to PVGIS-ERA5. The only other value it accepts is PVGIS-ERA5.

**NASA POWER**, the engine's own sun data (SPEC 3.4): the bundled hourly series in `data/sun-fallback/`, year 2025, at the centre of each city's 0.5° cell. 2025 is the year SPEC 3.4 selects: the latest calendar year that ended at least six months ago, since NASA's solar data runs about four months behind (on 2026-11-15 its monthly record had 2026 only to July). The live service moves to 2026 on 1 July 2027. Each series is scaled by one factor so that its year holds the mean of 2006 to 2025 (SPEC 3.4, "Long-term scaling"; the factors are below). The scaling reads NASA POWER's monthly API (`/api/temporal/monthly/point`, `ALLSKY_SFC_SW_DWN`, kWh/m²/day) at the same cell centres. Its response header names CERES SYN1deg as the source, the same as the hourly series, and the two agree on 2025 to the kWh/m² (table "Scaling" below), so the factor compares like with like. This script also keeps its own copy of the monthly record, for 2005 to 2025, to set NASA beside ERA5 over the same years.

## Method

`scripts/validate-pvgis.mjs` does both halves.

- **Engine.** The real engine (`solarPerKwp` from `src/engine/`) on the bundled series, for a flat roof with no shade, summed over the year. Runs offline. It is run twice: on the scaled series the engine now receives, and on the same 2025 year before scaling, read from `data/sun-fallback/source/`.
- **PVGIS.** `PVcalc` for 1 kWp of crystalline silicon, free-standing, with PVGIS's default 14% system loss, horizon shading on (its default; it made no difference at Medan). Flat (tilt 0°) at each city, and at Medan and Yogyakarta every tilt from 5° to 45° in 5° steps facing north, east, south and west: 75 runs.
- **Same system loss.** The engine has one performance ratio for every loss. PVGIS models angle of incidence, spectrum, and temperature with low light from its weather data, and takes the rest (inverter, cables, dirt) as the system-loss input. So the comparison sends PVGIS its default 14% and then reads back PVGIS's own whole-system ratio, yield ÷ irradiation, to set beside the engine's.
- The responses used are saved in `scripts/validate-pvgis-data/`: `pvgis-responses.json`, fetched 2026-11-15T14:12Z, and `nasa-monthly.json`, fetched at the same time. PVGIS's `meta` block, a field glossary identical in every response, is kept once. The NASA responses behind the bundled series (the 2025 hourly year in UTC and the 2006–2025 monthly record, one file per city) are in `data/sun-fallback/source/`, fetched 2026-11-17T12:56Z by `scripts/build-sun-fallback.mjs --fetch` (T20). Against the previous fetch of 2026-11-15, which asked for NASA's "LST" hours: the monthly records are identical, and every hourly value is the same value moved by NASA's LST offset at that cell, except the 7 to 9 hours that cross the ends of the year. Those now hold the morning of 1 January 2026 on the local clock in place of the morning of 1 January 2025, which moves the 2025 total by under 0.03% (the most, 0.4 kWh/m², at Jayapura) and each scaling factor by under 0.03%; the scaled totals, being the long-term mean, do not move.

Rerun from a clean checkout, offline, with no `npm install` needed:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/validate-pvgis.mjs
```

Add `--fetch` to ask PVGIS and NASA POWER again; this overwrites the saved responses. The script ends by saying whether the current assumption set holds the orientation table the saved runs give, and exits with an error if not. `node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/build-sun-fallback.mjs` rebuilds the scaled series from `data/sun-fallback/source/`, also offline, byte for byte.

## Yearly yield, flat roof

kWh per kWp per year, assumption set version 2. Difference is (engine − PVGIS) ÷ PVGIS.

| City | Engine, scaled sun | PVGIS | Difference | Engine, 2025 alone | Difference |
| --- | --- | --- | --- | --- | --- |
| Medan | 1,283 | 1,340 | −4.3% | 1,262 | −5.9% |
| Yogyakarta | 1,395 | 1,446 | −3.6% | 1,304 | −9.8% |
| Makassar | 1,456 | 1,314 | +10.8% | 1,388 | +5.6% |

The scaled column is what the engine gives now. The 2025-alone column is T07's result, kept to show what scaling did: Medan and Yogyakarta moved toward PVGIS, Makassar moved away from it and past 10%. Under assumption set version 1 (performance ratio 0.78) on 2025 alone, the three were −2.1%, −6.2% and +9.8%.

**Makassar, +10.8%.** Traced, as the rule "find the cause first" asks, and not corrected. The split below gives +10.2% to the sunlight database and +1.0% to the loss model. The loss part is the same at Makassar as elsewhere (PVGIS's ratio there, 0.743, is within 0.011 of the other two). The database part is NASA POWER and ERA5 disagreeing about how sunny Makassar is: over 2005 to 2023 NASA gives 1,950 kWh/m² a year and ERA5 1,769. With 2025 alone the engine looked closer, but only because 2025 was a dull year at Makassar in NASA's own record, and a dull year is not a reason to trust a result. No assumption was changed to bring it back: a performance ratio cut to fit Makassar would push Medan and Yogyakarta further below PVGIS, and would hide a disagreement between data sources inside a loss figure.

## Why they differ

Two things multiply to the yield: the sunlight each source starts from, and the share of it that reaches the socket.

**Sunlight**, kWh/m² a year on a horizontal surface:

| City | NASA 2025 alone | Engine's series (NASA 2006–2025 mean) | NASA 2005–2023 mean | NASA year-to-year spread (1 s.d.) | ERA5 2005–2023 mean (PVGIS) |
| --- | --- | --- | --- | --- | --- |
| Medan | 1,682 | 1,711 | 1,711 | 1.6% | 1,794 |
| Yogyakarta | 1,738 | 1,860 | 1,867 | 3.6% | 1,918 |
| Makassar | 1,850 | 1,941 | 1,950 | 3.8% | 1,769 |

A year here is 365 days, February counted as 28, the same days the hourly series holds (it leaves out 29 February). T07 multiplied NASA's yearly mean day by 365 instead; the two ways differ by under 0.1% in a leap year and only by rounding in others, and the 2005–2023 means are unchanged at this precision.

**Scaling** in the bundled files, checked against the separate monthly record this script saved:

| City | Years | Years used | 2025, hourly series | 2025, monthly record | Mean | Factor | Mean from the script's record | Difference |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Medan | 2006–2025 | 20 | 1,682 | 1,682 | 1,711 | 1.0171 | 1,711 | 0.0% |
| Yogyakarta | 2006–2025 | 20 | 1,738 | 1,738 | 1,860 | 1.0697 | 1,860 | 0.0% |
| Makassar | 2006–2025 | 20 | 1,850 | 1,850 | 1,941 | 1.0493 | 1,941 | 0.0% |

The hourly series and the monthly record give the same 2025, so the factor is a ratio of like quantities. Two fetches about twenty minutes apart give the same mean.

**Losses** in PVGIS on a flat roof:

| City | Yield ÷ irradiation | Angle of incidence | Spectrum | Temperature and low light | System loss (input) | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Medan | 0.747 | −2.73% | +0.88% | −11.44% | −14% | −25.27% |
| Yogyakarta | 0.754 | −2.64% | +0.7% | −10.56% | −14% | −24.58% |
| Makassar | 0.743 | −2.94% | not modelled, "?(0)" | −11.01% | −14% | −25.72% |

**The gap, split into three factors** that multiply to it (engine v2, scaled sun):

| City | Period: NASA 2006–2025 vs 2005–2023 | Database: NASA vs ERA5, 2005–2023 | Losses: 0.75 vs PVGIS ratio | Total gap |
| --- | --- | --- | --- | --- |
| Medan | 0.0% | −4.6% | +0.4% | −4.3% |
| Yogyakarta | −0.4% | −2.6% | −0.6% | −3.6% |
| Makassar | −0.5% | +10.2% | +1.0% | +10.8% |

Read across:

- **The period.** The engine's series now holds NASA's 2006–2025 mean; PVGIS uses 2005–2023. The two windows differ by 0.5% at most. Before scaling, this column was the single year against the mean: −1.7%, −6.9% and −5.1%, because 2025 was a dull year at all three cities in NASA's own record. Scaling removed that, which is why Yogyakarta went from −9.8% to −3.6%.
- **The database.** Over the same 19 years, NASA POWER and ERA5 differ by −4.6% to +10.2%, and not in one direction: ERA5 is sunnier at Medan and Yogyakarta and much duller at Makassar. Both are coarse (NASA's solar source, CERES SYN1deg, is a 1° grid; ERA5's is 0.25°) and both model cloud rather than measure it at the ground, so this check cannot say which is right. It is now almost the whole gap, and it is a sunlight uncertainty of about 10% that no performance ratio can remove.
- **Losses.** PVGIS's whole-system ratio is 0.743 to 0.754. Version 1's 0.78 was 3.5% to 5% above it, almost entirely because PVGIS charges about 11% for heat in this climate. That part of the gap is a loss, so it is the one part the performance ratio should take up.

## Change to the performance ratio

`pv.performanceRatio` goes from 0.78 to 0.75 in assumption set version 2 (T07): the mean of PVGIS's three ratios (0.748), rounded. This follows the task's rule, to adjust it only for a difference explained by system losses, and it does not close the gap: it moves Medan and Yogyakarta further from PVGIS and Makassar closer. After it, what remains is sunlight alone (the loss column above is within 1%). T19 left it unchanged: Makassar's +10.8% is in the sunlight column, not the loss column.

Two cautions on 0.75. It rests on PVGIS's default 14% for inverter, cables and dirt, not on an Indonesian figure. And PVGIS's "free-standing" mounting lets air under the panels, while panels on a tiled roof run hotter, so a real rooftop may lose a little more to heat. The figure is labelled `thin`.

## Orientation factors

Each factor is PVGIS's yearly yield on a tilted roof ÷ its flat-roof yield at the same place, so the sunlight database cancels out and only geometry and climate remain. "Toward the equator" is south at Medan and north at Yogyakarta.

**By tilt**, mean of Medan and Yogyakarta (east and west averaged):

| Tilt | Toward the equator | East or west | Away from the equator | Largest gap between the two sites |
| --- | --- | --- | --- | --- |
| 5° | 1.005 | 0.997 | 0.990 | 0.012 |
| 10° | 1.004 | 0.990 | 0.974 | 0.025 |
| 15° | 0.998 | 0.979 | 0.953 | 0.038 |
| 20° | 0.986 | 0.964 | 0.927 | 0.051 |
| 25° | 0.969 | 0.945 | 0.896 | 0.064 |
| 30° | 0.947 | 0.924 | 0.860 | 0.077 |
| 35° | 0.919 | 0.900 | 0.819 | 0.090 |
| 40° | 0.886 | 0.872 | 0.773 | 0.102 |
| 45° | 0.847 | 0.842 | 0.723 | 0.113 |

**Per site**, at the slopes version 2 uses:

| Slope | Site | Toward the equator | East | West | Away from the equator |
| --- | --- | --- | --- | --- | --- |
| gentle (25°) | Medan | 0.942 | 0.963 | 0.928 | 0.928 |
| gentle (25°) | Yogyakarta | 0.996 | 0.970 | 0.920 | 0.864 |
| steep (45°) | Medan | 0.804 | 0.869 | 0.816 | 0.780 |
| steep (45°) | Yogyakarta | 0.890 | 0.878 | 0.806 | 0.667 |

**The table in version 2**, rounded to two decimals, beside version 1:

| Slope | Facing | v1 | Derived, held by v2 | Change |
| --- | --- | --- | --- | --- |
| gentle | toward the equator | 1.01 | 0.97 | −0.04 |
| gentle | east or west | 0.99 | 0.95 | −0.04 |
| gentle | away from the equator | 0.97 | 0.90 | −0.07 |
| steep | toward the equator | 0.97 | 0.85 | −0.12 |
| steep | east or west | 0.94 | 0.84 | −0.10 |
| steep | away from the equator | 0.88 | 0.72 | −0.16 |

Every factor fell. The largest change is steep facing away from the equator, 0.88 to 0.72, an 18% cut in that roof's output. Version 1 assumed a tilt toward the equator gains a little, as it does at higher latitudes; near the equator the sun is high and spends part of the year on each side of the sky, so a roof facing the equator only breaks even with a flat one up to about 15°, and every other facing loses at every tilt.

**Gentle 25°, steep 45°.** No document gives the slope choices an angle. These are the angles drawn in the roof-step pictures (`mock/atap.html`: about 26° and 46°), rounded to 5°, and the by-tilt table above lets a different choice be read off without a new fetch. The choice is fixed in SPEC 3.2 step 3, and it matters: steep at 35° instead of 45° would raise its factors by 0.06 to 0.10.

Two things in these runs that the engine's table cannot hold:

- **East is not west.** At both sites an east roof yields 4% to 9% more than a west one (more at steeper tilts), consistent with clearer mornings and cloud building in the afternoon. The engine has one east-or-west value, the mean, so it overstates west roofs and understates east ones by 2% to 5%.
- **Latitude.** The two sites differ by up to 0.11 at 45° (facing away: 0.78 at Medan, 0.67 at Yogyakarta). Medan, near the equator, is close to symmetric north to south; its dullest months, November and December, fall in the half of the year when the sun is to the south, so a south face gains nothing there at any tilt, and at Medan an east face beats every other. A table with one value per slope and facing is a two-site average, and a home at Kupang (10° S) or Manado (1.5° N) sits further from it.

## Margin

With version 2 and the scaled sun, the engine's flat-roof yield is within **−4.3% to +10.8%** of PVGIS at Medan, Yogyakarta and Makassar. The loss model accounts for at most 1% of that; the rest is the sunlight data, in which two reputable sources disagree by up to 10% on a long-term mean. A tilted roof adds the orientation factor's own uncertainty: at 45° the two sites sit up to 0.06 either side of the mean factor, and east and west each sit 2% to 5% from their shared value.

## Known limits

- **One year's pattern, the long-term amount.** Since T19 each series holds NASA's twenty-year mean amount of sun, but its hour-by-hour pattern of cloud is still 2025's alone (SPEC 3.4 chose one factor for the year, not one per month). A 2025 month that was unusually dull or bright stays so, only lifted or lowered with the rest of the year. The year-to-year spread of yearly totals is 1.6% to 3.8% at these three cities.
- **Sunlight databases disagree.** NASA POWER and ERA5 differ by up to 10.2% on the same years (Makassar), which this check cannot resolve; see "Why they differ".
- **No ground truth.** Both sources are modelled. No ground station (for example a BSRN station) was compared.
- **Not quite the same point.** PVGIS was asked at the city coordinates; the engine's series is from the centre of the 0.5° cell, 14 to 23 km away for these three.
- **Yearly totals only.** No hour-by-hour comparison was made. The bundled series are in UTC, as PVGIS's hourly output is, so the two could be set hour against hour without shifting; the engine itself receives them moved to the home's legal time zone (SPEC 3.4). The engine also applies the orientation factor as one multiplier to every hour, so it moves an east roof's output by the same share at 08:00 as at 15:00; the daily shape on a tilted roof, and so the self-consumed share, is not checked.
- **PVGIS's own choices** stand in for Indonesian data: the 14% system loss, free-standing mounting, and no spectral correction at Makassar.
