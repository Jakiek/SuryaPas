# Validation against PVGIS

The engine's solar yield checked against PVGIS, the European Commission's photovoltaic model (task T07, 2026-11-15). Until this check the yield had been tested only against its own arithmetic.

**Result.** On a flat, unshaded roof the engine's yearly yield per kWp is within 10% of PVGIS at all three cities: from 9.8% below to 5.6% above with assumption set version 2. Almost all of the gap comes from the sunlight data, not from the loss model. NASA POWER and PVGIS-ERA5 disagree with each other by up to 10% on a 19-year mean, and the engine uses a single year. Neither source is a ground measurement, so the 10% is the honest margin on the engine's yearly output, before any question of the household's load.

## Sources

**PVGIS 5.3**, `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc`. Only city coordinates and system parameters were sent.

**Radiation database: PVGIS-ERA5.** ERA5 is the European Centre for Medium-Range Weather Forecasts' reanalysis: a weather model fitted to observations, worldwide, about 0.25° (28 km), here the years 2005 to 2023. It is the only PVGIS 5.3 database that covers Indonesia. Three pieces of evidence, all read on 2026-11-15:

1. The coverage map on the [PVGIS 5.3 release page](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/pvgis-releases/pvgis-53_en) ([image](https://joint-research-centre.ec.europa.eu/sites/default/files/styles/embed_medium/public/2024-09/PVGIS_53_DB_Coverage.png)) shows SARAH-3, the satellite database, covering Europe, Africa, the Middle East and eastern South America, and ending west of India. All of Indonesia lies in the ERA5 area. The page lists both databases as 2005–2023.
2. The [PVGIS user manual](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/pvgis-user-manual_en) names PVGIS-ERA5 the default for the rest of the world without coverage from a satellite database. The same manual describes SARAH-3 as covering "most of Asia"; the map shows that this means western and central Asia.
3. The API itself: asked for `raddatabase=PVGIS-SARAH3` at Medan, Yogyakarta and Makassar, it refuses with status 400, "Location out of the spatial coverage of the radiation database selected", and points to PVGIS-ERA5. The only other value it accepts is PVGIS-ERA5.

**NASA POWER**, the engine's own sun data (SPEC 3.4): the bundled hourly series in `data/sun-fallback/`, year 2025, at the centre of each city's 0.5° cell. For a long-term mean from the same source, the script also reads NASA POWER's monthly API (`/api/temporal/monthly/point`, `ALLSKY_SFC_SW_DWN`) at the same cell centres for 2005 to 2025. Its response header names CERES SYN1deg as the source, the same as the hourly series.

## Method

`scripts/validate-pvgis.mjs` does both halves.

- **Engine.** The real engine (`solarPerKwp` from `src/engine/`) on the bundled series, for a flat roof with no shade, summed over the year. Runs offline.
- **PVGIS.** `PVcalc` for 1 kWp of crystalline silicon, free-standing, with PVGIS's default 14% system loss, horizon shading on (its default; it made no difference at Medan). Flat (tilt 0°) at each city, and at Medan and Yogyakarta every tilt from 5° to 45° in 5° steps facing north, east, south and west: 75 runs.
- **Same system loss.** The engine has one performance ratio for every loss. PVGIS models angle of incidence, spectrum, and temperature with low light from its weather data, and takes the rest (inverter, cables, dirt) as the system-loss input. So the comparison sends PVGIS its default 14% and then reads back PVGIS's own whole-system ratio, yield ÷ irradiation, to set beside the engine's.
- The responses used are saved in `scripts/validate-pvgis-data/`: `pvgis-responses.json`, fetched 2026-11-15T14:12Z, and `nasa-monthly.json`, fetched at the same time. PVGIS's `meta` block, a field glossary identical in every response, is kept once.

Rerun from a clean checkout, offline, with no `npm install` needed:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/validate-pvgis.mjs
```

Add `--fetch` to ask PVGIS and NASA POWER again; this overwrites the saved responses. The script ends by saying whether the current assumption set holds the orientation table the saved runs give, and exits with an error if not.

## Yearly yield, flat roof

kWh per kWp per year. Difference is (engine − PVGIS) ÷ PVGIS.

| City | Engine v2 | PVGIS | Difference | Engine v1 | Difference v1 |
| --- | --- | --- | --- | --- | --- |
| Medan | 1,262 | 1,340 | −5.9% | 1,312 | −2.1% |
| Yogyakarta | 1,304 | 1,446 | −9.8% | 1,356 | −6.2% |
| Makassar | 1,388 | 1,314 | +5.6% | 1,443 | +9.8% |

No site was more than 10% apart under version 1 either, so the rule "find the cause first" was not triggered. The cause was still traced, because two of the three are close to the limit.

## Why they differ

Two things multiply to the yield: the sunlight each source starts from, and the share of it that reaches the socket.

**Sunlight**, kWh/m² a year on a horizontal surface:

| City | NASA hourly, engine's year | NASA monthly, same year | NASA 2005–2023 mean | NASA year-to-year spread (1 s.d.) | ERA5 2005–2023 mean (PVGIS) |
| --- | --- | --- | --- | --- | --- |
| Medan | 1,682 | 1,682 | 1,711 | 1.6% | 1,794 |
| Yogyakarta | 1,738 | 1,738 | 1,867 | 3.6% | 1,918 |
| Makassar | 1,850 | 1,850 | 1,950 | 3.8% | 1,769 |

The hourly series and the monthly API agree for 2025, so the bundled data was read correctly.

**Losses** in PVGIS on a flat roof:

| City | Yield ÷ irradiation | Angle of incidence | Spectrum | Temperature and low light | System loss (input) | Total |
| --- | --- | --- | --- | --- | --- | --- |
| Medan | 0.747 | −2.73% | +0.88% | −11.44% | −14% | −25.27% |
| Yogyakarta | 0.754 | −2.64% | +0.7% | −10.56% | −14% | −24.58% |
| Makassar | 0.743 | −2.94% | not modelled, "?(0)" | −11.01% | −14% | −25.72% |

**The gap, split into three factors** that multiply to it (engine v2):

| City | Year: engine's year vs NASA mean | Database: NASA mean vs ERA5 mean | Losses: 0.75 vs PVGIS ratio | Total gap |
| --- | --- | --- | --- | --- |
| Medan | −1.7% | −4.6% | +0.4% | −5.9% |
| Yogyakarta | −6.9% | −2.6% | −0.6% | −9.8% |
| Makassar | −5.1% | +10.2% | +1.0% | +5.6% |

Read across:

- **The year.** The engine uses one year, the latest complete one (SPEC 3.4). 2025 was a dull year at all three cities in NASA's own record, by 1.7% to 6.9%. At Yogyakarta that alone is most of the gap. A payback over 25 years depends on the long-term sun, not last year's.
- **The database.** Over the same 19 years, NASA POWER and ERA5 differ by −4.6% to +10.2%, and not in one direction: ERA5 is sunnier at Medan and Yogyakarta and much duller at Makassar. Both are coarse (NASA's solar source, CERES SYN1deg, is a 1° grid; ERA5's is 0.25°) and both model cloud rather than measure it at the ground, so this check cannot say which is right. It does say that the engine's yield carries a sunlight uncertainty of about 10% that no performance ratio can remove.
- **Losses.** PVGIS's whole-system ratio is 0.743 to 0.754. Version 1's 0.78 was 3.5% to 5% above it, almost entirely because PVGIS charges about 11% for heat in this climate. That part of the gap is a loss, so it is the one part the performance ratio should take up.

## Change to the performance ratio

`pv.performanceRatio` goes from 0.78 to 0.75 in assumption set version 2: the mean of PVGIS's three ratios (0.748), rounded. This follows the task's rule, to adjust it only for a difference explained by system losses, and it does not close the gap: it moves Medan and Yogyakarta further from PVGIS and Makassar closer. After it, what remains is sunlight alone (the loss column above is within 1%).

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

**Gentle 25°, steep 45°.** No document gives the slope choices an angle. These are the angles drawn in the roof-step pictures (`mock/atap.html`: about 26° and 46°), rounded to 5°, and the by-tilt table above lets a different choice be read off without a new fetch. SPEC 3.2 step 3 now fixes it, and it matters: steep at 35° instead of 45° would raise its factors by 0.06 to 0.10.

Two things in these runs that the engine's table cannot hold:

- **East is not west.** At both sites an east roof yields 4% to 9% more than a west one (more at steeper tilts), consistent with clearer mornings and cloud building in the afternoon. The engine has one east-or-west value, the mean, so it overstates west roofs and understates east ones by 2% to 5%.
- **Latitude.** The two sites differ by up to 0.11 at 45° (facing away: 0.78 at Medan, 0.67 at Yogyakarta). Medan, near the equator, is close to symmetric north to south; its dullest months, November and December, fall in the half of the year when the sun is to the south, so a south face gains nothing there at any tilt, and at Medan an east face beats every other. A table with one value per slope and facing is a two-site average, and a home at Kupang (10° S) or Manado (1.5° N) sits further from it.

## Margin

With version 2, the engine's flat-roof yield is within **−9.8% to +5.6%** of PVGIS at Medan, Yogyakarta and Makassar. The loss model accounts for at most 1% of that; the rest is the sunlight data, in which two reputable sources disagree by up to 10% on a long-term mean and a single year moves up to about 7% from it. A tilted roof adds the orientation factor's own uncertainty: at 45° the two sites sit up to 0.06 either side of the mean factor, and east and west each sit 2% to 5% from their shared value.

## Known limits

- **One year of sun.** SPEC 3.4 uses the latest complete year. At these three cities that year was 1.7% to 6.9% below NASA's own 2005–2023 mean. Not changed then, since it is a rule in the spec.
- **No ground truth.** Both sources are modelled. No ground station (for example a BSRN station) was compared.
- **Not quite the same point.** PVGIS was asked at the city coordinates; the engine's series is from the centre of the 0.5° cell, 14 to 23 km away for these three.
- **Yearly totals only.** No hour-by-hour comparison was made. NASA POWER's hours are zone time (SPEC 3.4) and PVGIS's are UTC, so an hourly comparison would first need shifting. The engine also applies the orientation factor as one multiplier to every hour, so it moves an east roof's output by the same share at 08:00 as at 15:00; the daily shape on a tilted roof, and so the self-consumed share, is not checked.
- **PVGIS's own choices** stand in for Indonesian data: the 14% system loss, free-standing mounting, and no spectral correction at Makassar.
