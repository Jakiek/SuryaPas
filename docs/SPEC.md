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

The hero is the first input of the tool: the headline and an address field with a "Hitung" button. Submitting carries the typed address into step 1, where it is searched and the pin is set. A link, "see an example", opens a prepared result for a house in Yogyakarta so a judge reaches the result in one tap.

Below the hero, the page makes its argument with evidence: a short statement that exported power is no longer paid for, then the example house shown twice, once with the recommended panel count and once with far too many, each with its one-day chart, share of solar wasted, upfront cost and payback. These figures are computed by the engine from the example house, never typed in.

### 2.2 Input flow (`/[locale]/plan`)

Four steps, one topic per screen, with a progress indicator and back navigation. Inputs persist in the browser, so a refresh or a return visit resumes where the user left off.

**Step 1: location.** Three ways to set one pin: search an address, tap "use my location", or drag the pin on the map. The pin must fall inside Indonesia (checked against a bundled simplified country outline); outside it, the step blocks with a clear message.

**Step 2: roof.**
- Area: trace the roof outline on satellite imagery, or type the area in m². Typing is the full keyboard-accessible path. One roof face only; the user traces the best side.
- Facing direction: north, east, south or west (hidden when the slope is flat).
- Slope: flat, gentle or steep, chosen from pictures.
- Shade: none, some in the morning or afternoon, or heavy, chosen from pictures.
- Usable fraction: the share of the traced area that can hold panels, defaulted from the assumption set and adjustable.

**Step 3: electricity.**
- Prepaid tokens or monthly bill. The wording of the next fields adapts ("how much do you top up a month" or "your monthly bill").
- PLN power class, including the two subsidised classes.
- Monthly spend in rupiah: one month required, up to twelve accepted. With fewer than twelve, a note says more months sharpen the estimate.

**Step 4: lifestyle.** Four yes/no questions: is someone home on weekdays; is air conditioning on during the day; does someone work from home; is there an electric vehicle charged at home.

Submitting step 4 computes the result, saves it and redirects to the result page.

### 2.3 Result (`/[locale]/r/[id]`)

In reading order:

1. **Three headline numbers**: recommended size (kWp and panel count), upfront cost as a range, payback as a range in years.
2. **Panel picker**: a row of panels, from one up to the largest count that fits the roof (at most twelve shown). Tapping a panel selects that count; every number and both charts update. The recommended count is marked "pas". Counts below the smallest system cannot be selected. Exploration is local and is not saved.
3. **Typical-day chart**: the home's average hourly usage against average hourly solar output for the selected size, with the overlap (solar used on site) shaded and the surplus visibly distinct.
4. **Supporting numbers**: monthly savings, share of solar used on site, net savings over the analysis horizon, CO₂ avoided.
5. **Cost-versus-savings chart**: cumulative savings against upfront cost over the horizon, crossing at the payback year, with a band for the low-to-high cost range.
6. **Battery comparison**: the same headline numbers side by side, without and with a battery. Savings only; backup during blackouts is mentioned as a benefit and given no rupiah value.
7. **What happens next**: the PLN application steps from the last section of `docs/ASSUMPTIONS.md`, shortened to what a homeowner acts on: applications open in January and July; approval depends on quota in the user's PLN area, whose status the app does not know; installation is done by a licensed business after approval. A prepaid user is also told they will be moved to a monthly bill.
8. **Get installer quotes**: a "coming soon" button. A tap records one anonymous event and shows a short acknowledgement. No contact details are collected.
9. Links: view assumptions, edit inputs (returns to the flow with inputs intact), copy share link.

Anyone with the link sees the same saved result, read-only, with a "plan your own" button.

**Honest verdicts.** When the selected system does not pay back within the horizon, the page says so in words ("at your tariff, solar is unlikely to pay for itself") in place of a payback number. This is expected for subsidised classes. When shade is heavy, the page warns that an installer site visit is needed before trusting the estimate.

### 2.4 Assumptions (`/[locale]/assumptions`)

Lists every entry of the assumption set in use: value, unit, source, date and confidence label. Entries marked adjustable can be changed by the user; changes persist with the inputs, travel with the saved result, and are shown as "changed by you".

### 2.5 Failure behaviour

