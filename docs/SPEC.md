# SuryaPas: product specification

Stage 1. Agreed with the owner on 2026-11-14. Changes are made by the maintainer.

## 1. Product

**What it is.** A web app that tells an Indonesian homeowner how much rooftop solar fits their home, what it costs and when it pays back, with and without a battery.

**The idea behind the name.** "Surya" is sun; "pas" is "just right". Since Energy Ministry Regulation 2/2024, power sent back to the grid earns no credit. The right system is therefore the one sized to what the home uses while the sun is up, and a system sized to the whole bill is oversized. The product exists to get that sizing right and to show why.

**Pitch line.** "Panel surya yang pas untuk rumah Anda."

**Purpose.** A portfolio and competition project first, built so it could grow into a business. Every feature must work in a demo with no real installers signed up.

**User.** A homeowner on a residential PLN tariff, on a phone. Small businesses come later.

### 1.1 In stage 1

Landing page, a four-step input flow, a result page with a shareable link, an assumptions page, and the database and route structure for later stages.

### 1.2 Later stages (structure only in stage 1)

Accounts and saved reports, PDF export, bill upload, installer profiles, quote requests, admin dashboard, multiple roof faces, small-business tariffs, hardware monitoring. Section 4.3 lists what stage 1 reserves for them.

### 1.3 Constraints

- Free tiers only: no paid map, data or hosting.
- Bahasa Indonesia by default, English by toggle, both complete.
- Phone-first. Desktop is a roomier layout of the same flow.
- A visitor reaches a result with no login.

## 2. User flow

Routes carry the locale: `/id/...` and `/en/...`. `/` redirects to `/id`.

### 2.1 Landing (`/[locale]`)

The hero is the first input of the tool: the headline and an address field with a "Hitung" button. Submitting carries the typed address into step 1 through the browser's session storage, never the URL (an address in a URL is kept in server logs and browser history), where it is searched and its results are listed for the user to pick. A pin is never set from a match the user has not seen. A link, "see an example", opens a prepared result for a house in Yogyakarta so a judge reaches the result in one tap.

Below the hero, the page makes its argument with evidence: a short statement that exported power is no longer paid for, then the example house shown twice, once with the recommended panel count and once with far too many, each with its one-day chart, share of solar wasted, upfront cost and payback. These figures are computed by the engine from the example house, never typed in.

### 2.2 Input flow (`/[locale]/plan`)

Four steps, one topic per screen, with a progress indicator and back navigation. Inputs persist in the browser, so a refresh or a return visit resumes where the user left off.

**Step 1: location.** Three ways to set one pin: search an address, tap "use my location", or drag the pin on the map. The pin must fall inside Indonesia; outside it, the step blocks with a clear message. The check is against a bundled country outline that includes the small inhabited islands, and a pin within 2 km of the outline counts as inside, because a simplified coastline cuts off harbours and houses built over the water. The server applies the same check.

**Step 2: roof.**
- Area: trace the roof outline on satellite imagery, or type the area in m². Typing is the full keyboard-accessible path. One roof face only; the user traces the best side.
- Facing direction: north, east, south or west (hidden when the slope is flat).
- Slope: flat, gentle or steep, chosen from pictures.
- Shade: none, some in the morning or afternoon, or heavy, chosen from pictures.
- Usable fraction: the share of the traced area that can hold panels, defaulted from the assumption set and adjustable.
- Limits on the area: below 5 m² or above 500 m² the step asks the user to check, without blocking. Above 2,000 m² the area is refused, by the step and by the server: that is not a house roof, and the engine would be asked for hundreds of sizes.

**Step 3: electricity.**
- Prepaid tokens or monthly bill. The wording of the next fields adapts ("how much do you top up a month" or "your monthly bill").
- PLN power class, including the two subsidised classes.
- Monthly spend in rupiah: one month required, up to twelve accepted. With fewer than twelve, a note says more months sharpen the estimate, and the fields are numbered, since the engine averages them and their order does not matter. With all twelve, the fields carry the month names January to December, because the engine reads twelve values in that order.
- A monthly spend is rejected when it is more than the connection could use in a month: connected kVA × 24 hours × 31 days × the class tariff, with the bill-overhead share added back. The tariff and the share come from the assumption set. This catches an extra zero, which would otherwise size a system several times too large.
- Power values offered above 7,700 VA: 10,600, 11,000, 13,200 and 16,500 VA.

