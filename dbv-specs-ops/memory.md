# 🧠 Memory & Context

> **Frontera de uso (Memory vs. Tasks):**
> - `task.md` → progreso **operativo**: checklist de tareas, Snapshot de Contexto (el paso exacto siguiente), y estado de la sesión.
> - `memory.md` → contexto **cualitativo y temático**: conocimiento persistente, decisiones técnicas profundas, lecciones, y el área del producto en foco (no el paso específico).
> Si hay info que sirva para los dos, prioriza: datos con fecha/paso exacto → `task.md`; razonamiento/por-qué/lecciones → `memory.md`.
>
> *Instrucción para la IA: Consulta este archivo al inicio de cada sesión para recuperar el hilo técnico. Actualiza las secciones correspondientes cuando el workflow lo indique (triggers en `/plan`, `/build`, `/test` y gate en `/ship`).*

## 🎯 Contexto Activo
- **Estado actual del desarrollo:** Release v0.2.0 empaquetado y listo para commit/tag. Monorepo de 3 capas con 14 tests y evals pasando.
- **Foco inmediato:** Pruebas interactivas en navegador y posterior integración de providers reales (World Labs y Tripo APIs).

## 🏗️ Log de Decisiones Técnicas (ADR Ligero)
*Registro de por qué se tomaron ciertas rutas (ej. cambios en librerías, arquitectura o patrones).*

- **2026-09-17 - Arquitectura del MVP de Wordsmith (v0.2.0):** Implementación de monorepo modular de 3 paquetes (`@wordsmith/shared`, `@wordsmith/server`, `@wordsmith/client`). Se optó por arquitectura hexagonal en el backend Fastify con adaptadores Mock deterministas y eventos SSE para desacoplar el pipeline de generación del protocolo de transporte y permitir desarrollo reproducible sin consumo de APIs de pago. En el frontend, React 18 con Three.js renderiza y compone props según el contrato `WorldSpec`.

## ⚠️ Lecciones Aprendidas / Errores Evitados
*Notas sobre bugs específicos, configuraciones que fallaron o refactors intentados para no repetirlos.*

- **[Testing Headless de Three.js]**: En entornos headless de Vitest donde WebGL no está disponible nativamente, desacoplar la creación de geometrías de la inicialización de `WebGLRenderer` permite verificar la lógica de composición espacial sin mocks complejos de contexto gráfico.
- **[Suscripción SSE Resiliente]**: El cliente web debe manejar reconexiones automáticas y parseo de eventos por chunk en Server-Sent Events para evitar bloquear la interfaz si un paquete de progreso llega fragmentado.

## 🗺️ Mapa de Relaciones
*Breve descripción de cómo interactúan los módulos actuales para ayudar a la IA a navegar el código.*

- **`@wordsmith/shared`**: Fuente única de verdad para contratos Zod y tipos TypeScript compartidos entre cliente y servidor.
- **`@wordsmith/server`**: Recibe prompts, orquesta generación mediante microtareas asíncronas y emite estado en tiempo real vía SSE. Depende de `@wordsmith/shared`.
- **`@wordsmith/client`**: Consume endpoints y stream SSE del servidor, gestiona estado de UI y renderiza la escena 3D procedural con Three.js. Depende de `@wordsmith/shared`.

---

## 🧹 Política de Mantenimiento

*Aplicar en cada `/ship` de tipo Major, o cuando este fichero supere las 200 líneas activas:*

- **Consolida** decisiones relacionadas en una sola entrada.
- **Archiva** lecciones ya internalizadas en el código: muévelas a `memory.archive.md` (créalo si no existe).
- **Elimina** entradas que describan decisiones revertidas o ya obsoletas.
- **Objetivo:** mantener `memory.md` por debajo de ~200 líneas activas para que la IA pueda leerlo íntegramente en cada sesión sin pérdida de atención.
