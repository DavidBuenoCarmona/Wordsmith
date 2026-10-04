# Registro de Cambios (Changelog) — Wordsmith

Todos los cambios notables de este proyecto están documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

[![English Changelog](https://img.shields.io/badge/Changelog-English-blue.svg)](./CHANGELOG.md)
[![README](https://img.shields.io/badge/Docs-README-emerald.svg)](./README.es.md)

---

> 📖 **Read in English**: [English Changelog](./CHANGELOG.md)

---

## [Sin publicar] / [Unreleased]

---

## [0.3.0] — 2026-10-04

Versión mayor de estabilización, soporte de hardware autoestereoscópico **JupiterSR**, manipulación interactiva de escena con gizmos y orquestación multi-proveedor de IA.

### Added
- **Soporte de Displays 3D Autoestereoscópicos (JupiterSR)**:
  - Integración de `jupiter-interlace-sdk` con entrelazado óptico multi-vista en tiempo real (de 1 a 30 vistas sintéticas).
  - Componente `JupiterSRPanel.tsx` con modal de calibración óptica (pitch, tan, offset, subpíxeles RGB/BGR, orden de vistas, rotación) y parámetros de render (vistas, ancho de búfer, espaciado de cámara/baseline y plano zero-parallax de foco).
  - Importación y exportación de perfiles de calibración en formato JSON (`wordsmith_jupiter_profile`) con persistencia en `localStorage`.
  - Modo pantalla completa dedicado para alineación 1:1 de subpíxeles virtuales con las microlentes físicas.
  - Decodificadores Draco y KTX2/Basis en `/jupiter-decoders/` para descompresión acelerada por GPU de mallas y texturas.
  - Suite de pruebas dedicada `jupiter.test.ts` para validación de perfiles y cálculo de vistas lógicas y renderizadas.
- **Gizmos de Transformación y Manipulación 3D**:
  - Controles interactivos con Three.js `TransformControls` y barra de herramientas `TransformToolbar` (modos traslación y rotación).
  - Función de auto-anclaje al suelo (`snapSelectedToGround`) a nivel de terreno (`Y = -1.5m`).
  - Bloqueo automático de la navegación de cámara durante el arrastre de gizmos para evitar colisiones de interacción.
  - Selección visual y sincronizada con el panel de inspección de assets (`AssetInspector`).
- **Selectores de Escenas y Modelos**:
  - Componentes `WorldSelector` y `ModelSelector` para explorar, previsualizar y cargar mundos 3D y assets GLB almacenados.
  - Endpoints backend en Fastify para servir archivos locales y metadatos (`/api/storage/files/*`, `/api/storage/models`, `/api/storage/worlds`).
- **Cascada de Fallback Multi-Proveedor LLM**:
  - `ProviderFactory` con selección jerárquica automática: OpenAI (`gpt-4o-mini`) → Anthropic (`claude-3-5-sonnet`) → Google Gemini (`gemini-1.5-flash`) → Mock determinista offline.
  - Adaptadores HTTP reales para World Labs (Marble Gaussian Splatting `.spz`) y Tripo 3D (`.glb`) con auto-guardado en caché local.
- **Documentación Bilingüe y Guías Exhaustivas**:
  - `README.md` principal en inglés y `README.es.md` secundario en español.
  - Guía completa de instalación paso a paso, configuración de variables de entorno y claves de API en `.env`.
  - Guía técnica detallada de uso y calibración para monitores JupiterSR.

### Fixed
- **Nitidez y Resolución 2D Nativa**: Desacople del pipeline de renderizado cuando Jupiter está en modo `2d` (OFF), eliminando la borrosidad por downscaling y blitting de shader, permitiendo renderizado directo de alta fidelidad en Three.js con `pixelRatio` y SparkRenderer para Gaussian Splatting.

### Changed
- Actualizada la suite de pruebas del monorepo a 27 tests pasando en verde en `@wordsmith/shared`, `@wordsmith/server` y `@wordsmith/client`.

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
