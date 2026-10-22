# Wordsmith — jury presentation

A short presentation (about 12–15 minutes, 16 slides plus one appendix slide) on what Wordsmith does, how it is built and where Tripo fits in.
Same format and visual style as the Holo-Companion talk.

## Open it

Double-click [`index.html`](./index.html) (Chrome or Edge). It is **self-contained and works offline**: reveal.js 5.2.1 and
mermaid 11.4.1 are in `vendor/` (both MIT) and the screenshots are in `img/`. No server, no build step.

| Key | Action |
| --- | --- |
| `→` / `←` | next / previous slide |
| `S` | **speaker view** with the notes and a timer |
| `F` | fullscreen |
| `O` | slide overview |

**PDF:** open `index.html?print-pdf` in Chrome, press `Ctrl+P`, destination *Save as PDF*, margins *None*, tick *Background graphics*.

## Outline

| # | Slide | Diagram / image |
| --- | --- | --- |
| 1 | Title | screenshot: pirate island |
| 2 | The product: one sentence to an editable world | — |
| 3 | What it can do (six capabilities) | — |
| 4 | In the app: select, move, floor | screenshot: gizmo + inspector |
| 5 | System at a glance | flowchart |
| 6 | One monorepo, one typed contract | flowchart |
| 7 | Hexagonal server | flowchart |
| 8 | One generation job | sequence |
| 9 | *Part two:* where Tripo fits in | — |
| 10 | Tripo integration: prompt line to GLB | flowchart |
| 11 | Scenes made from Tripo models | 2 screenshots |
| 12 | Floor of a Gaussian splat | flowchart |
| 13 | Glasses-free 3D on Jupiter SR | screenshot: calibration panel |
| 14 | How we kept it reliable | timeline |
| 15 | Takeaways | — |
| 16 | Live demo / questions | screenshot |
| A | Appendix: HTTP API and contracts | — |

For a 7-minute version present slides 1, 2, 3, 5, 8, 10, 11, 16.

## Where the facts come from

| Claim | Source |
| --- | --- |
| 103 tests, v0.4.0 | `dbv-specs-ops/task.md`, `CHANGELOG.md` |
| Provider cascade OpenAI, Anthropic, Gemini, mock | `packages/server/src/infrastructure/providerFactory.ts` |
| Job phases, endpoints | `packages/shared/src/schemas/job.ts`, `packages/server/src/server.ts` |
| Floor strategy, pivot bug, collision mesh | `dbv-specs-ops/memory.md` (ADR 2026-10-16), `CHANGELOG.md` |
| 42 GLB models | *3D Models* menu of the running app, `storage/models/` |

## Images

All taken from the running app (Chrome headless over CDP, 1600×900):

| File in `img/` | What it shows |
| --- | --- |
| `island.png` | “Abandoned-pirate-island” saved scene |
| `select.png` | selected character with gizmo, inspector and toolbar |
| `desert.png` | “Desert-pyramid” saved scene |
| `light.png` | pirate scene with the Sunset lighting preset |
| `jupiter.png` | JupiterSR 3D Settings panel (cropped by CSS on the slide) |

## Editing

Slides are plain HTML `<section>`s in `index.html`. Each diagram is a mermaid source inside
`<script type="text/plain" class="mmd">`. Speaker notes are the `<aside class="notes">` of each slide.
