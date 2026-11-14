# Design

**Status: draft.** The direction below is agreed. Exact values are provisional until the owner approves the mock in T01, after which this file is final and this notice is removed.

## Direction

Warm and trustworthy, like a good consumer finance app. A homeowner is being asked to trust a number worth tens of millions of rupiah, so the interface is calm, clear and unhurried. Every screen answers one question.

## Colour

Light theme only.

| Token | Role | Provisional value |
| --- | --- | --- |
| `surface` | Page background, warm off-white | `#FAF7F2` |
| `surface-raised` | Cards and inputs | `#FFFFFF` |
| `ink` | Text, deep green-black | `#14231C` |
| `ink-muted` | Secondary text | `#55635B` |
| `line` | Borders and dividers | `#E3DED4` |
| `accent` | Amber: the main action and the key number | `#F2A20C` |
| `savings` | Green: savings and positive outcomes only | `#1F7A4D` |
| `warning` | Honest verdicts and cautions | `#B4541A` |

- Amber appears once per screen: on the primary action, or on the one number the screen is about.
- Amber is a fill with `ink` text on top. Text is never set in amber on a light surface.
- Green means money saved and nothing else.
- Every text and background pair meets WCAG AA contrast (4.5:1 for body text, 3:1 for large text and interface boundaries).

## Type

Plus Jakarta Sans throughout, loaded through `next/font`.

- Money and measurements use tabular numerals so figures stay aligned as the slider moves. T01 confirms the font ships them; if it does not, T01 names the fallback for figures.
- Headline numbers on the result page are the largest text in the product. Labels sit above them, small and muted.
- Body text is at least 16 px on phones.

## Layout

- Designed at 375 px first. One column, 16 px side gutters, no horizontal scrolling.
- Touch targets are at least 44 × 44 px.
- From 768 px up, the same flow gains a second column where it helps: map beside the form, charts beside the numbers.
- The primary action sits at the bottom of the screen on phones, within thumb reach.

## Components

- **Picture choice**: a card with a simple drawing, a label and one line of help; used for slope, shade and facing. The selected state is shown by border and a check mark, with colour as reinforcement only.
- **Stepper**: four steps, current step named in words ("Step 2 of 4: Roof").
- **Number block**: label, large figure, unit, and an optional range line.
- **Range**: written "6–8 tahun" or "6–8 years", never a single false-precision figure where the spec calls for a range.

## Charts

Two charts only, defined in `docs/SPEC.md` section 2.3. Drawn in SVG.

- Typical day: usage as a line, solar as a filled area, the overlap filled in `savings`, the surplus in a muted amber tint. A direct label on each region; no separate legend.
- Cost versus savings: cumulative savings as a line, upfront cost as a horizontal band from low to high, the payback crossing marked and labelled.
- Each chart has a one-sentence text summary beneath it that states its finding, which also serves screen-reader users.

## Motion

- Numbers and charts ease to their new values as the slider moves (about 200 ms).
- Steps cross-fade or slide gently.
- No decorative animation.
- With `prefers-reduced-motion`, all of the above become instant.

## Voice

- Indonesian addresses the user as "Anda". Everyday words; short sentences.
- Every technical term is explained in one short line the first time it appears on a screen: kWp, inverter, on-grid.
- State findings directly, including unwelcome ones: "Dengan tarif Anda, panel surya kemungkinan tidak balik modal."
- Buttons say what happens: "Lihat hasil", "Ubah data".
- Errors say what went wrong and what to do next.

## Number formats

| | Indonesian | English |
| --- | --- | --- |
| Money, exact | Rp12.500.000 | Rp12,500,000 |
| Money, rounded | Rp12,5 juta | Rp12.5 million |
| Decimal | 3,3 kWp | 3.3 kWp |
| Range | 6–8 tahun | 6–8 years |

Format through `Intl.NumberFormat` with the active locale; never by string concatenation.
