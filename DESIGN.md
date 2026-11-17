# DESIGN.md: MSL Test Hub

Direction for every screen in this app. `antislop` is the filter on top of it (see AGENTS.md).

## What the product is

An internal tool for the MyStudyLife team. One place for the test case repository, automated
run results from GitHub Actions, and (later) manual runs and performance results.

The job of almost every screen: **show what is failing and where it is documented.** Failures
are the content; everything that passed is context.

## Dial

`Dial: ENERGY 1 / RHYTHM 1 / MOTION 1`

- ENERGY 1: a work tool read for hours, often while comparing runs. Nothing competes with the data.
- RHYTHM 1: uniform, predictable tables on purpose, so the eye finds the same column in the same place on every page.
- MOTION 1: hover and focus states only. No entrance animation.

## Identity motif: the result strip

Results are drawn as a row of small square cells, oldest left, newest right, one cell per result.
A run gets a proportional tally bar in the same colors. This is the one repeated gesture: it
appears on the overview, the runs list, the case list and the case page, so a glance at any
screen answers "is this getting better or worse?". A strip is never the only signal: the counts
or the status word sit next to it in text.

## Color

Neutrals (paper, ink, muted ink, rule) plus **one accent**. Status colors are semantics, not palette.

| Token | Light | Dark | Use |
|---|---|---|---|
| paper | `#F7F6F2` | `#15171A` | page background; warm off-white is easier on long reading sessions than pure white |
| surface | `#FFFFFF` | `#1D2024` | tables, forms |
| ink | `#1B1E22` | `#E7E6E1` | body text |
| muted | `#565C64` | `#A3A8AE` | secondary text (both pass 4.5:1 on paper and surface) |
| rule | `#DAD8D1` | `#33373C` | table rules, borders |
| accent | `#2343A8` | `#93A8F2` | links, primary button, focus ring. Blue because it is the one hue no status uses, so an action never reads as a result |

Status (used for result cells, tally bars, and status text):

| Status | Light | Dark |
|---|---|---|
| passed | `#1E7A46` | `#5CC48A` |
| failed | `#B42318` | `#F2867B` |
| broken (setup/infra error, not an assertion) | `#7A3E9D` | `#C99AE6` |
| flaky (passed on retry) | `#A15C00` | `#E8A64A` |
| skipped | `#8A8F96` | `#7C8188` |

Known bugs are not a color: they are passed results marked with the text "known bug".

## Typography

- **IBM Plex Sans** for UI text. Built for technical interfaces, with clear tabular figures that keep counts and durations aligned in dense tables.
- **IBM Plex Mono** only for case IDs, commit hashes and error output: IDs line up in a column and traces are code. Never for headings.
- Base size 14px, tables 13px, line height 1.45. Sentence case everywhere; no wide-tracked uppercase labels.

## Shape and space

- Radius: 2px on buttons and inputs, 0 on tables and result cells. Square cells are the motif.
- No shadows, no blur, no gradients. Elevation is shown with a rule line.
- Spacing on a 4px grid. Tables are dense (6px vertical cell padding); page sections are separated by 24px and a heading.

## Layout

- Top bar: product name as text (no logo until one is supplied), then the real destinations only.
- Content max width 1200px. Tables scroll inside their own container on narrow screens; the page never scrolls sideways.
- Every data view has three honest states: loading (says what it loads), empty (says why and the one action that fills it), error (says what failed).

## Theme

Light by default, dark through a toggle that follows the system setting until the user picks one.
Both themes are tested.
