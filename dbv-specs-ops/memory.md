# 🧠 Memory & Context

> **Frontera de uso (Memory vs. Tasks):**
> - `task.md` → progreso **operativo**: checklist de tareas, Snapshot de Contexto (el paso exacto siguiente), y estado de la sesión.
> - `memory.md` → contexto **cualitativo y temático**: conocimiento persistente, decisiones técnicas profundas, lecciones, y el área del producto en foco (no el paso específico).
> Si hay info que sirva para los dos, prioriza: datos con fecha/paso exacto → `task.md`; razonamiento/por-qué/lecciones → `memory.md`.
>
> *Instrucción para la IA: Consulta este archivo al inicio de cada sesión para recuperar el hilo técnico. Actualiza las secciones correspondientes cuando el workflow lo indique (triggers en `/plan`, `/build`, `/test` y gate en `/ship`).*

## 🎯 Contexto Activo
- **Estado actual del desarrollo:** v0.4.0 (autoría y persistencia de escenas + modos de generación) entregada; monorepo de 3 capas con 103 tests y E2E manual por CDP en verde.
- **Foco inmediato:** Demo ante jurado (concurso 2026-10-17): guardar/cargar escenas, Outliner, modo presentación. Después: refactor de `WorldViewer3D.ts` (ver Deuda Técnica en `task.md`).

## 🏗️ Log de Decisiones Técnicas (ADR Ligero)
*Registro de por qué se tomaron ciertas rutas (ej. cambios en librerías, arquitectura o patrones).*

- **2026-09-17 - Arquitectura del MVP de Wordsmith (v0.2.0):** Implementación de monorepo modular de 3 paquetes (`@wordsmith/shared`, `@wordsmith/server`, `@wordsmith/client`). Se optó por arquitectura hexagonal en el backend Fastify con adaptadores Mock deterministas y eventos SSE para desacoplar el pipeline de generación del protocolo de transporte y permitir desarrollo reproducible sin consumo de APIs de pago. En el frontend, React 18 con Three.js renderiza y compone props según el contrato `WorldSpec`.

- **2026-10-16 - Persistencia de escenas como JSON y visor como fuente de verdad (v0.4.0):** Una escena guardada es un fichero JSON simple (mundo + modelos con posición/rotación/escala + cámara) validado con `SceneFileSchema` (`@wordsmith/shared`) y almacenado en `storage/scenes/`. Se descartó guardar el `WorldSpec` del job porque los modelos añadidos a mano no pertenecen a ningún job; el Outliner y `serializeModels()` leen del visor. Los archivos importados se suben a `storage/` (nombre = slug + hash sha1) y se referencian por URL persistente; las URLs `blob:` se omiten con aviso. Reemplaza al `AssetInspector`.
- **2026-10-16 - Estrategia de suelo (Floor):** prioridad suelo manual > malla de colisión de World Labs (`colliderUrl`) > malla del entorno > suelo base. El rayo parte de lo alto del propio objeto (primera superficie hacia arriba bajo él), no de 150 m. El colisionador se descarga invisible y su orientación se valida con la caja envolvente (debe contener el origen de cámara); si no encaja se descarta. Atajos alineados con Unreal (W/E/R/F), por lo que WASD solo vuela con el ratón pulsado o sin selección.

- **2026-10-16 - Modo de generación (`all` | `world` | `objects`):** el modo viaja en `WorldPromptInput` y `GenerationJob`; `WorldSpec.assets` admite 0 elementos (modo escenario). El orquestador normaliza la salida del LLM por modo (`normalizeSpec`): en `objects` salta World Labs y renombra ids con sufijo del job (`saveTripo` escribe `<slug>_<id>.glb`: ids repetidos sobrescribirían modelos que ya usan escenas guardadas). El prompt del LLM se extrajo a `llmPrompt.ts` (antes triplicado). El cliente aplica cada job una sola vez (`appliedJobRef`); `objects` usa `spawnModelsInFront`, no `applyWorldSpec` (que borraría objetos no marcados como `isUserSpawned`).

## ⚠️ Lecciones Aprendidas / Errores Evitados
*Notas sobre bugs específicos, configuraciones que fallaron o refactors intentados para no repetirlos.*