**Step 4: lifestyle.** Four yes/no questions: is someone home on weekdays; is air conditioning on during the day; does someone work from home; is there an electric vehicle charged at home.

Submitting step 4 computes the result, saves it and redirects to the result page.

### 2.3 Result (`/[locale]/r/[id]`)

In reading order:

1. **Three headline numbers**: recommended size (kWp and panel count), upfront cost as a range, payback as a range in years.
2. **Panel picker**: a row of panels, from one up to the largest count that fits the roof (at most twelve shown). When more than twelve fit, the twelve shown are consecutive counts placed so that the recommended count and at least one larger count are in view. Tapping a panel selects that count; every number and both charts update. The recommended count is marked "pas". Counts below the smallest system cannot be selected. Exploration is local and is not saved.
3. **Typical-day chart**: the home's average hourly usage against average hourly solar output for the selected size, with the overlap (solar used on site) shaded and the surplus visibly distinct.
4. **Supporting numbers**: monthly savings, share of solar used on site, net savings over the analysis horizon, CO₂ avoided.
5. **Cost-versus-savings chart**: cumulative savings against upfront cost over the horizon. Cost is a band from the low to the high installed cost. Savings are a narrow band too, because upkeep and the inverter replacement grow with the cost: its upper edge is the low-cost case and its lower edge the high-cost case. The two bands overlap from the low-cost payback year to the high-cost payback year, and the marked column covers exactly those years, so the picture and the headline range always agree.
6. **Battery comparison**: the same headline numbers side by side, without and with a battery. Savings only; backup during blackouts is mentioned as a benefit and given no rupiah value.
7. **What happens next**: the PLN application steps from the last section of `docs/ASSUMPTIONS.md`, shortened to what a homeowner acts on: applications open in January and July; approval depends on quota in the user's PLN area, whose status the app does not know; installation is done by a licensed business after approval. A prepaid user is also told they will be moved to a monthly bill.
8. **Get installer quotes**: a "coming soon" button. A tap records one anonymous event and shows a short acknowledgement. No contact details are collected.
9. Links: view assumptions, edit inputs (returns to the flow with inputs intact), copy share link.

Anyone with the link sees the same saved result, read-only, with a "plan your own" button.

**Honest verdicts.** A verdict comes before the figures it qualifies: the reader meets the warning first, then the number.

- Payback is judged at the typical cost. When the selected system does not pay back at the typical cost within the horizon, the page says so in words ("at your tariff, solar is unlikely to pay for itself") in place of a payback number, and no payback year appears in the headline, even if the lowest cost would pay back. The text below may add that only at the lowest installer price would it pay back, and in which year. This is expected for subsidised classes.
- When it pays back at the typical cost but not at the high cost, the headline gives the low-cost year "or more", and a sentence says that at the highest installer price it does not pay back within the horizon.
- When the recommended size itself has negative net savings, every size loses money. The page says so, and describes the recommended size as the one that loses least, never as the largest saving.
- A negative monthly saving is stated in words as a bill that goes up, with the amount, not as a negative figure under a "savings" label. When shade is heavy, the page warns that an installer site visit is needed before trusting the estimate.

### 2.4 Assumptions (`/[locale]/assumptions`)

Lists every entry of the assumption set in use: value, unit, source, date and confidence label. Entries marked adjustable can be changed by the user; changes persist with the inputs, travel with the saved result, and are shown as "changed by you".

### 2.5 Failure behaviour

| Case | Behaviour |
| --- | --- |
| Pin outside Indonesia | Step 1 blocks with a message |
| Roof too small for the smallest system | Result page explains, and states the roof area the smallest system needs |
| Sun-data service slow or down | Use the bundled figures for the nearest major city; label the result "approximate" |
| Saving fails | The route still computes the result and returns it in its response, marked as not saved. The browser keeps it for the session and shows it with a note that the share link is unavailable, and offers to retry the save. A store that cannot be read (for the sun cache or the assumption set) is treated the same way: compute, do not save. This matters in practice: a free database project pauses when idle |

### 2.6 Privacy

A saved result stores the pin location, roof, electricity and lifestyle inputs under a random, unguessable id. No name, email or account. The flow shows a one-line notice saying exactly this before submission.

## 3. Calculation engine

