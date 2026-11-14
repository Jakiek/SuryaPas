# Design

Approved by the owner on 2026-11-14. The reference is the static mock in `mock/` (serve it with any static server and open `index.html`, `atap.html`, `hasil.html`). Where this file and the mock disagree, this file wins; where this file is silent, match the mock.

## Idea: day and night

Solar only saves money while the sun is up. The whole interface is built from that fact: **yellow is day, navy is night, white is the report.** A reader should be able to tell which part of a chart or a page is "sun" at a glance, in colour or in greyscale.

The look is a printed poster and a utility bill, not a software dashboard: heavy condensed capitals, large figures, hairline rules, square corners.

## What this design does not use

These are the marks of a generic generated interface, and the owner rejected a first mock for having them. Build the positive version in the right-hand column.

| Leave out | Use |
| --- | --- |
| Rounded cards with a border or shadow around each item | Full-width colour bands and hairline rules |
| Pill-shaped chips and badges | Plain text lines, or a small capital label |
| Rounded corners | Square corners everywhere (`border-radius: 0`) |
| A grid of stat cards | Ledger rows: label left, figure right, rule between |
| Soft neutral backgrounds with one polite accent | Solid yellow and solid navy fields |
| Gradients, shadows, glows, blur | Flat colour and hatching |
| A marketing headline over two buttons | The tool's first input as the hero |
| Decorative icons beside headings | Type alone |

## Colour

| Token | Value | Role |
| --- | --- | --- |
| `sun` | `#FFCF33` | Day. Hero band, picker band, solar used on site, the primary action on navy, the key figure on navy |
| `sun-soft` | `#FFF1BF` | Background under hatching for surplus solar |
| `night` | `#0F1B3D` | Night. All text, rules, the verdict band, the primary action on yellow or white |
| `paper` | `#FFFFFF` | The report |
| `ink-soft` | `#4A556F` | Secondary text on white |
| `rule` | `night` at 20% | Hairlines between ledger rows |
| `alert` | `#C8371B` | The left bar of a caveat block. Never text |

- Light theme only.
- A screen is made of bands: `sun`, `night` or `paper`, each full width.
- Surplus solar (sent to the grid, unpaid) is always **hatched**: `night` diagonal lines over `sun-soft`. Solar used on site is always **solid `sun`**. This pairing is the product's visual vocabulary; use it wherever the two appear.
- Secondary text on `night` is `paper` at 72% or more. Secondary text on `sun` is `night` at 75% or more.

Measured contrast: `night` on `sun` 11.4:1; `paper` on `night` 16.9:1; `ink-soft` on `paper` 7.5:1; `paper` at 72% on `night` 9.2:1; `night` at 75% on `sun` 6.2:1. Any new pair must reach 4.5:1 for text and 3:1 for large text and control boundaries.

## Type

Two families, both through `next/font`, both with tabular numerals (confirmed in the mock).

| Style | Family and settings | Used for |
| --- | --- | --- |
| Poster | Archivo, width 62%, weight 800, uppercase, line-height 0.86, word-spacing 0.08em | Page and section headings |
| Figure | Archivo, width 88%, weight 800, letter-spacing −0.02em, tabular numerals | Every number a user reads as a result |
| Label | Plus Jakarta Sans 800, 12 px, uppercase, letter-spacing 0.14em | Small labels above figures, table headings |
| Text | Plus Jakarta Sans 400–800 | Everything else. Body is 16 px or larger on phones |

- Poster headings scale with the viewport (`clamp`), from about 64 px on a phone hero to 168 px on desktop; section headings from 36 to 54 px.
- The unit after a figure ("juta", "tahun", "%") is set at half the figure's size.
- The word "pas" in the hero and in the wordmark sits in a tight rectangular outline, the visual form of "exact fit". The wordmark is `SURYA` followed by boxed `PAS`, in Archivo width 75%.

## Layout

