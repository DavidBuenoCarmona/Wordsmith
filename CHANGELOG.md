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
