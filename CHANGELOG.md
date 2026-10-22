# Changelog — Wordsmith

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

[![Español Changelog](https://img.shields.io/badge/Changelog-Español-emerald.svg)](./CHANGELOG.es.md)
[![README](https://img.shields.io/badge/Docs-README-blue.svg)](./README.md)

---

> 🇪🇸 **Leer en Español**: [Changelog en Español](./CHANGELOG.es.md)

---

## [Unreleased]

---

## [0.4.0] — 2026-10-16

Scene-authoring release: composed scenes can now be **saved and restored**, every object is listed and editable from an **Outliner**, shortcuts follow **Unreal Engine**, and the **Floor** action was rebuilt around the real world geometry.

### Added
- **Save / Load Scenes**: new `Scenes` menu. A scene is a simple JSON file (`storage/scenes/*.json`) with the world reference, every model's position / rotation / scale (+ hidden/locked), camera pose, floor calibration and lighting preset. New `SceneFileSchema` contract in `@wordsmith/shared` and endpoints `GET/POST /api/storage/scenes`, `GET/DELETE /api/storage/scenes/:id`.
- **Persistent imports**: files imported from disk (maps and GLB models) are uploaded to `storage/worlds` / `storage/models` (`POST /api/storage/upload`, content-hashed so re-importing never duplicates) so they can be listed and restored in saved scenes.
- **Outliner panel** (right): alphabetical list of all objects in the scene, including ones added manually; click to select, **`F` / crosshair to focus the camera** (frames the whole scene when nothing is selected), double-click to rename, show/hide, lock, delete.
- **Numeric inspector**: editable position, rotation (°) and scale fields that follow the gizmo live.
- **Pins**: star any world or model to keep it at the top of its list (persisted in `storage/favorites.json`; `GET/PUT /api/storage/favorites/:kind`).
- **Undo / redo** (`Ctrl+Z`, `Ctrl+Y`) for move, rotate, scale, add, delete, duplicate and rename; **duplicate** (`Ctrl+D`).
- **Presentation mode** (`H`): hides the UI and auto-orbits the camera; **Capture** button (PNG screenshot); **lighting presets** (Day / Sunset / Night / Foggy); **shortcuts help** (`?`).
- **Generation mode selector** in the prompt bar: **Everything** (world + objects, replaces the scene), **Scenery only** (World Labs only, keeps your objects) and **Objects only** (Tripo only, *adds* the models to the current scene — e.g. "5 different pirates" on an island that already has ships). New `mode` field in `WorldPromptInput` / `GenerationJob`; the LLM prompt is now shared by the OpenAI, Anthropic and Gemini providers and varies per mode (distinct objects, unique ids per job so stored models are never overwritten). New objects appear in a row in front of the camera, spaced by their real size and resting on the floor. Failed jobs now show a notice.
- **Floor level calibration** in the Outliner (manual floor Y, "from selected object", back to auto).
- Tests: viewer, scene schema, storage / routes, generation modes and React component tests (monorepo now 103 tests), plus a manual Chrome (CDP) end-to-end run of the whole flow.

### Changed
- **Alphabetical ordering** (case/accent-insensitive, natural numbers) of worlds and models, server and client side; pinned items first.
- **Unreal-style shortcuts**: `W` move, `E` rotate, `R` scale, `F` focus, `Del` delete. `WASD`/`Q`/`E` fly the camera while the mouse is held (or with nothing selected).
- Worlds list now also exposes `.ply` files and 360 panoramas stored in `storage/worlds`, and the World Labs `colliderUrl`.
- Header shows `v0.4.0` instead of the `MVP` badge; the old `AssetInspector` was replaced by the Outliner.

### Fixed
- **Floor / Snap to ground**: models floated by half their height because the pivot is at the model centre but the full height was added. The base is now placed exactly on the surface, taking scale and rotation into account.
- **Floor detection**: the ray now starts from the object (not from 150 m above), so it no longer lands on roofs or ceilings, and it uses the World Labs **collision mesh** when available (raycasting a Gaussian splat has no triangles and returned erratic hits).
- Models spawned in front of the camera are placed on the real floor below the camera instead of a fixed height.
- Pre-existing `tsc` build error in `httpWorldLabsProvider.ts` (missing `imagery.pano_url` typing).
- Pins: the favorites request was fired from inside a React state updater (sent twice in strict mode); now sent once from a synchronous copy of the state.
- `vite.config.ts`: `strictPort` so a second Vite instance can no longer take the backend port (3001) and proxy `/api` to itself.

### Review notes (code-simplify, 2026-10-16)
- *Important* (accepted): `sceneUrl` / `modelUrl` of a saved scene may point to any URL (loaded by the browser) — fine for a local single-user tool; add an allow-list if it is ever hosted. Uploads are buffered in memory (500 MB limit).
- *Important* (debt): `WorldViewer3D.ts` exceeds 2,000 lines; planned split into history / camera / floor modules (see `task.md`).
- Simplified: repeated half-height and environment-dispose code extracted into helpers; removed the remaining `any` from new code.

---

## [0.3.0] — 2026-10-04

Major stabilization and hardware adaptation release introducing **JupiterSR Autostereoscopic 3D display support**, interactive 3D transform gizmos, multi-provider LLM fallback orchestration, and high-fidelity rendering optimizations.

### Added
- **JupiterSR Autostereoscopic 3D Display Integration**:
  - Embedded `jupiter-interlace-sdk` with real-time multi-view interlacing (from 1 to 30 synthetic camera viewpoints).
  - Built `JupiterSRPanel.tsx` interactive calibration panel with live optical parameter tuning (`pitch`, `tan`, `offset`, `subpixelOrder` RGB/BGR, `order` forward/reverse/pingpong, `rotation`) and render options (`views`, `viewWidth`, `viewSpacing`, `focusDistance` zero-parallax plane).
  - JSON profile import and export (`wordsmith_jupiter_profile`) with automatic `localStorage` persistence.
  - Dedicated Fullscreen toggle for exact 1:1 subpixel alignment with physical lenticular display panels.
  - GPU-accelerated Draco and KTX2/Basis decoders hosted at `/jupiter-decoders/` for fast compressed mesh and texture decompression.
  - Dedicated `jupiter.test.ts` test suite covering optical validation, JSON serialization, and logical/rendered view mappings.
- **Interactive 3D Transform Gizmos & Scene Controls**:
  - Integrated Three.js `TransformControls` and `TransformToolbar` supporting Translation and Rotation gizmo modes.
  - Automatic ground snapping (`snapSelectedToGround`) targeting terrain level (`Y = -1.5m`).
  - Automatic camera navigation locking while dragging gizmos to prevent control conflicts.
  - Bi-directional asset selection and synchronization between the 3D canvas and `AssetInspector`.
- **Scene & Model Browsers**:
  - Added `WorldSelector` and `ModelSelector` components to browse, preview, and load saved 3D worlds and GLB models.
  - Fastify backend endpoints to serve local assets, cached files, and metadata (`/api/storage/files/*`, `/api/storage/models`, `/api/storage/worlds`).
- **Hierarchical Multi-Provider LLM Fallback**:
  - Built `ProviderFactory` with automatic priority cascade: OpenAI (`gpt-4o-mini`) → Anthropic (`claude-3-5-sonnet`) → Google Gemini (`gemini-1.5-flash`) → Offline deterministic mock provider.
  - Real HTTP adapters for World Labs (Marble 3D Gaussian Splatting `.spz`) and Tripo 3D (`.glb`) with automatic local caching.
- **Bilingual Documentation & Setup Guides**:
  - English `README.md` as primary documentation and Spanish `README.es.md` as secondary documentation.
  - Step-by-step installation instructions, environment configuration, and direct API key dashboard links in `.env`.
  - Comprehensive technical guide for JupiterSR calibration and autostereoscopic workflows.

### Fixed
- **2D Rendering Sharpness & Resolution**: Decoupled the render pipeline when Jupiter 3D mode is `OFF` (`2d` mode), eliminating downscaling blur and quad blitting to restore direct native high-DPI Three.js rendering for Gaussian Splats (`SparkRenderer`) and 3D meshes.

### Changed
- Expanded monorepo test coverage to 27 tests passing across `@wordsmith/shared`, `@wordsmith/server`, and `@wordsmith/client`.

---

## [0.2.0] — 2026-09-17

Initial MVP delivery of **Wordsmith (AI-Native 3D World Director)**. Converts natural language prompts into composed, interactive 3D scenes in the browser using Hexagonal Architecture and SSE streams.

### Added
- **`@wordsmith/shared`**:
  - Strict Zod schemas for prompts (`WorldPromptInputSchema`), 3D scenes (`WorldSpecSchema`), job states (`GenerationJobStateSchema`), and real-time events (`GenerationProgressEvent`).
  - Unit test suite with Vitest (7 tests).
- **`@wordsmith/server`**:
  - Fastify backend under Hexagonal Architecture (Ports & Adapters).
  - Ports and interfaces for LLM, World Labs, Tripo, and JobRepository with deterministic mock implementations.
  - Asynchronous non-blocking orchestrator (`GenerationOrchestrator`) with Server-Sent Events at `/api/jobs/:id/events`.
  - Integration suite (3 tests) and Prompt Evals suite (3 evals).
- **`@wordsmith/client`**:
  - Interactive frontend with React 18, Vite, TailwindCSS, and Three.js.
  - Procedural 3D viewer (`WorldViewer3D`) with lighting, render loop, asset animations, and spatial anchoring.
  - UI Components: `PromptBar` (presets & style selector), `ProgressOverlay` (real-time telemetry), and `AssetInspector` (props and spatial coordinates).
  - Headless client unit tests with Vitest.
- **Cross-Platform Scripts**:
  - Windows `start.cmd` / `stop.cmd` and Linux/macOS `start.sh` / `stop.sh`.
- **Documentation**:
  - Root `README.md` with quick start guide and monorepo architecture.
  - `walkthrough.md` with verification report.
