# SuryaPas

*Panel surya yang pas untuk rumah Anda.* Rooftop solar that fits your home.

SuryaPas is a web calculator for Indonesian homeowners. You give it a location, a roof and what you pay PLN each month. It returns how many solar panels fit your home, what they cost as a range, and how many years they take to pay for themselves, with and without a battery. It does this in Bahasa Indonesia and English, on a phone, with no login.

Its one opinion: since 2024, solar power sent back to the grid earns nothing, so the right system is the one sized to what your home uses **while the sun is up**, not to your whole bill. A system sized to the bill is too big, and the calculator shows you the money you would waste on it.

> **[PLACEHOLDER: screenshot of the result page. To be added once the result page is accepted (task T13).]**
>
> **[PLACEHOLDER: live link. To be added once the app is deployed (task T17).]**

**Can the numbers be trusted?** They are traceable, and where they are weak the app says so.

- Every price, rate and factor is a named entry in one versioned assumption set, with its source, date and a confidence label (`sourced`, `thin`, `judgment`, `decision`). Nothing is hidden in the code.
- The calculation engine is plain TypeScript with no outside dependencies, covered by unit tests that include small cases worked out on paper.
- On a flat roof, the engine's yearly output per kWp is within about 11% of PVGIS, the European Commission's solar model: 4.3% below it at Medan, 3.6% below at Yogyakarta and **10.8% above it at Makassar**. Nearly all of that is two sunlight databases disagreeing, and at Makassar the engine is on the optimistic side. Section 4 has the details.
- The weakest inputs are the household's hour-by-hour electricity use (estimated from four yes/no questions) and installed prices (a handful of published price lists). Section 4.2 lists every known limit.

**Contents**

