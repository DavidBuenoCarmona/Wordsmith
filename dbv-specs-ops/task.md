# Backlog - Wordsmith MVP (AI-Native 3D World Generator)

## Contexto del Proyecto (Context Snapshot)
* **Objetivo**: Crear un MVP funcional de Wordsmith capaz de convertir un prompt en lenguaje natural en una escena 3D compuesta y explorable en el navegador, integrando generación de entornos (World Labs) y assets (Tripo) mediante un orquestador backend en TypeScript con visor Three.js.
* **Estado actual**: ENTREGA COMPLETADA (`/ship`). Todas las fases (0, 1, 2 y 3) implementadas, probadas y documentadas.
* **Última decisión técnica**: Monorepo de 3 capas (`@wordsmith/shared`, `@wordsmith/server`, `@wordsmith/client`) completamente funcional con 14 tests pasando (unitarios, integración y evals).
* **Próximo paso**: Ejecución en local con `npm run dev:server` y `npm run dev:client` para pruebas manuales, o incorporación de API keys reales cuando estén disponibles.

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

---

## 🔄 Context Snapshot / Snapshot de Contexto

> **Last update / Última actualización:** 2026-09-17
> **Exact point / Punto exacto:** MVP de Wordsmith completamente construido, verificado y documentado (14 tests pasando).
> **Pending / Pendiente:** Ninguno para el alcance del MVP.
> **Next step / Próximo paso:** Probar la experiencia interactiva en `http://localhost:3000`.