Lives in `src/engine/`, pure TypeScript. Every numeric value named below is an entry in the assumption set (`docs/ASSUMPTIONS.md`); this section defines the rules only.

### 3.1 Inputs

```
location        latitude, longitude
roof            areaM2, usableFraction, facing (N|E|S|W|none), slope (flat|gentle|steep), shade (none|some|heavy)
electricity     billing (prepaid|postpaid), connectedVa, subsidised, monthlySpendRp[1..12]
lifestyle       homeOnWeekdays, daytimeAc, workFromHome, electricVehicle
sunSeries       8,760 hourly values of global horizontal irradiance (W/m²), local time, plus a flag: live or fallback
assumptions     one versioned assumption set, with any user overrides applied
```

The tariff class is derived from `connectedVa` and `subsidised`; the minimum charge needs the connected power itself, which a class name alone does not give for the 3,500 VA and larger classes. The form offers PLN's standard connected powers. Twelve spend values are read as January to December; fewer are averaged and applied to every month.

### 3.2 Pipeline

1. **Monthly energy use.** kWh for each month = spend ÷ tariff of the power class, after removing the bill-overhead share. Months not entered take the mean of those entered. Known limit: subsidised 450 VA and 900 VA homes on a monthly bill pay a three-block tariff plus a fixed charge, which this single-tariff conversion approximates; stage 1 accepts that, since those homes get the "unlikely to pay back" verdict either way.
2. **Hourly load.** Lifestyle answers set the daytime share (the fraction of a day's energy used between 06:00 and 18:00): a base share plus an increment per "yes", kept between a floor and a cap. Weekends use the someone-home shape; the engine's year is a generic one that starts on a Monday, so which days are weekends does not depend on the calendar year of the sun data. Hourly weights within day and night follow fixed shapes defined in the engine and documented in the README. Result: 8,760 hourly kWh values that sum to each month's energy.
3. **Solar output per kWp.** For each hour: irradiance ÷ 1000 × performance ratio × orientation factor (by slope, and by facing relative to the equator, which depends on the sign of the latitude) × shade factor. The slope choices stand for ranges: flat is under about 10° and has no orientation factor; gentle is about 10° to 35° and is calculated at 25°; steep is above about 35° and is calculated at 45°. East and west share one factor, the mean of the two. Result: 8,760 hourly kWh per installed kWp.
4. **Candidate sizes.** Panel count from the minimum system up to the number that fits: usable area ÷ panel area. No regulatory size cap applies; local PLN quota is the only limit and is outside the engine.
5. **Hourly simulation, per candidate.** For each hour: self-consumed = min(solar, load); surplus = solar − self-consumed; grid import = load − self-consumed. Surplus has zero value.
6. **Battery variant.** Surplus charges the battery up to its usable capacity; stored energy discharges to meet load before grid import; round-trip efficiency applies. Battery size is chosen by the engine: enough for the typical (median) day's surplus or the typical night's use, whichever is smaller, since stored energy that no one uses at night is wasted; then rounded to the product sizes in the assumption set. No battery is offered when that smaller figure (the typical day's surplus or night's use) is below the smallest size's threshold (`battery.minFillShare` of its usable capacity).
7. **Money.**
   - Monthly savings = bill before solar − bill after solar. The bill after solar never falls below PLN's minimum charge in the classes that have one. This applies to prepaid customers too: Regulation 2/2024 Article 16 moves a prepaid customer to a monthly bill when rooftop solar is approved, so after installation everyone in those classes has the minimum charge. Before solar, a prepaid customer has none. A prepaid home that spends less than the minimum charge today can therefore end up paying more, and the engine reports that as negative savings.
   - The tax share removed in step 1 is added back to both bills, since tax is a percentage of the charge and falls with it. "Before" therefore equals what the household pays today.
   - Year by year over the horizon: panel output falls by the degradation rate; the tariff rises by the escalation rate; maintenance is charged yearly as a share of the cost of the panels and inverter (a battery adds none, since upkeep is cleaning and inspection of the panels); the inverter is replaced once at its replacement year; a battery, if present, is replaced at its replacement year. In a battery system the inverter being replaced is the hybrid one, so that replacement costs the ordinary inverter's share plus the battery's fixed cost. The battery's own replacement is its cost per kWh only, because the fixed part is the inverter.
   - Upfront cost = size × cost per kWp, at the low, typical and high cost. A battery adds a fixed cost (the hybrid inverter it requires, less the ordinary inverter it replaces) plus a cost per kWh.
   - Payback = the first year from which cumulative net savings stay at or above the upfront cost for the rest of the horizon, reported as a range from the low and high cost. A system that reaches its cost just before a replacement and then falls back below it has not paid back yet; reporting the earlier year would tell the owner they are in the clear a year before a large bill. No discounting.
   - Net savings = total savings − upfront cost − running costs, over the horizon.
8. **Recommendation.** The candidate with the highest net savings at the typical cost, among the systems without a battery; when two tie, the smaller. The recommendation is about size. The battery is shown beside it as a comparison and never becomes the headline. Reason: "shortest payback" always favours the smallest system, and "cover the whole bill" is the oversizing error the product exists to prevent.
9. **CO₂ avoided** = self-consumed solar energy × grid emission factor. Exported surplus is left out, which keeps the claim conservative.

### 3.3 Outputs

For every candidate size, with and without battery: size, panel count, yearly generation, self-consumed energy and share, monthly savings, cost range, payback range or "does not pay back", net savings, CO₂ avoided, the 24-hour average load and solar curves, and the cumulative savings series at the low, typical and high cost (they differ because running costs follow the cost). Plus: the recommended candidate, the chosen battery size, the daytime share used, and flags (sun data fallback, heavy shade, roof too small with required area).

### 3.4 Sun data

- Source: NASA POWER hourly API (`/api/temporal/hourly/point`), fetched by the server and never by the browser. The year used is the most recent calendar year that ended at least six months ago: NASA's solar data runs about four months behind the calendar, so a year is not available in full until well into the next one. Requested in POWER's "LST", which is the time zone of the nearest 15° of longitude: clock time across almost all of Indonesia, and within half an hour of solar time everywhere. The home's use is described in clock time, so the two line up.
- Long-term scaling. One year is not the long-term sun (at Medan, Yogyakarta and Makassar, 2025 was 1.7% to 6.9% below NASA's own long-term mean), and a payback over 25 years depends on the long-term sun. The server therefore also reads NASA POWER's monthly record of the same quantity (`/api/temporal/monthly/point`) for the twenty complete years ending with the hourly year, and multiplies every hour by one factor: the mean yearly irradiation of those years ÷ the hourly year's irradiation. Every year counts as 365 days with a 28-day February, the same days as the 8,760-hour series. A year with a missing month is left out of the mean; with fewer than ten usable years the request counts as failed. One factor for the whole year keeps that year's real hour-by-hour pattern of cloud. Scaling month by month was not chosen: a very dull month would be stretched past what a clear sky delivers.
- Both requests share one time limit. If either fails, the fallback is used. The bundled series are scaled the same way by the script that builds them.
- Cached per 0.5° grid cell, so nearby users share one fetch.
- Fallback: a bundled file of hourly series for major Indonesian cities, generated by a committed script from the same source. Used when the fetch fails or exceeds its time limit.
- The engine receives the series as an argument and knows only whether it is live or fallback.

### 3.5 Verification

- Unit tests for every pipeline step, including hand-worked cases small enough to check on paper (for example, a 24-hour day with a square solar pulse and a flat load).
- Yearly output per kWp for two or three Indonesian cities compared against PVGIS, with the margin recorded in the README.
- Orientation factors derived from PVGIS runs, replacing the provisional values.

## 4. Data

Postgres on Supabase. All access goes through server code; row-level security is on for every table with no public policies. Persistence sits behind a store interface with an in-memory implementation, so development and tests run with no Supabase account.

### 4.1 Tables used in stage 1

| Table | One row is | Key columns |
| --- | --- | --- |
| `assessments` | One saved result | `id` (random, unguessable, used in the URL), `created_at`, `locale`, `inputs` (json: location, roof, electricity, lifestyle), `overrides` (json: user-changed assumptions), `assumption_set_version`, `engine_version`, `sun_source` (live or fallback), `result` (json: engine output), `owner_id` (null until stage 2) |
| `assumption_sets` | One version of the assumptions | `version`, `created_at`, `entries` (json), `note` |
| `sun_cache` | One grid cell's hourly series | `cell_id`, `year`, `fetched_at`, `series` |
| `events` | One anonymous count | `id`, `created_at`, `name`, `assessment_id` (nullable) |

### 4.2 Reproducibility

Assumption sets are defined in code, one file per version, and copied into `assumption_sets` when deployed. An assessment records the version it used, its overrides, and the full result as shown. An old link shows what it showed on the day, whatever prices have changed since. Changing any assumption value means a new version, never an edit to an existing one.

### 4.3 Tables reserved for later stages (created, unused)

| Table | For | Key columns |
| --- | --- | --- |
| `profiles` | Users and roles | `id`, `role` (homeowner, installer, admin), `display_name` |
| `installers` | Installer listings | `id`, `profile_id`, `company_name`, `service_areas`, `verified` |
| `quote_requests` | A homeowner asking an installer for a quote | `id`, `assessment_id`, `installer_id`, `status`, `created_at` |

Placeholder routes `/[locale]/account`, `/[locale]/installers` and `/[locale]/admin` render a "coming soon" page.

## 5. Architecture

| Concern | Choice |
| --- | --- |
| App | Next.js (App Router), TypeScript in strict mode |
| Styling | Tailwind, themed from `docs/DESIGN.md` tokens |
| Languages | next-intl; locales `id` (default) and `en`; messages split by namespace |
| Engine | `src/engine/`, pure TypeScript, no imports from outside the folder |
| Validation | Zod schemas in `src/lib/schema/` mirroring the engine's input types, shared by forms and server. The engine itself has no dependencies |
| Map | MapLibre GL; free OpenStreetMap-based street tiles; Esri satellite imagery through a free developer key; polygon tracing; area by Turf |
| Address search | A free OpenStreetMap-based geocoder that permits search-as-you-type, called through a server route, limited to Indonesia |
| Charts | Plain SVG with a small linear scale of our own; no chart library |
| Database | Supabase Postgres; SQL migrations in `supabase/migrations/` |
| Unit tests | Vitest |
| Flow and accessibility tests | Playwright with axe |
| Hosting | Vercel free tier; GitHub repository, private until stage 1 is live |

The engine runs on the server, once, when a result is computed and saved. The saved result holds every candidate size (SPEC 3.3), so when the user picks another panel count the page shows that stored candidate. Nothing is recomputed in the browser, which also means a link always shows the figures it showed on the day it was made (SPEC 4.2). The engine stays free of I/O so that it could run in a browser; the assumptions screen and the tests rely on that.

### 5.1 Server routes

| Route | Request | Response |
| --- | --- | --- |
| `GET /api/sun?lat&lon` | A point in Indonesia | `{ series: number[8760], source: "live" \| "fallback", cellId, year }` |
| `POST /api/geocode` | Search text in the request body, so it is not kept in request logs | Up to five places in Indonesia: `{ label, lat, lon }[]` |
| `POST /api/assessments` | `{ inputs, overrides, locale }` | `{ id }` after validating, fetching sun data, running the engine and saving |
| `POST /api/events` | `{ name, assessmentId? }` | `204` |

The assessment id `example` is reserved. It is computed on request from `data/example-house.json` and the bundled Yogyakarta sun series, and is never stored, so the example works with no database and no network.

### 5.2 Input flow contract

The flow shell owns one state object shaped like the engine inputs plus `overrides`. Each step is a component receiving `{ value, onChange, onValidChange }` for its own slice. A step reports validity; the shell controls navigation and persistence.

### 5.3 Layout

```
src/app/[locale]/        routes
src/engine/              calculation engine and its tests
src/features/<name>/     one folder per screen or step
src/components/          shared interface components
src/lib/                 sun data, store, geocoding, analytics events
messages/<locale>/       one JSON file per namespace
supabase/migrations/     SQL
scripts/                 data generation and validation scripts
tests/e2e/               Playwright
docs/                    this documentation
```

## 6. Definition of finished

Stage 1 is done when all of these hold:

1. The engine has unit tests, including hand-worked cases, and they pass.
2. Yearly output for two or three cities is cross-checked against PVGIS, with the margin stated in the README.
3. An automated test runs the whole flow from landing to result.
4. The app passes automated WCAG 2.1 AA checks on every screen and the whole flow is usable by keyboard through the typed-area path.
5. Every screen is complete in both languages.
6. The app is live on Vercel.
7. The README explains the engine's method well enough that the owner can explain every formula.