1. [Why size to the daytime](#1-why-size-to-the-daytime)
2. [How the engine works](#2-how-the-engine-works) (the method, step by step, with worked examples)
3. [A whole house, start to finish](#3-a-whole-house-start-to-finish)
4. [How far to trust it](#4-how-far-to-trust-it) (validation against PVGIS, known limits)
5. [Run it locally](#5-run-it-locally)
6. [How the repository is laid out](#6-how-the-repository-is-laid-out)

---

## 1. Why size to the daytime

Until 2024, Indonesian homes with rooftop solar could send surplus power to the grid and be credited for it ("net metering"), so a bigger system always saved more. Energy Ministry Regulation 2/2024 ended that: surplus energy fed into the grid is not counted in the bill (Article 13). The same regulation also removed the old limit of 100% of connected power; the only cap now is the quota PLN publishes for each grid area. So panels now save money only for the electricity the home uses at the moment they produce it. Anything beyond that is exported for nothing, and each extra panel adds cost but little saving.

A small battery changes this by moving some daytime surplus into the evening, but it adds a large fixed cost, so the engine treats it as a variant to compare, not a default.

## 2. How the engine works

The engine is the folder `src/engine/`. Its front door is the function `assess` in `src/engine/assess.ts`. It takes three things and returns a full assessment:

```
assess(inputs, sun, assumptions)  →  assessment
  inputs       where the house is, the roof, the PLN spend, four lifestyle answers
  sun          8,760 hourly sunlight values for that place, one year
  assumptions  the versioned set of every price, rate and factor
```

Rules the engine keeps, so that the same input always gives the same answer in the browser and on the server:

- It imports nothing from outside `src/engine/`, reads no clock, does no input or output, and uses no randomness.
- No price, rate, factor or threshold is written in the logic. Each one is read from the assumption set. The only literal numbers in the logic are unit conversions: 1,000 W per kW, 12 months, 24 hours.

### 2.0 Conventions to know before the steps

**One year, 8,760 hours.** The engine's year has 365 days (no leap day), so 365 × 24 = 8,760 hours. Hour 0 is 1 January from 00:00 to 01:00. The household's day is described in clock time. The sun data is requested in UTC and then moved to the legal time zone of the pin (WIB, WITA or WIT, read from the province the pin is in), so the solar hours are the home's clock time everywhere (SPEC 3.4). The engine's year always starts on a Monday, which only decides which days count as weekends (code: `src/engine/calendar.ts`).

**Daytime means 06:00 to 18:00.** Close to the equator that is roughly sunrise to sunset all year.

**Units.** A **kWh** is energy: running 1,000 W for an hour. A **kWp** ("kilowatt-peak") is a panel's rated power: what it produces under 1,000 W/m² of sunlight, in lab conditions. Panels here are 550 W each, so 4 panels are 4 × 550 ÷ 1,000 = 2.2 kWp.

**The assumption set.** `CURRENT_ASSUMPTIONS` (in `src/engine/assumptions/`) is version 2. A released version is never edited; a change means a new version file, and every saved result records the version it used. Each entry carries a confidence label:

| Label | Meaning |
| --- | --- |
| `sourced` | taken from a cited source |
| `thin` | cited, but from a single or weak source |
| `judgment` | a typical engineering value with no citation yet |
| `decision` | a product choice agreed with the owner |

The research behind every value, with links, is in `docs/ASSUMPTIONS.md`. In the text below, a value is written like this: `pv.performanceRatio` = 0.75 (`thin`). A `thin` or `judgment` value is a best estimate, not a settled fact.

**The pipeline.** `assess` runs nine steps. Steps 1 to 6 are the energy half (`simulateEnergy` in `src/engine/energy/index.ts`); steps 7 and 9 are the money half (`assessMoney` in `src/engine/money/index.ts`); step 8 is `recommend` in `assess.ts`.

```
 1 monthly energy use        spend in rupiah  →  kWh in each month
 2 hourly load               kWh a month      →  kWh in each of 8,760 hours
 3 solar per kWp             sunlight         →  kWh per installed kWp, each hour
 4 candidate sizes           roof area        →  the panel counts that fit
 5 hourly simulation         solar vs load    →  used on site, exported, bought from PLN
 6 battery variant           same, with a battery
 7 money                     bills, cost, payback, net savings
 8 recommendation            the size with the highest net savings
 9 CO₂ avoided
```

Every worked example below was produced by calling the real engine functions with the inputs shown, using assumption set version 2. The unit tests beside each engine file (`*.test.ts`) hold the same small cases with the arithmetic in their comments.

### 2.1 Step 1: monthly energy use

**What it answers:** the bill says how many rupiah, but the rest of the pipeline needs kWh.

**Formula.**

```
kWh in a month  =  spend × (1 − overhead share) ÷ tariff
```

- The **tariff** (Rp per kWh) comes from the PLN power class of the home. The engine picks the class from the connected power in VA and the "subsidised" flag, walking PLN's classes from smallest to largest and taking the first that fits. A home marked subsidised above 900 VA is treated as an ordinary class, since no subsidised class exists there.
- The **overhead share** is the part of what a household pays that buys no energy: mainly the regional street-lighting tax. `bill.overheadShare` = 0.05 (`judgment`): 2.4% is the lowest rate found (Jakarta), the law allows up to 10%, and no national average exists. Setting it to zero would overstate energy use and oversize the system.
- If fewer than twelve months of spend are given, their mean is used for every month. With exactly twelve, they are read as January to December.

**Tariffs in the assumption set** (October to December 2026, all `sourced`, from press reports consistent with Annex II of Energy Ministry Regulation 7/2024). In `docs/ASSUMPTIONS.md` and in code they are the `powerClasses.classes.*` entries.

| Class | Connected power | Rp per kWh |
| --- | --- | --- |
| `R1_450_subsidised` | up to 450 VA | 415 |
| `R1_900_subsidised` | up to 900 VA | 605 |
| `R1_900_nonsubsidised` | up to 900 VA | 1,352 |
| `R1_1300` | up to 1,300 VA | 1,444.70 |
| `R1_2200` | up to 2,200 VA | 1,444.70 |
| `R2_3500_5500` | up to 5,500 VA | 1,699.53 |
| `R3_6600_up` | above 5,500 VA | 1,699.53 |

**Worked example.** A 2,200 VA home that spends Rp650,000 a month. Class `R1_2200`, tariff 1,444.70.

```
650,000 × (1 − 0.05) = 617,500   (the Rp32,500 of overhead buys no energy)
617,500 ÷ 1,444.70   = 427.42 kWh a month
```

Giving two months, Rp600,000 and Rp700,000, also gives 427.42 kWh in every month (the mean spend is Rp650,000). Giving twelve months of Rp100,000, Rp200,000, ... Rp1,200,000 gives 65.76 kWh for January and 789.09 kWh for December.

**Known limit.** Subsidised 450 VA and 900 VA homes on a monthly bill pay a three-block tariff plus a fixed charge. This single tariff approximates that. The product accepts it, since those homes get the "unlikely to pay back" verdict either way (see 3.3).

**Code:** `tariffClassOf` and `monthlyEnergyKwh` in `src/engine/energy/monthlyEnergy.ts`.

### 2.2 Step 2: hourly load

**What it answers:** a bill says how much energy a home used, not **when**. Solar only helps with what is used while the sun is up, so the engine needs the day's shape.

The four lifestyle answers set one number, the **daytime share**: the fraction of a day's energy used between 06:00 and 18:00. A fixed shape then spreads it over the hours.

**Formula 1: the daytime share.**

```
daytime share  =  base + an increment for each "yes",  kept between a floor and a cap
```

| Entry | Value | Label |
| --- | --- | --- |
| `load.daytimeShare.base` (nobody home in the daytime) | 0.30 | `judgment` |
| `load.daytimeShare.homeOnWeekdays` (someone is home on weekdays) | +0.10 | `judgment` |
| `load.daytimeShare.daytimeAc` (air conditioning on in the daytime) | +0.15 | `judgment` |
| `load.daytimeShare.workFromHome` | +0.05 | `judgment` |
| `load.daytimeShare.electricVehicle` (charged at night) | −0.05 | `judgment` |
| `load.daytimeShare.floor` and `.cap` | 0.15 and 0.75 | `judgment` |

On weekends the engine assumes someone is home whatever the weekday answer, so a weekend gets the "home" increment. With the default values the floor and cap never bind (the lowest possible share is 0.25 and the highest 0.60); they are guard rails.

Examples: nobody home gives 0.30 on a weekday and 0.30 + 0.10 = 0.40 on a weekend. Someone home on weekdays and nothing else gives 0.40 every day. All four answers "yes" gives 0.30 + 0.10 + 0.15 + 0.05 − 0.05 = 0.55 on a weekday.

**Formula 2: the shape of the day.** Daytime energy is spread over the twelve hours 06:00 to 18:00 with `DAY_SHAPE`; the rest is spread over the twelve night hours 18:00 to 06:00 with `NIGHT_SHAPE`. Each shape sums to 1.

```
daytime hour:  fraction of the day's energy = daytime share       × DAY_SHAPE[hour − 6]
night hour:    fraction of the day's energy = (1 − daytime share) × NIGHT_SHAPE[hours since 18:00]
hour's load (kWh)  =  the month's kWh ÷ days in the month  ×  that fraction
```

| Hour starting | 06 | 07 | 08 | 09 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DAY_SHAPE` | .055 | .065 | .075 | .080 | .085 | .095 | .100 | .100 | .095 | .090 | .085 | .075 |

| Hour starting | 18 | 19 | 20 | 21 | 22 | 23 | 00 | 01 | 02 | 03 | 04 | 05 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NIGHT_SHAPE` | .13 | .15 | .15 | .13 | .10 | .07 | .04 | .04 | .04 | .04 | .05 | .06 |

The daytime shape rises through the morning and peaks in the early afternoon. The night shape has a strong evening peak, a low overnight base and a small rise before dawn, following the survey of Indonesian homes by CLASP and Ipsos (2020). Both shapes are the engine's own judgment: no metered Indonesian household profile was found.

**Worked example.** The 427.42 kWh home, someone home on weekdays, nothing else, so the daytime share is 0.40. A January day is 427.42 ÷ 31 = 13.788 kWh.

```
12:00 to 13:00   13.788 × 0.40 × 0.100 = 0.5515 kWh
19:00 to 20:00   13.788 × 0.60 × 0.150 = 1.2409 kWh
03:00 to 04:00   13.788 × 0.60 × 0.040 = 0.3309 kWh
whole day, 06:00 to 18:00   13.788 × 0.40 = 5.515 kWh
```

All 8,760 hourly values add back up to the twelve monthly totals (5,129.09 kWh for the year here).

**Why this is the most important input.** The daytime share decides how much solar the home can use directly. It rests on judgment, not measurement. A user's best defence is to answer the four questions honestly; the result page's panel picker then shows what changes with size.

**Code:** `daytimeShare`, `hourlyFractions`, `buildHourlyLoad` and the two shapes in `src/engine/energy/loadProfile.ts`.

### 2.3 Step 3: solar output per kWp

**What it answers:** for every hour of the year, how much energy does one kWp of panels on this roof make?

**Formula.**

```
kWh per kWp in an hour  =  sunlight ÷ 1,000  ×  performance ratio  ×  orientation factor  ×  shade factor
```

- **Sunlight** is global horizontal irradiance in W/m² (the sunlight on a flat, horizontal surface), for that hour. A kWp is defined at 1,000 W/m², so dividing by 1,000 turns the reading into "how many kWp-hours of full sun". A negative reading is treated as darkness.
- **Performance ratio**, `pv.performanceRatio` = 0.75 (`thin`): the share of the sunlight's energy that arrives at the socket, after heat, the inverter, wiring and dust. It is the mean of PVGIS's own whole-system ratios at three Indonesian cities (0.747, 0.754, 0.743). Two cautions: it assumes PVGIS's default 14% system loss, which is not an Indonesian figure, and PVGIS panels stand free in the air while panels on a tiled roof run hotter, so a real rooftop may lose a little more.
- **Orientation factor**: the effect of the roof's tilt and direction compared with a flat roof (below).
- **Shade factor**: `shade.none` 1.00, `shade.some` 0.90, `shade.heavy` 0.70 (all `judgment`). "Some" means shade in the morning or afternoon.

**The orientation factor.** The user picks a slope from pictures and a compass direction, not an angle. Each slope choice stands for a **range** of angles and is calculated at one angle in that range:

| Slope choice | Range of angles | Calculated at |
| --- | --- | --- |
| flat | under about 10° | no factor (always 1.00) |
| gentle | about 10° to 35° | 25° |
| steep | above about 35° | 45° |

The direction matters relative to the equator, not as north or south. South of the equator (Java, Bali) a north-facing roof looks toward the sun's path; north of it (Medan, Manado) a south-facing roof does. East and west share one factor, the mean of the two. A sloped roof with no facing direction given also uses that east-west factor. The factors are version 2's `orientation.table` (`sourced`), each one PVGIS's yearly yield on the tilted roof divided by its yield on a flat roof at the same place, averaged over Medan and Yogyakarta:

| Slope | Toward the equator | East or west | Away from the equator |
| --- | --- | --- | --- |
| flat | 1.00 | 1.00 | 1.00 |
| gentle (25°) | 0.97 | 0.95 | 0.90 |
| steep (45°) | 0.85 | 0.84 | 0.72 |

The angles in this table are a judgment: each slope word is a range, and 25° and 45° are one choice inside it (see 4.2). Close to the equator the sun is high and passes on both sides of the sky during the year, so a tilted roof only breaks even with a flat one up to about 15° when it faces the equator, and loses a little at any tilt otherwise. That is why every factor is below 1.

**Worked example.** One hour with 800 W/m², so 800 ÷ 1,000 = 0.8.

| Roof | Calculation | kWh per kWp |
| --- | --- | --- |
| Flat, no shade | 0.8 × 0.75 | 0.6000 |
| Gentle, facing north, Yogyakarta (toward the equator), no shade | 0.8 × 0.75 × 0.97 | 0.5820 |
| Gentle, facing south, Yogyakarta (away from the equator), no shade | 0.8 × 0.75 × 0.90 | 0.5400 |
| Gentle, facing south, Medan (toward the equator), no shade | 0.8 × 0.75 × 0.97 | 0.5820 |
| Gentle, facing east, some shade | 0.8 × 0.75 × 0.95 × 0.90 | 0.5130 |
| Steep, facing east, heavy shade | 0.8 × 0.75 × 0.84 × 0.70 | 0.3528 |

Adding up all 8,760 hours gives the roof's yearly yield per kWp; for the example house in section 3 it is 1,352.84 kWh per kWp.

**The sunlight series, and what is done to it before the engine sees it.** The engine takes the sunlight as an argument. In the app it comes from NASA POWER's hourly service, fetched by the server, for the latest calendar year that ended at least six months ago (NASA's data runs about four months behind). One year is not the long-term sun: at the three validation cities 2025 was 1.7% to 6.9% below NASA's own twenty-year mean. So before the engine, every hour of the year is multiplied by one factor:

```
factor  =  mean yearly sunlight of the last 20 years  ÷  the yearly sunlight of the hourly year
```

For Yogyakarta the bundled file holds 1,859.57 kWh/m² for the twenty-year mean and 1,738.47 for 2025, so the factor is 1,859.57 ÷ 1,738.47 = 1.0697. One factor for the whole year keeps that year's real hour-by-hour pattern of cloud. It is not done month by month, since a very dull month would be stretched past what a clear sky delivers. That scaling lives in `src/lib/sun/longTerm.ts`, outside the engine. If the live service fails or is slow, the app uses bundled series for twelve major cities (`data/sun-fallback/`), scaled in the same way, and labels the result "approximate".

**Code:** `solarPerKwp`, `orientationFactor` and `shadeFactor` in `src/engine/energy/solar.ts`.

### 2.4 Step 4: candidate sizes

**What it answers:** which system sizes does the roof hold?

**Formulas.**

```
usable area  =  roof area × usable fraction
most panels  =  whole number below (usable area ÷ panel area)
fewest panels = whole number above (smallest system in kWp ÷ kWp of one panel)
```

`roof.usableFraction` = 0.65 (`decision`; adjustable by the user within 0.60 to 0.70, the range held as `roof.usableFraction.min` and `.max` in the assumption set). `panel.areaM2` = 2.6 m² and `panel.wattPeak` = 550 W (both `sourced`, from one 550 W module's datasheet). `system.minKwp` = 1.0 (`thin`): the smallest on-grid package the installers checked list. The engine assesses every whole panel count from the fewest to the most. No regulatory size cap applies; PLN's quota in the user's area is the only limit and the engine cannot know it.

**Worked example.** A 48 m² roof: usable area 48 × 0.65 = 31.2 m². Panels: 31.2 ÷ 2.6 = 12. The fewest: one panel is 0.55 kWp, so 1.0 ÷ 0.55 = 1.82, rounded up to 2 panels (1.10 kWp). Candidates: 2, 3, 4, ... 12 panels.

A 4 m² roof: usable area 2.6 m², which holds 1 panel, below the 2 needed, so there is no candidate. The result says the smallest system needs 2 × 2.6 ÷ 0.65 = 8 m² of roof.

**Where the inputs come from.** In the roof step the user traces the roof on the map or types the area (one value), picks the slope, facing and shade from pictures, and can adjust the usable fraction between 0.60 and 0.70. The step warns below 5 m² and above 500 m² and refuses above 2,000 m². The area is the roof as seen from above, with no slope correction (see 4.2). The map is built against the street map; Esri satellite imagery needs a key that does not exist yet, so it is not live.

**Code:** `listCandidateSizes` and `kwpOfPanels` in `src/engine/energy/candidates.ts`.

### 2.5 Step 5: the hourly simulation

**What it answers:** for one system size, how much of its output does the home use, how much goes to waste, and how much does the home still buy?

**Formulas, hour by hour, over all 8,760 hours.**

```
solar         = kWh per kWp in that hour × system kWp
self-consumed = the smaller of solar and load
exported      = solar − self-consumed     (surplus; earns nothing)
grid import   = load − self-consumed
```

Surplus has zero value because of Regulation 2/2024 Article 13 (section 1). `docs/ASSUMPTIONS.md` lists this under "Rules built into the engine" as `export.valueRpPerKwh` = 0 (`sourced`); it is not an entry of the assumption set, since exports are simply left out of the savings.

Totals are kept for the whole year and for each month. The monthly grid import is what step 7 turns into a bill.

**Worked example.** One day, small enough for paper. Each kWp makes 0.5 kWh in each of the four hours 10:00 to 14:00 and nothing else. The home uses 0.4 kWh in every hour, 9.6 kWh a day.

| System | Solar | Self-consumed | Exported | Bought from PLN |
| --- | --- | --- | --- | --- |
| 1 kWp | 4 × 0.5 = 2.0 | 4 × 0.4 = 1.6 | 4 × (0.5 − 0.4) = 0.4 | 9.6 − 1.6 = 8.0 |
| 0.5 kWp | 4 × 0.25 = 1.0 | 1.0 | 0 | 9.6 − 1.0 = 8.6 |

Even a 100 kWp system self-consumes only 1.6 kWh: the home cannot use more than 0.4 kWh in an hour. Past that point, every panel only adds export. A home that uses power only at night (1 kWh in each hour from 18:00 to 22:00) gets nothing from panels alone: it self-consumes 0, exports 2.0 and buys 4.0.

**Code:** `simulateWithoutBattery` in `src/engine/energy/simulate.ts`.

### 2.6 Step 6: the battery variant

**What it answers:** if the home also had a battery, how much of the surplus could it keep for the evening?

**Rules, each hour.** The home first uses solar directly. Any surplus charges the battery, until it is full. The battery then serves the home's shortfall before the grid does.

```
battery capacity (usable)   = battery size × usable fraction        (0.90)
stored per kWh taken in     = round-trip efficiency                 (0.90)
charged  (from the panels)  = the smaller of: surplus, and (room left ÷ efficiency)
                              where room left = usable capacity − energy stored
stored  += charged × efficiency          loss += charged × (1 − efficiency)
discharged                  = the smaller of: the shortfall, and what is stored
```

`battery.roundTripEfficiency` and `battery.usableFraction` are both 0.90 (`judgment`). The battery starts the year empty.

**Worked example.** Same one-day sun; the home uses 1 kWh in each hour from 18:00 to 22:00 (4 kWh). A 1 kWp system with a 5 kWh battery (4.5 kWh usable): the 2.0 kWh of solar all goes in, 2.0 × 0.90 = 1.8 kWh stored, 0.2 lost. At night the battery supplies 1.8 kWh; the home buys 4.0 − 1.8 = 2.2 kWh.

A 10 kWp system makes 20 kWh. The battery has room for 4.5 kWh, which takes 4.5 ÷ 0.90 = 5.0 kWh from the panels (0.5 lost). The other 15.0 kWh is exported. The night's 4.0 kWh is supplied by the battery, which ends the day with 0.5 kWh and no grid purchase.

**Choosing the battery size.** The engine picks the size, from the product sizes in `battery.sizesKwh` = 5 and 10 kWh (`decision`). A battery is useful up to the smaller of two amounts: the surplus the system produces on a day, and the energy the home uses at night. "Night" here means the hours outside 06:00 to 18:00 of the same calendar day (00:00 to 06:00 and 18:00 to 24:00). Each amount is the median over the 365 days, taken separately, so the median surplus and the median night use may come from different days. The engine takes the product size whose usable capacity is closest to that amount. It offers no battery when that amount would fill less than `battery.minFillShare` = 0.5 (`decision`) of the smallest battery's usable capacity (0.5 × 4.5 = 2.25 kWh).

Examples, on the same one-day cases: the 1 kWp system's surplus is 0.4 kWh a day, below 2.25, so no battery is offered. A 20 kWp system has a surplus of 38.4 kWh but the home uses only 4.8 kWh outside the daytime; 4.8 is closer to the 5 kWh battery's 4.5 than to the 10 kWh battery's 9, so a 5 kWh battery is chosen. With a night load of 8 kWh the 10 kWh battery is chosen.

**Code:** `simulateWithBattery` and `chooseBatterySizeKwh` in `src/engine/energy/simulate.ts`.

### 2.7 Step 7: money

Step 7 has five parts. They run once per system, with and without a battery, and the project forward is run three times, at the low, typical and high installed cost.

#### 2.7.1 The bill before and after solar

**Formulas, month by month.**

```
charge before  = the larger of (load kWh × tariff) and the minimum charge before solar
charge after   = the larger of (grid import kWh × tariff) and the minimum charge after solar
bill           = charge ÷ (1 − overhead share)
monthly savings = bill before − bill after
```

- **The minimum charge** is PLN's lowest monthly bill: `minCharge.hours` = 40 (`sourced`, Regulation 7/2024 Annex II) hours at full connected power:
  `minimum = 40 × connected kVA × tariff`, where connected kVA is the connected VA ÷ 1,000. It is zero in the two subsidised classes. Postpaid subsidised homes pay a fixed charge instead; the engine does not model it (see 4.2).
- **The minimum applies after solar to everyone in the classes that have one, prepaid homes included.** Regulation 2/2024 Article 16 moves a prepaid customer to a monthly bill when rooftop solar is approved. Before solar, a prepaid customer has no minimum (this is a reading of the table layout in Annex II, not a sentence of the regulation; it is recorded as a caveat in `docs/ASSUMPTIONS.md`). A prepaid home that spends less than the minimum today can therefore end up paying more, and the engine reports negative savings.
- **Tax is added back.** Step 1 took the overhead share out of the spend to find the energy used. Tax is a percentage of the charge, so it falls when the charge falls. Dividing by (1 − share) puts it back in both bills, so the "before" bill equals what the household pays today.
- Exported power earns nothing, so it is not in the savings at all.

**Worked examples.**

*Minimum charges* (40 × connected kVA × tariff): 900 VA non-subsidised, 40 × 0.9 × 1,352 = Rp48,672. 1,300 VA, 40 × 1.3 × 1,444.70 = Rp75,124.40. 2,200 VA, 40 × 2.2 × 1,444.70 = Rp127,133.60. 4,400 VA (class `R2_3500_5500`), 40 × 4.4 × 1,699.53 = Rp299,117.28. The 4,400 VA case shows why the engine needs the connected power itself, not just the class name.

*Ordinary month.* A 2,200 VA postpaid home uses 400 kWh and still buys 300 kWh after solar.

```
before:  400 × 1,444.70 = 577,880     ÷ 0.95 = Rp608,294.74
after:   300 × 1,444.70 = 433,410     ÷ 0.95 = Rp456,221.05
saving:  Rp152,073.68
```

*A month where the minimum charge catches the saving.* The same home buys only 5 kWh. 5 × 1,444.70 = 7,223.50 is below the minimum of 127,133.60, so the after-bill is 127,133.60 ÷ 0.95 = Rp133,824.84, and the saving is 608,294.74 − 133,824.84 = Rp474,469.89, not the whole bill.

*A prepaid home that loses money.* 1,300 VA, Rp50,000 a month, so 50,000 × 0.95 ÷ 1,444.70 = 32.88 kWh. Solar leaves it buying 20 kWh. Before solar there is no minimum, so the bill is Rp50,000. After solar it is on a monthly bill: 20 × 1,444.70 = 28,894 is below the minimum 75,124.40, so it pays 75,124.40 ÷ 0.95 = Rp79,078.32. The saving is 50,000 − 79,078.32 = **−Rp29,078.32**. A postpaid home with the same use pays the minimum before solar too (Rp79,078.32), so it saves exactly nothing.

**Code:** `minimumChargeRp` and `compareBills` in `src/engine/money/bills.ts`.

#### 2.7.2 Upfront cost

```
solar cost   = system kWp × cost per kWp          at the low, typical and high cost
battery cost = battery fixed cost + battery kWh × cost per kWh
upfront cost = solar cost + battery cost
```

| Entry | Value | Label |
| --- | --- | --- |
| `capex.perKwp.low` | Rp11,000,000 | `thin` |
| `capex.perKwp.typical` | Rp16,000,000 | `thin` |
| `capex.perKwp.high` | Rp20,000,000 | `thin` |
| `battery.fixedCost` | Rp14,350,000 | `thin` |
| `battery.costPerKwh` | Rp3,600,000 | `thin` |

All five are `thin`: the per-kWp prices come from published price lists of about five installers (not quotes), and the battery cost is calculated from component prices, because no installed price for a hybrid inverter with a battery was found. The fixed part of the battery cost is the hybrid inverter a battery needs, less the ordinary inverter it replaces. Installation labour for the battery is not included. Treat the cost range as an estimate to be replaced by a real quote.

**Worked example.** A 4-panel system, 2.2 kWp: low 2.2 × 11,000,000 = Rp24,200,000; typical 35,200,000; high 44,000,000. A 5 kWh battery adds 14,350,000 + 5 × 3,600,000 = Rp32,350,000; a 10 kWh battery adds 14,350,000 + 10 × 3,600,000 = Rp50,350,000.

**Code:** `solarCostRange` and `batteryCostRp` in `src/engine/money/projection.ts`.

#### 2.7.3 The year-by-year projection

The engine follows the money over `finance.horizonYears` = 25 (`decision`). The first year's savings are the twelve months' savings added up. Each year, savings change and costs fall due:

```
cumulative(y)  =  cumulative(y − 1)
                  + first-year savings × (1 − degradation)^(y − 1) × (1 + tariff rise)^(y − 1)
                  − yearly upkeep
                  − inverter replacement   (only in the inverter's replacement year)
                  − battery replacement    (only in the battery's replacement year)
```

with year 0 starting at 0, and:

| Item | Rule | Entries |
| --- | --- | --- |
| Panel fading | output falls each year | `pv.degradationPerYear` = 0.005 (`decision`) |
| Tariff rise | tariffs rise each year | `finance.tariffEscalationPerYear` = 0 (`decision`; adjustable) |
| Upkeep | a share of the **solar** cost each year; a battery adds none (upkeep is cleaning and inspecting panels) | `opex.yearlyShareOfCapex` = 0.01 (`thin`) |
| Inverter replaced | once, a share of the solar cost | `inverter.replacementYear` = 12 (`decision`); `inverter.replacementShareOfCapex` = 0.15 (`thin`) |
| Battery replaced | once, the battery's **per-kWh cost only** | `battery.replacementYear` = 12 (`thin`) |

**In a battery system the inverter being replaced is the hybrid one**, so its replacement costs the ordinary inverter's share **plus the battery's fixed cost** (`battery.fixedCost`). The battery's own replacement is its cost per kWh only, because the fixed part is the inverter and is already counted. Both fall in year 12 under the current set.

There is no discounting: money in year 20 counts the same as money today. Scaling savings by the panels' fading output is a simplification: a little of the lost output would have been surplus anyway, so real savings fade slightly more slowly than the model says.

**Worked example 1: no running costs, so it can be checked in one line.** A system costing Rp10,000,000 saving Rp2,500,000 a year, with fading, tariff rise, upkeep and replacements set to zero. Cumulative savings are 2.5m, 5.0m, 7.5m, 10.0m, ... so the cost is repaid in year 4, and the net over 25 years is 25 × 2.5m − 10m = Rp52,500,000.

**Worked example 2: real rates.** The same Rp10,000,000 system, saving Rp2,000,000 in year 1, with the current assumption set (upkeep is 1% × 10,000,000 = 100,000 a year):

```
year 1:   2,000,000 − 100,000                              =  1,900,000
year 2:   1,900,000 + 2,000,000 × 0.995 − 100,000          =  3,790,000
```

| Year | 1 | 2 | 3 | 4 | 5 | 6 | 11 | 12 | 25 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Cumulative (Rp) | 1,900,000 | 3,790,000 | 5,670,050 | 7,540,200 | 9,400,499 | 11,250,996 | 20,358,168 | 20,650,877 | 43,111,903 |

Year 12 still rises: its savings (about 1,893,000) outweigh the 100,000 upkeep and the 1,500,000 inverter (15% of 10,000,000). The cost of 10,000,000 is first covered in year 6. Net savings are 43,111,903 − 10,000,000 = Rp33,111,903.

**Worked example 3: the same system with a 5 kWh battery.** Savings of Rp3,000,000 in year 1. Upfront: 10,000,000 + 32,350,000 = Rp42,350,000. In year 12 the home pays the ordinary inverter share 1,500,000 **plus** the hybrid inverter's fixed cost 14,350,000 **plus** new battery cells 5 × 3,600,000 = 18,000,000, together Rp33,850,000. The cumulative total falls from 31,087,252 in year 11 to −23,684 in year 12. It reaches only 34,317,854 at year 25, short of the upfront cost, so this system never pays back and its net savings are −Rp8,032,146. The same panels without a battery, saving the same Rp3,000,000, repay in year 4 and net Rp56,667,854.

**Code:** `projectMoney` in `src/engine/money/projection.ts`.

#### 2.7.4 Payback

```
payback  =  the first year from which cumulative savings stay at or above the upfront cost for every later year
```

"Stay" is the point. A replacement can undo an earlier crossing, and reporting the earlier year would tell the owner they are in the clear a year before a large bill. If the total never reaches the cost within 25 years, the payback is "does not pay back" (`null` in the code). Payback is run at the low, typical and high cost, which gives the range shown.

**Worked example.** A Rp10,000,000 system saving a flat Rp950,000 a year, with the 15% inverter (Rp1,500,000) due in year 12, no fading and no upkeep.

| Year | 11 | 12 | 13 |
| --- | --- | --- | --- |
| Cumulative (Rp) | 10,450,000 | 9,900,000 | 10,850,000 |

Year 11 is above the cost of 10,000,000, but year 12 drops back below it. The payback is **year 13**, not year 11. A smaller case: for running totals 0, 6, 12, 8, 13 and a cost of 10, the payback is year 4 (the dip to 8 in year 3 means year 2 does not count).

**Code:** `paybackYearOf` in `src/engine/money/projection.ts`.

#### 2.7.5 The headline money numbers

`assessMoney` (`src/engine/money/index.ts`) combines the parts into what the result page shows:

- **Monthly savings** = first-year savings ÷ 12.
- **Cost range** = the upfront cost at the low, typical and high price.
- **Payback range** = the payback year at the low and high cost (with the typical in between).
- **Net savings** = total savings − running costs − upfront cost, over the 25 years, at the typical cost. This is the cumulative total at year 25 minus the upfront cost.
- **Share of solar used on site** = self-consumed ÷ generated.
- **Cumulative savings at the low, typical and high cost** (engine version 1.1.0): the three year-by-year series, which the payback chart draws as a band. A result saved by engine 1.0.0 has the typical line only.

When a result cannot be saved, the route still returns it; the browser shows it from the session at `/r/unsaved` with a note that there is no share link and a button to retry (SPEC 2.5).

### 2.8 Step 8: the recommendation

**Rule.** The recommended size is the candidate with the highest net savings at the typical cost, without a battery. When two sizes tie, the smaller wins, since it costs less for the same result.

The reasoning is stated here because it is the heart of the product. "Shortest payback" would always pick the smallest system. "Cover the whole bill" is the oversizing mistake the product exists to prevent. Net savings over the horizon rewards adding a panel only while the extra saving is worth the extra cost.

The result also records whether the recommended system pays back within 25 years at the typical cost (`flags.doesNotPayBack`). When it does not, the app says so in words instead of showing a payback number. This is expected for subsidised classes, whose tariff is low.

**Worked example.** See the table in section 3: net savings fall from Rp24.5 million at 2 panels to Rp20.1 million at 3 and Rp11.3 million at 4, so the 2-panel system is recommended.

**Code:** `recommend` in `src/engine/assess.ts`.

### 2.9 Step 9: CO₂ avoided

```
CO₂ avoided per year  =  self-consumed solar energy × grid emission factor
```

`grid.emissionKgCo2PerKwh` = 0.87 kg per kWh (`thin`): the Java-Madura-Bali grid factor from Energy Ministry Decree 163.K/HK.02/MEM.S/2021, read second-hand (the decree's annex was not found online) and from 2019 data. It covers the Java-Bali grid only; other grids may differ. Exported surplus is left out, which keeps the claim conservative.

**Worked example.** A system that self-consumes 1,370.43 kWh a year avoids 1,370.43 × 0.87 = 1,192.27 kg of CO₂ a year (the 2-panel example house in section 3).

**Code:** inside `assessMoney`, `src/engine/money/index.ts`.

---

## 3. A whole house, start to finish

This is the example house behind `/id/r/example` and the landing page (`data/example-house.json`): a 2,200 VA postpaid home in Yogyakarta, spending Rp650,000 a month, someone home on weekdays, no daytime air conditioning, no electric vehicle, no home work. The roof is 48 m², gentle slope, facing north (toward the equator at that latitude), with no shade. The sunlight is the bundled Yogyakarta series (`data/sun-fallback/yogyakarta.json`), so the result is flagged as using fallback sun data. Numbers come from running `assess` with assumption set version 2.

### 3.1 What each step gave

| Step | Result |
| --- | --- |
| 1 Monthly energy | 427.42 kWh a month (Rp650,000 × 0.95 ÷ 1,444.70) |
| 2 Daytime share | 0.40 on weekdays and weekends |
| 3 Yearly yield | 1,352.84 kWh per kWp (1,395 on a flat roof; the gentle north roof's factor is 0.97) |
| 4 Candidates | 2 to 12 panels (1.10 to 6.60 kWp) |
| 7 Minimum charge after solar | Rp127,133.60 a month |

For the recommended system, the monthly bill before solar is Rp650,000 in every month, and after solar it falls to between about Rp464,000 and Rp489,000, depending on the month's sunlight and the month's length.

### 3.2 Every size, without a battery

Cost, payback and net savings are "low / typical / high" where a range is shown; net savings are at the typical cost. "No" in the payback columns means it does not pay back within 25 years.

| Panels | kWp | Share of solar used on site | Typical upfront cost | Payback (low / typical / high cost) | Net savings over 25 years |
| --- | --- | --- | --- | --- | --- |
| **2 (recommended)** | 1.10 | 92.1% | Rp17.6 m | 7 / 10 / 15 years | **Rp24.5 m** |
| 3 | 1.65 | 71.3% | Rp26.4 m | 9 / 15 / 20 years | Rp20.1 m |
| 4 | 2.20 | 56.8% | Rp35.2 m | 13 / 20 / no | Rp11.3 m |
| 5 | 2.75 | 47.0% | Rp44.0 m | 16 / 25 / no | Rp1.1 m |
| 6 | 3.30 | 40.1% | Rp52.8 m | 19 / no / no | −Rp9.7 m |
| 12 (the roof's largest) | 6.60 | 21.4% | Rp105.6 m | no / no / no | −Rp79.5 m |

Read down the table: every extra panel costs Rp8.8 million (0.55 kWp × Rp16,000,000) and adds only a little saving, because the home's daytime use is mostly covered after the first two panels and more output is mostly exported. The recommended 2-panel system saves Rp173,672 a month in the first year (Rp2,084,058 a year ÷ 12), exports 117.70 kWh of its 1,488.12 kWh a year, costs Rp12.1 to 22.0 million, and avoids 1,192 kg of CO₂ a year.

**With a battery.** The engine offers a 5 kWh battery from 4 panels up and a 10 kWh battery from 6 panels up. At 4 panels the battery raises first-year savings (Rp359,247 a month against Rp214,289), but the upfront cost goes from Rp35.2 million to Rp67.6 million, payback becomes 25 years at the low cost and "does not pay back" at the typical and high costs, and net savings are −Rp12.4 million against +Rp11.3 million. For this home, the battery does not pay for itself on savings alone. Backup power during outages is mentioned in the app as a benefit and given no rupiah value.

### 3.3 Two edge cases

**A home where solar does not pay back.** A prepaid 900 VA subsidised home spending Rp150,000 a month uses 150,000 × 0.95 ÷ 605 = 235.54 kWh a month at a tariff of Rp605. The same roof there returns no payback within 25 years at any cost for even the smallest system, and the typical-cost net savings of the best size (the smallest) are −Rp10,910,588. The engine flags `doesNotPayBack`, and the result page states it in words.

**A roof too small.** The same house with a 4 m² roof returns no candidates and `roofTooSmall` with `requiredAreaM2` = 8.

---

## 4. How far to trust it

### 4.1 Validation against PVGIS

PVGIS is the European Commission's photovoltaic model. For Indonesia its only database is ERA5, a weather-model reanalysis. The engine's own yearly output per kWp, on a flat unshaded roof, was compared with PVGIS's at three cities, using the same sun series the engine reads and assumption set version 2:

| City | Engine, scaled sun (kWh/kWp/year) | PVGIS | Difference |
| --- | --- | --- | --- |
| Medan | 1,283 | 1,340 | −4.3% |
| Yogyakarta | 1,395 | 1,446 | −3.6% |
| Makassar | 1,456 | 1,314 | **+10.8%** |

**The margin is about 11%.** At Medan and Yogyakarta the engine is a little below PVGIS; **at Makassar it is 10.8% above, which is the optimistic side.** Nearly all of that gap is the sunlight data, not the engine's loss model: over the same years NASA POWER gives Makassar 10.2% more sunlight than ERA5 does, and the loss model accounts for 1.0% more. Neither database is a ground measurement, so this check cannot say which one is right. No assumption was changed to hide it: a lower performance ratio fitted to Makassar would push the other two cities further below PVGIS and bury a data-source disagreement inside a loss figure.

For a tilted roof, add the orientation factors' own uncertainty: they are an average of two sites (Medan and Yogyakarta), which differ from each other by up to 0.11 at a 45° tilt.

The full method, every table and the traced cause of each gap are in `docs/VALIDATION.md`. It reruns offline, with no `npm install` needed, from a clean checkout:

```
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/validate-pvgis.mjs
```

### 4.2 Known limits, stated plainly

- **The load shape is estimated.** The hour-by-hour use of the home comes from four yes/no questions, a base share and two fixed daily shapes, all of them `judgment`. No measured Indonesian household profile was found. This drives how much solar the home can use directly, and so how many panels are worth buying, more than any other input.
- **One roof face.** The user traces on the map or types the area (one value) of the best side; roofs with several faces are a later stage.
- **The roof area is the footprint.** The traced or typed area is the roof as seen from above, with no correction for slope. A sloped face is larger than its footprint (about 10% at 25°, 41% at 45°), so a sloped roof's area is under-counted, which can only cap the largest size too low and never inflates a saving (SPEC 2.2, step 2).
- **Three slope choices stand for ranges of angle.** Flat is under about 10°, gentle about 10° to 35° (calculated at 25°), steep above about 35° (calculated at 45°). A steep roof calculated at 35° instead of 45° would have factors 0.06 to 0.10 higher. The 25° and 45° come from the design mock-up `mock/atap.html` (as `docs/VALIDATION.md` says), not from a regulation or a standard.
- **East and west share one factor**, the mean of the two. In PVGIS's runs an east roof yields 4% to 9% more than a west one, so the engine overstates a west roof and understates an east one by 2% to 5%.
- **The orientation table is a two-site average** (Medan and Yogyakarta). A home at Kupang (10° S) or Manado (1.5° N) sits further from it.
- **One year's pattern of sun, scaled to a twenty-year mean.** The hourly series is the latest full year's real pattern of cloud, multiplied by one factor so its total equals NASA POWER's twenty-year mean. That year's dull or bright months stay dull or bright. Its source, NASA POWER, differs from PVGIS-ERA5 by −4.6% to +10.2% on the long-term sunlight (the +10.2% at Makassar), and which is right is not known.
- **Cost evidence is thin.** Per-kWp prices come from about five installers' published ranges, not quotes. Battery prices are calculated from component prices. Maintenance (1% a year) rests on one academic study. Inverter and battery replacement years and shares are estimates. All are labelled `thin`.
- **Subsidised classes on a monthly bill.** PLN charges postpaid subsidised homes (450 VA and 900 VA) three blocks plus a fixed charge; the engine uses one tariff and no fixed charge, which approximates them.
- **The prepaid reading.** That a prepaid customer has no minimum charge before solar is read from the layout of a table in the regulation, not from a sentence. It affects only whether a prepaid home that spends below the minimum is shown a negative saving.
- **Panel fading is applied to savings**, a slight simplification explained in 2.7.3, and there is no discounting.
- **Yearly totals only.** The comparison with PVGIS is of yearly totals. No hour-by-hour comparison was made, and the engine applies the orientation factor as one multiplier to every hour, so the daily shape on a tilted roof, and so the share used on site, is not checked.
- **The emission factor is for the Java-Bali grid**, from 2019 data, read second-hand.
- **Everything outside the engine's knowledge.** PLN's quota in the user's area, whether an application is approved, a site visit for a shaded or unusual roof, and local permit costs. The result page tells the user what happens next; the engine does not know.

## 5. Run it locally

**You need** Node.js 20.9 or newer (the steps below were run on Node 25.8) with npm, and git. No accounts and no keys are needed to run the app.

```
git clone <repository-url> suryapas
cd suryapas
npm ci
npm run dev
```

Then open `http://localhost:3000/id` (Bahasa Indonesia) or `http://localhost:3000/en` (English). `http://localhost:3000/id/r/example` is the prepared result for the example house, which works with no database and no network. Press Ctrl+C to stop the server.

`<repository-url>` is the address of this repository once it is public.

**Checks.**

| Command | What it does |
| --- | --- |
| `npm test` | Runs the unit tests (Vitest), including every engine test |
| `npx vitest run src/engine` | Runs only the engine's tests, the quickest way to see the hand-worked cases |
| `npm run check` | Lint, types and unit tests; the gate before any change |
| `npm run test:e2e` | Browser tests (Playwright); first run `npx playwright install chromium`; serves the app on port 3100 |

**Which features need a key.** None is needed to run. Copy `.env.example` to `.env.local` to add the optional ones:

| Variable | Feature it enables | Without it |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (and `SUPABASE_ANON_KEY`, which stage 1 does not read) | Saving results in a Supabase Postgres database, so share links survive a restart | Results are kept in memory and lost when the server restarts (a production build logs a warning) |
| `NEXT_PUBLIC_ESRI_API_KEY` | Esri satellite imagery under the roof-tracing map. Not live yet: no key exists | The map shows the street map instead; the user can trace on it or type the roof area |

Two further services are used with no key but need internet: NASA POWER for live sunlight (without it the app uses the bundled series and labels the result "approximate") and the Photon geocoder for address search.

## 6. How the repository is laid out

```
src/engine/            the calculation engine and its tests (section 2); imports nothing outside itself
  assess.ts            the front door: assess() and the recommendation
  energy/              steps 1 to 6: monthly use, hourly load, solar, sizes, simulation
  money/               step 7 and 9: bills, projection, payback, CO₂
  assumptions/         the versioned assumption sets (v1 as released, v2 current)
src/app/[locale]/      the pages: landing, plan (the four-step input flow), result, assumptions
src/app/api/           server routes: sun, geocode, assessments, events
src/features/<name>/   one folder per screen or step
src/components/        shared interface pieces
src/lib/               sun data (NASA POWER, scaling, fallback), store, geocoding, schemas, events
src/i18n/, messages/   Bahasa Indonesia and English text, one JSON file per area
data/                  example house, bundled sun series for twelve cities, the Indonesia outline
supabase/migrations/   the database tables (the stage 2 and 3 tables exist but are unused)
scripts/               data generation and the PVGIS validation
tests/e2e/             browser tests
docs/                  the specification and records; below
mock/                  the static design reference
```

**Where to read more.**

| File | Holds |
| --- | --- |
| `docs/SPEC.md` | What the product does: flow, engine rules, data model, architecture |
| `docs/ASSUMPTIONS.md` | Every price, rate and factor, with source, date and confidence |
| `docs/VALIDATION.md` | The PVGIS comparison in full |
| `docs/DESIGN.md` | Colour, type, spacing and copy voice |

**What exists today.** Stage 1, the calculator, is the only stage being built. Accounts, PDF export and an installer marketplace exist as database tables and placeholder routes only. At the time of writing the engine, the sun-data service and the PVGIS validation are finished and tested; the roof step is built (against the street map, since the Esri key does not exist yet) and in its last fixes; other screens are still being completed.
