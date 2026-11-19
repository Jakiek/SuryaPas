# Assumptions

Every number the engine uses. `docs/SPEC.md` section 3 defines how each is used.

**Source of truth.** `src/engine/assumptions/v2.ts` (the current version, `CURRENT_ASSUMPTIONS`) is authoritative for values; `v1.ts` stays as released. This file is the research record behind them: sources, confidence and open items, under the same keys. A changed value means a new version file (SPEC 4.2) and an update here.

**Confidence labels.** The assumptions screen shows these to users, so they must be honest.

| Label | Meaning |
| --- | --- |
| `sourced` | Taken from a cited source |
| `thin` | Cited, but from a single or weak source |
| `judgment` | A typical engineering value with no citation yet |
| `decision` | A product choice, agreed with the owner |
| `open` | No acceptable value yet; the provisional value keeps the engine runnable |

All values were collected on 2026-11-14, except the two that version 2 changed on 2026-11-15 after the PVGIS check (`pv.performanceRatio` and the orientation table; see `docs/VALIDATION.md`). Rupiah amounts are written with comma thousands separators in this file.

## Tariffs (Rp per kWh), October to December 2026

| Key | Value | Label | Source |
| --- | --- | --- | --- |
| `powerClasses.classes.R1_450_subsidised` | 415 | sourced | [Metro TV](https://www.metrotvnews.com/read/NA0CzpEz-daftar-lengkap-tarif-listrik-pln-akhir-oktober-2026-per-kwh) |
| `powerClasses.classes.R1_900_subsidised` | 605 | sourced | same |
| `powerClasses.classes.R1_900_nonsubsidised` | 1,352 | sourced | same; [Kompas](https://money.kompas.com/read/2026/11/02/083952426/tarif-listrik-pln-november-2026-cek-daftar-lengkap-semua-golongan) |
| `powerClasses.classes.R1_1300` | 1,444.70 | sourced | same |
| `powerClasses.classes.R1_2200` | 1,444.70 | sourced | same |
| `powerClasses.classes.R2_3500_5500` | 1,699.53 | sourced | same |
| `powerClasses.classes.R3_6600_up` | 1,699.53 | sourced | same |

These are press reports of the tariff, consistent across outlets, and not PLN's own document. Tariffs were unchanged through 2026. T03 check: Annex II of [Energy Ministry Regulation 7/2024](https://jdih.esdm.go.id/storage/document/Permen%20ESDM%20Nomor%207%20Tahun%202024.pdf) gives the same Rupiah figures for each class; for R-1 450 VA and 900 VA they are the prepaid column.

## Regulation

| Key | Value | Label | Source |
| --- | --- | --- | --- |
| `minCharge.hours` | 40 | sourced | Minimum monthly bill RM1 = 40 jam nyala × connected kVA × energy tariff. Energy Ministry Regulation 7/2024, Annex II, footnote *): [Permen ESDM 7/2024](https://jdih.esdm.go.id/storage/document/Permen%20ESDM%20Nomor%207%20Tahun%202024.pdf). Read in the PDF on 2026-11-14 (T03) |

Worked values of the minimum bill, from the formula above and the tariff table (our arithmetic): 900 VA-RTM, 40 × 0.9 × 1,352 = Rp48,672; 1,300 VA, 40 × 1.3 × 1,444.70 = Rp75,124; 2,200 VA, 40 × 2.2 × 1,444.70 = Rp127,134; 3,500 VA, 40 × 3.5 × 1,699.53 = Rp237,934.

The R-1 450 VA and 900 VA tariffs above (415 and 605) are the prepaid column of Annex II. The postpaid column for those two classes is a three-block tariff plus the fixed charge. Stage 1 converts spend with the single prepaid rate for both, a known limit stated in SPEC 3.2 step 1.

## Rules built into the engine

These are not entries of the assumption set. They are rules the engine code applies, so they have no key in `CURRENT_ASSUMPTIONS` and no editable value; the names below are this document's own. Each stays here with its source. The assumptions screen shows three of them: exports earn nothing, the minimum charge after solar, and no size cap.

| Rule | Value | Label | Source |
| --- | --- | --- | --- |
| `export.valueRpPerKwh` | 0 | sourced | Net metering abolished by Energy Ministry Regulation 2/2024: [ABNR](https://www.abnrlaw.com/news/indonesia-issues-new-rules-on-operation-of-rooftop-solar-abolishes-net-metering) |
| `size.regulatoryCap` | none | sourced | The limit of 100% of connected power was removed; size follows PLN quota: [ESDM](https://www.esdm.go.id/id/media-center/arsip-berita/aturan-terbaru-plts-atap-terbit-kini-kapasitas-pemasangan-tidak-dibatasi) |
| `minCharge.afterSolarAppliesToAll` | true | sourced | Regulation 2/2024 Article 16: a prepaid customer's rooftop solar application counts as a request to move to postpaid, and PLN must agree. Checked against the regulation's text on 2026-11-14. So after installation the minimum charge applies in every class listed under `minCharge.classes`, whatever the customer pays by today |
| `minCharge.prepaidBeforeSolar` | false | sourced | In Annex II the footnote *) sits in the postpaid ("reguler") fixed-charge column; the prepaid ("prabayar") column lists only the energy rate. Same source. This is a reading of the table layout; no sentence of the regulation says it in words. It matters only before solar: a prepaid home that applies for rooftop solar moves to postpaid (Regulation 2/2024 Article 16), so SPEC 3.2 step 7 applies the minimum charge after solar |
| `minCharge.classes` | R-1 900 VA-RTM, R-1 1,300 VA, R-1 2,200 VA, R-2, R-3 | sourced | Same Annex II. The subsidised R-1 450 VA and 900 VA postpaid classes have a fixed charge (biaya beban) of Rp11,000 and Rp20,000 per kVA per month instead, and no minimum charge. New key added by T03 |

## Cost

| Key | Value | Label | Source |
| --- | --- | --- | --- |
| `capex.perKwp.low` | Rp11,000,000 | thin | Lowest per-kWp figure found: 5 kWp for Rp55 million, from the price table below (our division). Unchanged |
| `capex.perKwp.typical` | Rp16,000,000 | thin | Median (16.1) and mean (16.0) of five installers' mid-prices for 3–5 kWp systems, 12.9 / 14.5 / 16.25 / 16.1 / 20.4 million per kWp (price table below, our arithmetic), rounded to 16. Was Rp13,000,000. Recommended because the earlier value rested on the two cheapest-looking ranges |
| `capex.perKwp.high` | Rp20,000,000 | thin | Top of the 5 kWp range of one installer (Rp100 million), and about the mid-price of the dearest installer (19.4–21.3 million). Was Rp15,000,000 |
| `battery.fixedCost` | Rp14,350,000 | thin | Hybrid inverter (Rp19.6m) less the on-grid inverter it replaces (Rp5.25m). Calculated from component prices, not a quote: see the battery build-up below. Set on review |
| `battery.costPerKwh` | Rp3,600,000 | thin | Battery only: Rp18.0m for about 5 kWh, same build-up. With the fixed cost, a 5 kWh battery is Rp32.35m and a 10 kWh battery Rp50.35m. Installation labour is not included |
| `opex.yearlyShareOfCapex` | 0.01 | thin | Indonesian rooftop study with annual operation and maintenance at 1% of investment (Rp143,295,000 gives Rp1,432,950 a year; Rp67,864,000 gives Rp678,640): [Gunardi and Amir 2024, Jurnal Teknik Elektro, Universitas Mercu Buana](https://publikasi.mercubuana.ac.id/index.php/jte/article/download/19109/9745). One academic source; no installer publishes a maintenance price. Value unchanged |
| `inverter.replacementYear` | 12 | decision | Consistent with 10–15 years for a string inverter: [pv magazine, 2021-09-17](http://www.pv-magazine-australia.com/2021/09/17/how-long-do-residential-solar-inverters-last/), citing EnergySage |
| `inverter.replacementShareOfCapex` | 0.15 | thin | Inverter as a share of the installed system: 10–20% (Solar Reviews, in the pv magazine article above, US data); Indonesian packages: 19.5% (Rp11.0 million of Rp56.5 million, [Suryaqua](https://suryaqua.com/2026/05/06/harga-paket-plts-rumah-lengkap-2026/)) and about 14% (Rp3.5–7.0 million inverter on a Rp30–45 million 2–3 kWp system, midpoint over midpoint, [Sobatbangun](https://sobatbangun.com/artikel/harga-panel-surya-april-2026-biaya-pasang-rumah/)). Median of the three, 15%. Was 0.10. Inverter prices tend to fall over 12 years, so this is on the cautious side |
| `battery.replacementYear` | 12 | thin | A 5.12 kWh LiFePO4 module is rated for 6,000 or more cycles to 70% capacity with a 10-year warranty ([Deye AI-W5.1-B datasheet page](https://deye.com/ro/?p=6721), manufacturer, undated, read 2026-11-14; the page is in Romanian). 6,000 cycles is 16 years at one cycle a day; the warranty is 10. 12 sits between and is unchanged. Cheap batteries carry shorter warranties: 3–5 years in the Suryaqua package list above |

### Price points behind the capex rows

Installed on-grid residential prices, collected on 2026-11-14 (T03). Each is an installer's or an advice site's published range, not a quote. Per-kWp figures are our division. Inclusions differ and are stated where the source says.

| Source | Date | 1 kWp | 2–3 kWp | 5 kWp | Notes |
| --- | --- | --- | --- | --- | --- |
| [Industry.co.id](https://www.industry.co.id/read/157290/panel-surya-bisa-hemat-tagihan-ini-biaya-dan-hitungannya) (one provider's illustration) | 2026-05 | | 3 kWp: Rp35–45m | Rp55–70m | Excludes permit and VAT |
| [Zonit Solar](https://zonitsolar.com/biaya-pasang-plts-on-grid-rumah-tangga/) | 2025-10-14 | Rp14–18m | 2 kWp: Rp25–30m; 3 kWp: Rp35–45m | Rp55–70m | Same 3 and 5 kWp ranges as the row above, so not independent of it |
| [Powersurya](https://powersurya.co.id/biaya-pasang-plts/) | 2026-01-17 | Rp15–20m | Rp25–40m | Rp70–90m | 5 kWp includes panels, inverter and installation |
| [Sobatbangun](https://sobatbangun.com/artikel/harga-panel-surya-april-2026-biaya-pasang-rumah/) | 2026-04-15 | Rp15–22m | Rp30–45m | Rp75–100m | States Rp14–17m per kWp generally |
| [Suryaqua](https://suryaqua.com/2026/05/06/harga-paket-plts-rumah-lengkap-2026/) | 2026-05-28 | Rp18.3m | 2.22 kWp: Rp37.2m; 3.5 kWp: Rp56.5m | | Installation included |
| [Lensolar](https://www.lensolar.co.id/product-category/paket-plts-atap-on-grid/paket-material-instalasi/) | undated, 2026 | Rp32m | 2 kW: Rp48m; 3 kW: Rp64m | Rp97m (1-phase) | Inclusions not stated; reads as a premium brand. Page's calculator says installation is included in Bandung and Jabodetabek |

Per-kWp mid-prices for 3–5 kWp, averaged per provider: Industry.co.id and Zonit together 12.9; Powersurya 14.5; Sobatbangun 16.25; Suryaqua 16.1; Lensolar 20.4. Prices per kWp fall as systems grow (1 kWp is Rp14–20m per kWp in most sources), so small systems cost more than the typical value; the engine uses one per-kWp figure.

Not found: ICA (ica.id) refused the fetch tool with a 403, so its 3 kWp and 5 kWp ranges, which appeared in a search summary, are not used. Whether the ranges above include VAT (PPN) is stated by only one source (it excludes it).

### Battery build-up (installed, including a hybrid inverter)

No installed price for a battery with a hybrid inverter was found. Components, all Rupiah, collected 2026-11-14:

| Component | Price | Source |
| --- | --- | --- |
| LiFePO4 battery, about 5 kWh | Rp18.0m (two sources agree: 4.8 kWh listing, and a 5 kWh line in an installed package) | [Tokopedia](https://www.tokopedia.com/amsan-electronics/battery-lifepo4-48v-100ah-power-wall-mounted-baterai-plts-ups); [Suryaqua](https://suryaqua.com/2026/05/06/harga-paket-plts-rumah-lengkap-2026/) |
| Hybrid inverter, 5 kW (Deye) | Rp19.4–19.75m; two undated Tokopedia listings (one with 2 left in stock, one on 20-day pre-order); the link is the first | [Tokopedia](https://www.tokopedia.com/ozetpi-power-bluetti-indonesia/deye-hybrid-inverter-1-phase-5kw-low-voltage-1732279673195759108) |
| On-grid inverter it replaces | Rp3.5–7.0m, midpoint 5.25m | [Sobatbangun](https://sobatbangun.com/artikel/harga-panel-surya-april-2026-biaya-pasang-rumah/) |

Our arithmetic, using Rp19.6m for the hybrid inverter: 5 kWh costs 18.0 + 19.6 − 5.25 = Rp32.35m (Rp6.5m per kWh); 10 kWh costs 36.0 + 19.6 − 5.25 = Rp50.35m (Rp5.0m per kWh). On review this was split into `battery.fixedCost` and `battery.costPerKwh` (Cost table), which reproduces both totals exactly; the single average of Rp5.75m per kWh is not used. Battery installation labour is not in the figure. One package list ([Suryaqua](https://suryaqua.com/2026/05/06/harga-paket-plts-rumah-lengkap-2026/)) shows its hybrid variant adding only the battery to a grid-tie inverter, which cannot work as described, so that row was not used as a hybrid price. A hybrid package from [Renus](https://renergynusantara.com/plts-hybrid/) (5.58 kWp, 5 kW Deye inverter, 5.12 kWh, Rp84 million, material only, updated August 2026) is consistent in size with these component prices but cannot be split. The cost has a fixed part (the inverter) and a per-kWh part (about Rp3.6–3.75m), which is why the assumption set carries two keys.

## System

| Key | Value | Label | Note |
| --- | --- | --- | --- |
| `panel.wattPeak` | 550 | sourced | 144-half-cell module, 550 W at STC, 21.3% efficient: [Sunova SS-550-72MDH datasheet](https://download.axilogi.com/Sunova/SS-535-550-72MDH.pdf), undated, read 2026-11-14. Several other brands list the same 550 W class at the same size (Suntech STP550S, Risen RSM144-9-550M, Sharp NUJD550) in search results; those datasheets were not opened. A smaller 54-cell class exists for homes, about 440 W at 1,722 × 1,134 mm (LONGi Hi-MO 6, search result, datasheet not opened) |
| `panel.areaM2` | 2.6 | sourced | Module 2,279 × 1,134 mm = 2.584 m², same datasheet; 2.6 is that rounded up. Density 213 W/m² |
| `system.minKwp` | 1.0 | thin | 1 kWp is the smallest on-grid package listed by Zonit Solar, Powersurya, Sobatbangun, Lensolar and Suryaqua's 1.0 kW package (price table above). One outlier: Suryaqua also lists a 0.5 kWp starter at Rp9.8 million. No installer statement of a minimum was found. Unchanged |
| `roof.usableFraction` | 0.65 | decision | Adjustable by the user; agreed range 0.60–0.70 |
| `roof.usableFraction.min` | 0.60 | decision | Lower end of the user's adjustment, the agreed range |
| `roof.usableFraction.max` | 0.70 | decision | Upper end of the user's adjustment, the agreed range |
| `pv.performanceRatio` | 0.75 | thin | Version 2. PVGIS 5.3's yield ÷ irradiation on a flat roof (PVGIS-ERA5, crystalline silicon, free-standing, its default 14% system loss) at Medan, Yogyakarta and Makassar: 0.747, 0.754, 0.743; mean 0.748, rounded. Within PVGIS's loss, heat costs about 11% in this climate, which version 1's 0.78 (a judgment) did not allow for. One model with a default system loss, so `thin`. Read 2026-11-15: [PVGIS API](https://re.jrc.ec.europa.eu/api/v5_3/PVcalc); method and numbers in `docs/VALIDATION.md` |
| `pv.degradationPerYear` | 0.005 | decision | |
| `shade.none` | 1.00 | judgment | |
| `shade.some` | 0.90 | judgment | |
| `shade.heavy` | 0.70 | judgment | |
| `battery.roundTripEfficiency` | 0.90 | judgment | |
| `battery.usableFraction` | 0.90 | judgment | |
| `batterySizesKwh.sizes` | 5, 10 | decision | |
| `battery.minFillShare` | 0.5 | decision | A battery is offered only when a typical day's useful surplus fills at least this share of the smallest battery's usable capacity. Added with the engine (T04) |

### Orientation factor (multiplier on horizontal irradiance)

| Key | Label |
| --- | --- |
| `orientation.table` | sourced |

Version 2, `sourced`, 2026-11-15. Each value is PVGIS 5.3's yearly yield on the tilted roof ÷ its yield on a flat roof at the same place, averaged over Medan (3.6° N) and Yogyakarta (7.8° S), and over east and west. Gentle is taken as 25° and steep as 45°, the angles of the roof-step pictures in `mock/atap.html` rounded to 5°; no source gives the slopes an angle, so the choice is ours (SPEC 3.2 step 3). `scripts/validate-pvgis.mjs` reproduces the table, and `docs/VALIDATION.md` shows it for every 5° from 5° to 45°.

| Slope | Facing the equator | East or west | Facing away |
| --- | --- | --- | --- |
| flat | 1.00 | 1.00 | 1.00 |
| gentle (25°) | 0.97 | 0.95 | 0.90 |
| steep (45°) | 0.85 | 0.84 | 0.72 |

Version 1 (provisional, `judgment`) had gentle 1.01 / 0.99 / 0.97 and steep 0.97 / 0.94 / 0.88. Every factor fell; the largest change is steep facing away from the equator, 0.88 to 0.72. Near the equator the sun is high and crosses to both sides of the sky in a year, so a tilted panel turns away from it for part of the year: a roof facing the equator yields less than a flat one beyond about 15°, and any other facing yields less at every tilt.

## Household use

| Key | Value | Label | Note |
| --- | --- | --- | --- |
| `load.daytimeShare.base` | 0.30 | judgment | Share of daily energy used 06:00–18:00 with nobody home |
| `load.daytimeShare.homeOnWeekdays` | +0.10 | judgment | |
| `load.daytimeShare.daytimeAc` | +0.15 | judgment | |
| `load.daytimeShare.workFromHome` | +0.05 | judgment | |
| `load.daytimeShare.electricVehicle` | −0.05 | judgment | Assumes charging at night |
| `load.daytimeShare.floor` | 0.15 | judgment | Lower limit. Added with the engine (T04) |
| `load.daytimeShare.cap` | 0.75 | judgment | |
| `bill.overheadShare` | 0.05 | judgment | Share of spend that is tax or fees and buys no energy. Was 0 (open). The regional street-lighting tax is the main part: 2.4% in Jakarta, taken from the top-up before it becomes kWh ([PLN statement, JawaPos 2026-06-02](https://www.jawapos.com/energi/2606010167/begini-cara-menghitung-tagihan-listrik-dan-mengelola-pemakaian-energi-menurut-pln)); set by each region, up to 10% by law ([PP 4/2023 via DDTC](https://news.ddtc.co.id/new-gov-reg-issued-government-sets-pbjt-regulation-for-electricity-46002)). The 5% is our midpoint between the 2.4% floor we found and typical regional rates; no national average exists. Zero would overstate energy use and oversize the system. Also in the bill but not counted: stamp duty (amount not stated by PLN) and a payment-channel admin fee (not PLN's; varies). VAT is said to apply only to some customer groups; the search results point to R-3 above 6,600 VA, not verified |

The load shape is the engine's weakest input and its most important one. Any measured Indonesian household load profile replaces these. T03 found none; the closest source is a survey-based national estimate: [CLASP and Ipsos, Indonesia Residential End Use Survey, 2020-06-08](https://www.clasp.ngo/wp-content/uploads/2021/01/Indonesia-Residential-End-Use-Survey.pdf), 5,443 households visited. It combines reported appliance use with appliance power, so it is modelled, not metered, and it covers all households, not one with nobody home. Its national hourly demand has a base load of about 6,000 MW, a morning peak of 8,000 MW between 04:00 and 08:00, demand falling to about 6,500 MW from 08:00 to 16:00, and an evening peak above 11,000 MW (about 11,600 MW at 19:00) from 17:00 to midnight (Section 6.3, Figure 54). It supports a flat daytime and a strong evening, and does not give a daytime share. The `load.daytimeShare.*` values stay `judgment`.

## Finance and climate

| Key | Value | Label | Note |
| --- | --- | --- | --- |
| `finance.horizonYears` | 25 | decision | |
| `finance.tariffEscalationPerYear` | 0 | decision | Adjustable by the user |
| `grid.emissionKgCo2PerKwh` | 0.87 | thin | 0.87 tCO2 per MWh is the Jawa-Madura-Bali grid combined-margin factor (50% operating, 50% build) from Energy Ministry Decree 163.K/HK.02/MEM.S/2021, which uses 2019 data. We read the value in a government-hosted mitigation document that quotes the decree ([SRN mitigation action document](https://asset.srnmenlh.id/srn-menlhk/files/3ff4297a-0300-4efd-9572-9eca8eb4ba30.pdf), "0,87 ton CO2/MWh"), and the decree's existence, number and date (30 August 2021) in [RuangEnergi](https://www.ruangenergi.com/pemerintah-terbitkan-aturan-emisi-grk-sistem-ketenagalistrikan/). The decree's annex was not found online, so the value is second-hand. It covers the Java-Bali grid only; other grids may differ, and no newer official factor was found. Was 0.85 (open) |

## Sun data

These rows are settings of the sun-data code in `src/lib/sun/`, not entries of the assumption set, so the keys here are this document's own.

| Key | Value | Label | Note |
| --- | --- | --- | --- |
| `sun.source` | NASA POWER hourly API | decision | Endpoint `/api/temporal/hourly/point`; hourly data from 2001; default time standard is local solar time; 15 parameters per request at most: [NASA POWER](https://power.larc.nasa.gov/docs/services/api/temporal/hourly/) |
| `sun.timeStandard` | UTC, moved to the pin's legal time zone per request | decision | SPEC 3.4. Requested with `time-standard=UTC`; the response header confirms it (checked live 2026-11-17). The cache and the bundled files hold UTC; the last step of the sun service rotates the 8,760 hours by the pin's UTC offset (WIB 7, WITA 8, WIT 9, from the province lookup in `src/lib/timezone/`). NASA's own "LST" is not used: it follows NASA's 1° source grid, so its zone edges fall at 98°, 113° and 128° E (read from the live API 2026-11-17), an hour off the legal zone on WIB land west of 98° E (Aceh) and east of 113° E (East Java from about Probolinggo to Banyuwangi, eastern Madura, Central Kalimantan east of 113° E including Palangka Raya), and on WIT land west of 128° E (Ternate, Tidore). Lives in `src/lib/sun/nasa.ts` and `legalTime.ts` (T20) |
| `sun.year` | most recent calendar year that ended at least 6 months ago | decision | SPEC 3.4. NASA's solar data runs about four months behind the calendar (on 2026-11-15 the monthly record had 2026 only to July), so last year is not complete in NASA until well into this one: 2025 is used until 30 June 2027, 2026 from 1 July 2027. Lives in `latestAvailableYear` (`src/lib/sun/nasa.ts`). Its hour-by-hour pattern is used; its total is scaled to the long-term mean (next rows) |
| `sun.longTermSource` | NASA POWER monthly API | decision | Endpoint `/api/temporal/monthly/point`, same parameter `ALLSKY_SFC_SW_DWN` and source (CERES SYN1deg) as the hourly series, in kWh/m²/day per month; a missing month is -999. Agrees with the hourly series on 2025 to the kWh/m² at Medan, Yogyakarta and Makassar (T19, 2026-11-15; `docs/VALIDATION.md`) |
| `sun.longTermYears` | 20, ending with `sun.year` | decision | SPEC 3.4. One factor per place: mean yearly irradiation of these years ÷ the hourly year's. Approved by the owner 2026-11-15. A year counts 365 days, February as 28, matching the hourly series. Lives in `src/lib/sun/longTerm.ts`, not the engine's assumption set, since the series reaches the engine already scaled |
| `sun.longTermMinYears` | 10 | decision | SPEC 3.4. A year with a missing month is left out; with fewer usable years the request counts as failed and the fallback is used |
| `sun.cacheCellDegrees` | 0.5 | decision | |
| `sun.crossCheck` | PVGIS 5.3, database PVGIS-ERA5 | decision | `https://re.jrc.ec.europa.eu/api/v5_3/`, GET only, 30 calls per second per address: [JRC](https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis/getting-started-pvgis/api-non-interactive-service_en). PVGIS-ERA5 is the only PVGIS 5.3 database that covers Indonesia (T07, 2026-11-15; evidence in `docs/VALIDATION.md`) |

Settled: the NASA POWER parameter is `ALLSKY_SFC_SW_DWN` (T06), and the PVGIS database for Indonesia is PVGIS-ERA5, a reanalysis, since the satellite database PVGIS-SARAH3 stops short of it (T07). Every series, live or bundled, is scaled to the long-term mean (T19). Each bundled file in `data/sun-fallback/` records its factor and the years used; for 2025 against 2006–2025 they run from 0.995 (Jayapura, the one city where 2025 was brighter than its mean) to 1.070 (Yogyakarta).

## Open items: T03 record (2026-11-14)

The ten open items of the first version, with what was found. Searches ran in Indonesian and English on 2026-11-14. "Not found" lists what was tried.

1. **Running costs and replacements.** Resolved, all `thin`. `opex.yearlyShareOfCapex` 0.01 kept (one Indonesian academic study at 1%). `inverter.replacementShareOfCapex` 0.10 to 0.15. `battery.replacementYear` 12 kept. Sources in the Cost table. Not found: any Indonesian installer's published maintenance price or inverter replacement quote; an NREL residential benchmark (the tool could not open the NREL pages, so none is used).
2. **`system.minKwp`.** Resolved, `thin`, 1.0 kept. Not found: an installer statement of a minimum size.
3. **`bill.overheadShare`.** Partly resolved: 0 to 0.05, `judgment`. How the bill is built is established (street-lighting tax at a regional rate, stamp duty, VAT for some groups, channel admin fee); no national average rate was found. Prepaid: the tax is taken from the top-up first. Postpaid: it is added to the bill. Not found: a table of street-lighting tax rates by region from a primary source (queries: PPJ rates by region, PBJT tenaga listrik tarif daerah); the amount of the stamp duty on bills; PLN's own statement of the VAT rule for household classes.
4. **`grid.emissionKgCo2PerKwh`.** Resolved, `thin`, 0.85 to 0.87 (Java-Bali, 2019 data, second-hand). Not found: the annex of Decree 163.K/HK.02/MEM.S/2021; any ESDM factor for 2020 to 2024; factors for Sumatra and other grids. Queries: faktor emisi sistem ketenagalistrikan, Kepmen 163.K/HK.02/MEM.S/2021, gatrik.esdm.go.id nilai faktor emisi (the 2018 value file named in a search result returned an error page). Other figures seen in search results and not opened or verified: 0.79 (ESDM 2018), 0.817 (IESR, 2019, Java-Bali), 0.84 (a 75/25 combined margin).
5. **`minCharge.*`.** Resolved, both now `sourced`, from the Energy Ministry regulation PLN applies, not from PLN's own page (none found). Classes, formula and prepaid reading are in the Regulation table. Not found: a PLN page stating the rule; any sentence in the regulation that says prepaid has no minimum charge.
6. **`capex.perKwp.*`.** Resolved, `thin`: five more installer price sources beside the original (table above). Typical 13 to 16 million, high 15 to 20 million Rupiah; low 11 unchanged.
7. **`battery.costPerKwh`.** Partly resolved, `thin`: 3.75 to 5.75 million, built from components because no installed hybrid quote was found. Not found: an installed price for a hybrid inverter plus battery; a Growatt or Sungrow price in Rupiah.
8. **`panel.*`.** Resolved, both `sourced`, values unchanged (Sunova datasheet).
9. **Measured household load profile.** Not found, as a metered per-household profile. Closest: the CLASP and Ipsos survey estimate (Household use section). Queries: profil beban harian rumah tangga, kurva beban pelanggan R1 PLN, load research R1 PLN, residential load profile Indonesia. A feeder-level tariff-simulation paper and a rooftop techno-economic paper turned up in results; neither was opened.
10. **PLN application steps.** Resolved from the regulation: see the next section.

## PLN rooftop solar application steps (for the "what happens next" section)

Source: [Energy Ministry Regulation 2/2024 on rooftop solar connected to the PLN grid](https://jdih.esdm.go.id/storage/document/Permen%20ESDM%20Nomor%202%20Tahun%202024.pdf), signed 2024-01-29, promulgated 2024-01-31, read in full on 2026-11-14. Article numbers are in brackets. PLN is the holder of the supply business licence (IUPTLU). No amendment or replacement was found; searches returned only 2023 to 2024 coverage of the revision that produced it.

1. **Quota.** The size of the system you may build follows the quota PLN publishes for your grid area (Articles 9 and 12). When the quota is full, applications go on a waiting list for the next period (15(8)). A news report of 2026-03-03 puts the 2026 national quota at 485 MW, about 304 MW already taken by the waiting list and about 183 MW open for the January round, and says some regions run out in January ([Katadata](https://katadata.co.id/amp/ekonomi-hijau/investasi-hijau/69b2654ba24a8/war-kuota-plts-atap-di-tengah-mimpi-kemandirian-energi)). That is press, not the regulation (confidence `thin`).
2. **Apply to PLN** in January or in July of each year (14(2)), on the form in the regulation's Annex II. The same report says the January and July rounds run through the PLN Mobile app; the regulation does not name the channel.
3. **PLN answers within 30 calendar days** after the application window closes. No answer in that time counts as approval (15(1) and (2)). A refusal comes in writing with the reason, and you may apply again (15(6) and (7)).
4. **Prepaid customers switch to postpaid.** The application counts as a request to change, PLN must agree, and the change happens when the advanced meter is fitted (Article 16).
5. **Install through a business entity** (Badan Usaha) that meets the electricity-safety rules, not by the owner, and only after approval (Articles 21 and 22). A system connected before approval must be disconnected, and the owner pays a penalty of inverter capacity × 240 hours × the tariff (23(1)). For a system up to 500 kW the owner also files one report to the Minister or governor before building (Article 18).
6. **Safety certificate.** A small system (up to 500 kW, one inverter, or several under 10 kW in total, one roof structure, one earthing, one installation) is deemed to meet the operating-certificate (SLO) rule if the owner or installer signs a safety statement with product certificates, a valid manufacturer warranty, and a commissioning test or maintenance documents, and gets a registration number from the Minister (Article 25). Systems outside that description need an SLO from a technical inspection body (Article 24).
7. **Deadlines.** Registration number within 3 months, or SLO within 6 months, of PLN's approval, or PLN cancels the approval (Article 26).
8. **PLN fits an advanced meter** within 15 working days of receiving the SLO or the registration proof, at PLN's cost (Article 28). No parallel-operation fee is charged (Article 29).
9. **No credit for exports.** Surplus energy fed into the grid is not counted in the bill (Article 13).

Not found: the cost of an SLO from an inspection body, if one is needed (one search result puts an SLO at Rp1.5–2.5 million; not verified); the installer's own permit costs (one installer's price list says its prices exclude them); PLN's own page for the process.
