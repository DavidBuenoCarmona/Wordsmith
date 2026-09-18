# Changelog — Wordsmith

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [Sin publicar] / [Unreleased]

---

## [0.2.0] — 2026-09-17

Entrega del MVP de **Wordsmith (AI-Native 3D World Director)**. Convierte prompts en lenguaje natural en escenas 3D compuestas y explorables en el navegador mediante arquitectura hexagonal y eventos SSE.

### Added
- **`@wordsmith/shared`**:
  - Contratos Zod para validación estricta de prompts (`WorldPromptInputSchema`), escenas 3D (`WorldSpecSchema`), estado de jobs (`GenerationJobStateSchema`) y eventos en tiempo real (`GenerationProgressEvent`).
  - Suite de 7 tests unitarios con Vitest.
- **`@wordsmith/server`**:
  - Backend con Fastify bajo arquitectura hexagonal.
  - Puertos e interfaces para LLM, World Labs, Tripo y JobRepository con adaptadores Mock deterministas.
  - Orquestador asíncrono no bloqueante (`GenerationOrchestrator`) con streaming SSE en `/api/jobs/:id/events`.
  - Suite de integración (3 tests) y Evals de descomposición de prompts (3 evals).
- **`@wordsmith/client`**:
  - Frontend interactivo con React 18, Vite, TailwindCSS y Three.js.
  - Visor 3D procedural (`WorldViewer3D`) con iluminación, loop de renderizado, animaciones de inspección y anclaje espacial.
  - Componentes UI: `PromptBar` (presets y selector de estilo), `ProgressOverlay` (telemetría en tiempo real) y `AssetInspector` (panel de props y coordenadas).
  - Test unitario de cliente headless con Vitest.
- **Scripts Multiplataforma**:
  - Scripts `start.cmd` / `stop.cmd` para Windows y `start.sh` / `stop.sh` para Linux/macOS.
- **Documentación**:
  - `README.md` con guía de inicio rápido y arquitectura del monorepo.
  - `walkthrough.md` con reporte completo de verificación.