| Case | Behaviour |
| --- | --- |
| Pin outside Indonesia | Step 1 blocks with a message |
| Roof too small for the smallest system | Result page explains, and states the roof area the smallest system needs |
| Sun-data service slow or down | Use the bundled figures for the nearest major city; label the result "approximate" |
| Saving fails | Show the result from local state with a note that the share link is unavailable; offer retry |

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
2. **Hourly load.** Lifestyle answers set the daytime share (the fraction of a day's energy used between 06:00 and 18:00): a base share plus an increment per "yes", up to a cap. Weekends use the someone-home shape. Hourly weights within day and night follow fixed shapes defined in the engine and documented in the README. Result: 8,760 hourly kWh values that sum to each month's energy.
3. **Solar output per kWp.** For each hour: irradiance ÷ 1000 × performance ratio × orientation factor (by slope, and by facing relative to the equator, which depends on the sign of the latitude) × shade factor. Result: 8,760 hourly kWh per installed kWp.
4. **Candidate sizes.** Panel count from the minimum system up to the number that fits: usable area ÷ panel area. No regulatory size cap applies; local PLN quota is the only limit and is outside the engine.
5. **Hourly simulation, per candidate.** For each hour: self-consumed = min(solar, load); surplus = solar − self-consumed; grid import = load − self-consumed. Surplus has zero value.
6. **Battery variant.** Surplus charges the battery up to its usable capacity; stored energy discharges to meet load before grid import; round-trip efficiency applies. Battery size is chosen by the engine: enough for the typical daily surplus, rounded to the product sizes in the assumption set. No battery is offered when typical surplus is below the smallest size's threshold.
7. **Money.**
   - Monthly savings = bill before solar − bill after solar. The bill after solar never falls below PLN's minimum charge in the classes that have one. This applies to prepaid customers too: Regulation 2/2024 Article 16 moves a prepaid customer to a monthly bill when rooftop solar is approved, so after installation everyone in those classes has the minimum charge. Before solar, a prepaid customer has none. A prepaid home that spends less than the minimum charge today can therefore end up paying more, and the engine reports that as negative savings.
   - The tax share removed in step 1 is added back to both bills, since tax is a percentage of the charge and falls with it. "Before" therefore equals what the household pays today.
   - Year by year over the horizon: panel output falls by the degradation rate; the tariff rises by the escalation rate; maintenance is charged yearly as a share of the cost of the panels and inverter (a battery adds none, since upkeep is cleaning and inspection of the panels); the inverter is replaced once at its replacement year; a battery, if present, is replaced at its replacement year. In a battery system the inverter being replaced is the hybrid one, so that replacement costs the ordinary inverter's share plus the battery's fixed cost. The battery's own replacement is its cost per kWh only, because the fixed part is the inverter.
   - Upfront cost = size × cost per kWp, at the low, typical and high cost. A battery adds a fixed cost (the hybrid inverter it requires, less the ordinary inverter it replaces) plus a cost per kWh.
   - Payback = the first year from which cumulative net savings stay at or above the upfront cost for the rest of the horizon, reported as a range from the low and high cost. A system that reaches its cost just before a replacement and then falls back below it has not paid back yet; reporting the earlier year would tell the owner they are in the clear a year before a large bill. No discounting.
   - Net savings = total savings − upfront cost − running costs, over the horizon.
8. **Recommendation.** The candidate with the highest net savings at the typical cost. Reason: "shortest payback" always favours the smallest system, and "cover the whole bill" is the oversizing error the product exists to prevent.
9. **CO₂ avoided** = self-consumed solar energy × grid emission factor. Exported surplus is left out, which keeps the claim conservative.

### 3.3 Outputs

For every candidate size, with and without battery: size, panel count, yearly generation, self-consumed energy and share, monthly savings, cost range, payback range or "does not pay back", net savings, CO₂ avoided, the 24-hour average load and solar curves, and the cumulative savings series. Plus: the recommended candidate, the chosen battery size, the daytime share used, and flags (sun data fallback, heavy shade, roof too small with required area).

### 3.4 Sun data

- Source: NASA POWER hourly API (`/api/temporal/hourly/point`), the most recent complete calendar year, fetched by the server and never by the browser. Requested in POWER's "LST", which is the time zone of the nearest 15° of longitude: clock time across almost all of Indonesia, and within half an hour of solar time everywhere. The home's use is described in clock time, so the two line up.
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
| Charts | SVG drawn with d3-scale and d3-shape; no chart framework |
| Database | Supabase Postgres; SQL migrations in `supabase/migrations/` |
| Unit tests | Vitest |
| Flow and accessibility tests | Playwright with axe |
| Hosting | Vercel free tier; GitHub repository, private until stage 1 is live |

The engine runs in both places: on the server when a result is first computed and saved, and in the browser when the user picks another panel count. The saved result includes the sun series reference needed for the browser to recompute.

### 5.1 Server routes

| Route | Request | Response |
| --- | --- | --- |
| `GET /api/sun?lat&lon` | A point in Indonesia | `{ series: number[8760], source: "live" \| "fallback", cellId, year }` |
| `GET /api/geocode?q` | Search text | Up to five places in Indonesia: `{ label, lat, lon }[]` |
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
