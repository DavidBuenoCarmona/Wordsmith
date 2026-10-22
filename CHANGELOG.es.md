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

## [0.4.0] — 2026-10-16

Versión de autoría de escenas: las composiciones se pueden **guardar y restaurar**, todos los objetos aparecen en un **Outliner** editable, los atajos siguen a **Unreal Engine** y la acción **Floor** se reconstruyó sobre la geometría real del mundo.

### Added
- **Guardar / Cargar Escenas**: nuevo menú `Scenes`. Una escena es un JSON simple (`storage/scenes/*.json`) con la referencia al mundo, la posición / rotación / escala de cada modelo (+ oculto/bloqueado), la cámara, la calibración de suelo y la iluminación. Nuevo contrato `SceneFileSchema` en `@wordsmith/shared` y endpoints `GET/POST /api/storage/scenes`, `GET/DELETE /api/storage/scenes/:id`.
- **Importaciones persistentes**: los archivos importados desde disco (mapas y modelos GLB) se suben a `storage/worlds` / `storage/models` (`POST /api/storage/upload`, por hash de contenido: reimportar no duplica) para poder listarlos y restaurarlos en escenas guardadas.
- **Panel Outliner** (derecha): lista alfabética de todos los objetos de la escena, incluidos los añadidos a mano; clic para seleccionar, **`F` / diana para centrar la cámara** (sin selección encuadra toda la escena), doble clic para renombrar, mostrar/ocultar, bloquear y borrar.
- **Inspector numérico**: campos editables de posición, rotación (°) y escala que siguen al gizmo en vivo.
- **Pins**: marca con una estrella cualquier mundo o modelo para mantenerlo arriba de su lista (persistido en `storage/favorites.json`; `GET/PUT /api/storage/favorites/:kind`).
- **Deshacer / rehacer** (`Ctrl+Z`, `Ctrl+Y`) para mover, rotar, escalar, añadir, borrar, duplicar y renombrar; **duplicar** (`Ctrl+D`).
- **Modo presentación** (`H`): oculta la interfaz y orbita la cámara; botón **Capture** (captura PNG); **presets de iluminación** (Día / Atardecer / Noche / Niebla); **ayuda de atajos** (`?`).
- **Selector de modo de generación** en la barra de prompt: **Everything** (mundo + objetos, reemplaza la escena), **Scenery only** (solo World Labs, conserva tus objetos) y **Objects only** (solo Tripo, *añade* los modelos a la escena actual — p. ej. "5 piratas diferentes" en una isla que ya tiene barcos). Nuevo campo `mode` en `WorldPromptInput` / `GenerationJob`; el prompt del LLM ahora es común a los proveedores OpenAI, Anthropic y Gemini y varía según el modo (objetos distintos, ids únicos por job para no sobrescribir modelos guardados). Los objetos nuevos aparecen en fila delante de la cámara, separados según su tamaño real y apoyados en el suelo. Los jobs fallidos ahora muestran un aviso.
- **Calibración del nivel de suelo** en el Outliner (Y manual, "desde el objeto seleccionado", volver a automático).
- Tests: visor, esquema de escena, almacenamiento / rutas, modos de generación y componentes React (monorepo con 103 tests), más una ejecución E2E manual en Chrome (CDP) de todo el flujo.

### Changed
- **Orden alfabético** (sin distinguir mayúsculas/acentos y con números naturales) de mundos y modelos, en servidor y cliente; los pins van primero.
- **Atajos estilo Unreal**: `W` mover, `E` rotar, `R` escalar, `F` enfocar, `Supr` borrar. `WASD`/`Q`/`E` vuelan la cámara con el ratón pulsado (o sin selección).
- La lista de mundos expone también archivos `.ply` y panoramas 360 de `storage/worlds`, y el `colliderUrl` de World Labs.
- La cabecera muestra `v0.4.0` en lugar de la etiqueta `MVP`; el antiguo `AssetInspector` se sustituyó por el Outliner.

### Fixed
- **Floor / pegar al suelo**: los modelos flotaban media altura porque el pivote está en el centro pero se sumaba la altura completa. Ahora la base queda exactamente sobre la superficie, teniendo en cuenta escala y rotación.
- **Detección del suelo**: el rayo parte del propio objeto (no de 150 m de altura), así que ya no aterriza en tejados o techos, y usa la **malla de colisión** de World Labs cuando existe (el raycast sobre un Gaussian splat no tiene triángulos y daba impactos erráticos).
- Los modelos añadidos frente a la cámara se posan sobre el suelo real bajo la cámara en vez de a una altura fija.
- Error de compilación `tsc` preexistente en `httpWorldLabsProvider.ts` (tipado de `imagery.pano_url`).
- Pins: la petición de favoritos se lanzaba desde dentro de un updater de estado de React (se enviaba dos veces en modo estricto); ahora se envía una vez desde una copia síncrona del estado.
- `vite.config.ts`: `strictPort` para que una segunda instancia de Vite no pueda ocupar el puerto del backend (3001) y hacer proxy de `/api` a sí misma.

### Notas de revisión (code-simplify, 2026-10-16)
- *Importante* (aceptado): `sceneUrl` / `modelUrl` de una escena guardada pueden apuntar a cualquier URL (las carga el navegador) — válido para una herramienta local de un solo usuario; añadir lista blanca si algún día se aloja. Las subidas se almacenan en memoria (límite 500 MB).
- *Importante* (deuda): `WorldViewer3D.ts` supera las 2.000 líneas; dividir en módulos de historial / cámara / suelo (ver `task.md`).
- Simplificado: código repetido de media altura y de liberación del entorno extraído a helpers; eliminado el último `any` del código nuevo.

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
