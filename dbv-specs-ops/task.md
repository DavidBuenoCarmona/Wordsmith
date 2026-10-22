# Backlog - Wordsmith MVP (AI-Native 3D World Generator)

## Contexto del Proyecto (Context Snapshot)
* **Objetivo**: Crear un MVP funcional de Wordsmith capaz de convertir un prompt en lenguaje natural en una escena 3D compuesta y explorable en el navegador, integrando generación de entornos (World Labs) y assets (Tripo) mediante un orquestador backend en TypeScript con visor Three.js.
* **Estado actual**: v0.4.0 ENTREGADA (`/ship`): autoría y persistencia de escenas + selector de modo de generación. 103 tests + E2E en Chrome. Pendiente solo commit/tag (el proyecto no es un repo git todavía).
* **Última decisión técnica**: el visor (`WorldViewer3D`) es la fuente de verdad de los objetos de la escena; las escenas se guardan como JSON en `storage/scenes/` y las importaciones se suben a `storage/`. Floor usa el colisionador de World Labs.
* **Próximo paso**: reiniciar `start.cmd` (el servidor antiguo en el puerto 3001 no tiene los endpoints nuevos) y ensayar la demo del concurso: cargar mundo → añadir modelos → Guardar escena → recargar → Cargar escena → `H` presentación.

---

## Checklist de Tareas

- [x] **Fase 0: Scaffolding & Contratos Compartidos (`packages/shared`)**
  - [x] Configurar configuración raíz (`package.json` con workspaces npm, `tsconfig.base.json`, `.gitignore`).
  - [x] Crear paquete `packages/shared` con TypeScript y Vitest.
  - [x] Definir esquemas Zod: `WorldPromptInputSchema`, `WorldSpecSchema`, `GenerationJobStateSchema`, `GenerationProgressEvent`.
  - [x] Implementar tests unitarios para validación y parseo de contratos (7/7 tests pasando).

- [x] **Fase 1: Backend Orquestador (`packages/server`)**
  - [x] Configurar paquete `packages/server` con Fastify, TypeScript y Zod.
  - [x] Implementar puertos (interfaces) para LLM, World Labs, Tripo y JobRepository.
  - [x] Implementar adaptadores Mock deterministas (`MockLLMProvider`, `MockWorldLabsProvider`, `MockTripoProvider`, `InMemoryJobRepository`, `MemoryEventPublisher`).
  - [x] Implementar `GenerationOrchestrator` con pipeline asíncrono no bloqueante por microtareas.
  - [x] Implementar endpoints HTTP y streaming SSE (`/health`, `/api/generate`, `/api/jobs/:id`, `/api/jobs/:id/events`).
  - [x] Escribir y pasar tests de integración con Vitest (3/3 tests pasando).

- [x] **Fase 2: Frontend Web & Visor 3D (`packages/client`)**
  - [x] Scaffolding de React + Vite + TypeScript + TailwindCSS en `packages/client`.
  - [x] Implementar hook `useGenerationJob` para suscripción SSE/polling.
  - [x] Diseñar componentes UI (`PromptBar`, `ProgressOverlay`, `AssetInspector`).
  - [x] Implementar visor Three.js (`WorldViewer3D` con iluminación, loop de renderizado y composición de props).
  - [x] Escribir tests unitarios de cliente con Vitest.

- [x] **Fase 3: Integración, Testing E2E & Simplificación (`/test` & `/code-simplify` & `/ship`)**
  - [x] Probar flujo integral frontend ↔ backend con 14 tests pasando en todo el monorepo.
  - [x] Implementar suite de Evals (`evals.test.ts`) para comprobación de conformidad de `WorldSpec` y asignación de coordenadas finitas.
  - [x] Ejecutar revisión por pases de `docs/REVIEW.md` (Bugs: 0, Seguridad: claves aisladas en backend y Zod sanitization, Cumplimiento: 100%).
  - [x] Actualizar `README.md` en la raíz y `walkthrough.md` con la guía de inicio rápido.

- [x] **Ronda v0.4.0: Autoría y persistencia de escenas** (spec en `docs/SPECIFICATIONS.md` §3.1, plan en `implementation_plan.md`)
  - [x] R1 Orden alfabético (servidor + cliente) y pins persistentes (`storage/favorites.json`).
  - [x] R2 Outliner derecho + tecla `F` para centrar la cámara (sin selección encuadra todo).
  - [x] R3 Inspector numérico (pos/rot°/escala), atajos Unreal (W/E/R/F/Supr), undo/redo, duplicar.
  - [x] R4 Escenas JSON (`SceneFileSchema`, `storage/scenes/`), importaciones persistentes (`POST /api/storage/upload`).
  - [x] R5 Floor: pivote centrado corregido, raycast desde el objeto, colisionador de World Labs, calibración manual.
  - [x] R6 Modo presentación (`H`), captura PNG, presets de iluminación, ayuda `?`.
  - [x] R7 Selector de modo de generación (`all` / `world` / `objects`), prompt LLM unificado (`llmPrompt.ts`), ids únicos por job en `objects`.
  - [x] `/test`: shared 13, server 41, client 49 (103 en total) + E2E CDP en Chrome + prueba con colisionador real del Parque Infantil.
  - [x] `/code-simplify`: revisión por pases (bugs/seguridad/cumplimiento), `useFavorites` corregido, helpers `halfHeightOf` / `disposeEnvironmentMesh`, `any` eliminado, `ARCHITECTURE.md` actualizado.
  - [x] Docs: README (en/es), CHANGELOG (en/es), versión 0.4.0 en todos los paquetes.

### Deuda Técnica (detectada en 0.4.0)
- [ ] `WorldViewer3D.ts` supera las 1.800 líneas: extraer `history`, `camera` (foco/órbita) y `floor` a módulos propios.
- [ ] Tests de interacción de componentes React (clics, teclado) con Testing Library; hoy hay tests de render (`react-dom/server`) y el E2E por CDP es manual (scripts fuera del repo).
- [ ] Hash de contenido de subidas (sha1) lee el fichero entero en memoria: para mapas > 500 MB habría que hacer streaming.
- [ ] Selección múltiple y guardar el `WorldSpec` de jobs sin modelos (hoy se omiten assets sin `modelUrl` persistente).
- [ ] Escenas con modelos Tripo que solo tienen URL S3 firmada (caducan) si no se llegaron a descargar a `storage/models`.

---

## 🔄 Context Snapshot / Snapshot de Contexto

> **Last update / Última actualización:** 2026-10-16
> **Exact point / Punto exacto:** v0.4.0 construida, probada y documentada. Sin commit/tag (el directorio no es un repo git).
> **Pending / Pendiente:** Reiniciar el servidor local para cargar los endpoints nuevos; ensayo de la demo; `git init` + commit + tag `v0.4.0` si se desea.
> **Next step / Próximo paso:** Ejecutar `start.cmd`, abrir `http://localhost:3000` y ensayar: mundo → modelos → Scenes/Save → recargar → Scenes/Load → `H`.