- Designed at 375 px first: one column, 20 px gutters, no horizontal scrolling.
- Touch targets are at least 44 × 44 px.
- Rules are 2.5 px `night` above each section and each question, 1 px `rule` between rows.
- Text blocks and charts stop at about 680 px wide, so nothing stretches on tablets.
- From 880 px: the roof step shows the map beside the questions; the result page pins the verdict and picker in a left column and scrolls the report on the right; the landing page sets the headline text beside the comparison.
- On phones the flow's primary action sits in a bar fixed to the bottom of the screen.

## Components

- **Button.** Solid rectangle, 56 px tall, label left, arrow right. `night` on yellow or white; `sun` on navy. Secondary: 2.5 px outline, no fill.
- **Hero input.** A white field with a 2.5 px `night` border joined to its button: stacked on phones, side by side from 620 px.
- **Segmented choice.** Options share one outlined block with dividers between them. Each has a line drawing in `currentColor` and a label. The selected option inverts to `night` with `paper` content. It is a radio group: arrow keys move, the group has a visible focus ring.
- **Ledger.** Rows of label and figure with 1 px rules. Used for the supporting numbers, the landing comparison and the battery comparison.
- **Panel picker.** A row of eight upright rectangles. Tapping the fifth selects five panels; selected panels are filled `night` with a faint yellow cell cross. Numbers sit under each; the recommended count also carries the word "pas". Counts below the smallest system are shown filled and disabled. It replaces a slider because each step is a whole panel.
- **Progress.** "2/4" in Figure style, the step name as a Label, and four thin segments.
- **Day band.** A strip under every day chart: `night`, `sun`, `night` in the proportions 6:12:6, labelled malam, siang, malam, with hour ticks beneath.
- **Caveat.** Text with a 6 px `alert` bar on its left. No background.
- **Map.** Runs edge to edge on phones. The traced area reads out in a `night` tag pinned to the map's top-left corner; tool buttons sit on the map's bottom-left. Corner handles are squares.

## Charts

Two charts, defined in `docs/SPEC.md` section 2.3, drawn in SVG.

- **One day.** Home use is a 3 px `night` line. Solar is an outlined hump: solid `sun` where it is used on site, hatched where it exceeds use. The day band sits beneath. Labels are written on the chart ("dipakai langsung", "terbuang ke jaringan", "pemakaian rumah"), with a white halo so they stay legible over lines. The vertical scale stays fixed as the panel count changes, so the hump visibly grows past the line.
- **Payback.** Cumulative savings is a 3.5 px `night` line. The upfront-cost range is a hatched horizontal band. The payback years are a solid `sun` column. Labels are written on the chart.
- Each chart has a one-sentence caption stating its finding with the actual numbers, which also serves screen-reader users.
- Axis text is `ink-soft`, 10–11 px at 340 px chart width.

## Motion

- Figures and charts ease to new values when the panel count changes (about 200 ms).
- Steps cross-fade.
- No decorative animation.
- With `prefers-reduced-motion`, all of the above are instant.

## Voice

- Indonesian addresses the user as "Anda". Everyday words, short sentences.
- Lead with the finding as a statement: "Yang pas untuk rumah ini: 3 panel", "Baterai belum sepadan", "Lebih banyak panel belum tentu lebih hemat".
- Every technical term is explained in one short line the first time it appears on a screen: kWp, inverter, on-grid.
- State unwelcome findings directly: "Dengan tarif Anda, panel surya kemungkinan tidak balik modal."
- Buttons say what happens next: "Lanjut ke listrik", "Salin tautan hasil".
- Errors say what went wrong and what to do.

## Number formats

| | Indonesian | English |
| --- | --- | --- |
| Money, exact | Rp12.500.000 | Rp12,500,000 |
| Money, rounded | Rp12,5 juta | Rp12.5 million |
| Money range | Rp18–25 juta | Rp18–25 million |
| Decimal | 1,65 kWp | 1.65 kWp |
| Range | 6–9 tahun | 6–9 years |

Format through `Intl.NumberFormat` with the active locale; never by string concatenation.