- **[Testing Headless de Three.js]**: En entornos headless de Vitest donde WebGL no está disponible nativamente, desacoplar la creación de geometrías de la inicialización de `WebGLRenderer` permite verificar la lógica de composición espacial sin mocks complejos de contexto gráfico.
- **[Suscripción SSE Resiliente]**: El cliente web debe manejar reconexiones automáticas y parseo de eventos por chunk en Server-Sent Events para evitar bloquear la interfaz si un paquete de progreso llega fragmentado.

- **[Pivote centrado vs. altura completa]**: los modelos tienen el pivote en su centro (para que el gizmo salga del centro visual), así que apoyarlos con `suelo + altura` los dejaba flotando media altura. Usar siempre `suelo + (pivote − base)` calculado con `Box3` (escala y rotación incluidas). Los tests antiguos codificaban el bug (`+1.0`) y se corrigieron a `+0.5`.
- **[Raycast sobre Gaussian Splats]**: un `SplatMesh` no tiene triángulos ni normales; el raycast devuelve impactos erráticos. Usar la malla de colisión que entrega World Labs.
- **[Inputs numéricos en React]**: confirmar con Enter llamando solo a `blur()` no es fiable (no dispara el commit si la ventana no tiene el foco). Confirmar explícitamente en Enter y proteger contra doble commit (Enter + blur). Detectado por el E2E en Chrome headless.
- **[Verificar con el navegador real]**: Chrome headless + CDP (sin dependencias, `--use-angle=swiftshader`) basta para un E2E de humo; los Gaussian Splats no se dibujan sin GPU real, pero la lógica (colisionador, floor, escenas) sí se puede verificar.
- **[Dos Vite a la vez]**: con el 3000 ocupado Vite saltaba al 3001 (puerto del backend) y su proxy se llamaba a sí mismo en bucle (ENOBUFS: todo `/api` colgado). Solución: `strictPort: true` en `vite.config.ts`.
- **[Pruebas con claves reales]**: `npm run dev:server` carga `.env` con claves reales (OpenAI/Tripo/World Labs). Para E2E arrancar `npx tsx src/index.ts` con `env -u ...` sin claves (usa Mock providers) y comprobar los logs `🧪` antes de generar.
- **[Puertos de desarrollo]**: el usuario suele tener `start.cmd` activo (3000/3001) con el código antiguo; probar en puertos alternativos (`PORT`, `--port`, `WORDSMITH_API_TARGET`, `WORDSMITH_STORAGE_DIR`) para no tocar su instancia ni su `storage/`.

## 🗺️ Mapa de Relaciones
*Breve descripción de cómo interactúan los módulos actuales para ayudar a la IA a navegar el código.*

- **`@wordsmith/shared`**: Fuente única de verdad para contratos Zod y tipos TypeScript compartidos entre cliente y servidor.
- **`@wordsmith/server`**: Recibe prompts, orquesta generación mediante microtareas asíncronas y emite estado en tiempo real vía SSE. Depende de `@wordsmith/shared`.
- **`@wordsmith/client`**: Consume endpoints y stream SSE del servidor, gestiona estado de UI y renderiza la escena 3D con Three.js. Depende de `@wordsmith/shared`.
  - `viewer/WorldViewer3D.ts`: visor + edición (selección, gizmo, historial, foco, suelo, iluminación, órbita). `App.tsx` orquesta; `components/OutlinerPanel.tsx` + `NumberField.tsx` (inspector), `SceneSelector.tsx`, `WorldSelector.tsx`/`ModelSelector.tsx` (pins), `hooks/useEditorShortcuts.ts`, `hooks/useFavorites.ts`, `api/storage.ts`.
- **`@wordsmith/server` / storage**: `GenerationStorage` gestiona `storage/worlds`, `storage/models`, `storage/scenes`, `storage/favorites.json` y las cachés de generaciones; rutas `/api/storage/*` en `server.ts`.

---

## 🧹 Política de Mantenimiento

*Aplicar en cada `/ship` de tipo Major, o cuando este fichero supere las 200 líneas activas:*

- **Consolida** decisiones relacionadas en una sola entrada.
- **Archiva** lecciones ya internalizadas en el código: muévelas a `memory.archive.md` (créalo si no existe).
- **Elimina** entradas que describan decisiones revertidas o ya obsoletas.
- **Objetivo:** mantener `memory.md` por debajo de ~200 líneas activas para que la IA pueda leerlo íntegramente en cada sesión sin pérdida de atención.
