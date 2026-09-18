# 🏗 Arquitectura Técnica: Wordsmith

> **Fase:** `/plan` (Planificación Técnica)
> **Estado:** Validado
> **Última Revisión:** 2026-09-17

---

## 🛠 Stack Tecnológico

| Capa | Tecnología | Justificación |
| --- | --- | --- |
| **Lenguaje** | TypeScript 5.x (ESM) | Tipado estático de punta a punta, contratos compartidos entre frontend y backend. |
| **Frontend & 3D** | React + Vite + Three.js / Spark | Renderizado 3D de alta performance en navegador (WebGL/WebGPU), soporte GLB/glTF y Gaussian Splatting. |
| **Backend Orquestador** | Node.js + Fastify (o Express) + Zod | Arquitectura asíncrona no bloqueante para coordinar jobs largos con APIs externas de IA y resguardar API keys. |
| **Persistencia & Jobs** | SQLite (Better-SQLite3 / Drizzle ORM) | Almacenamiento local liviano para estados de generación, trazabilidad de jobs y caché de assets sin sobrecarga de infraestructura. |
| **Estilos UI** | TailwindCSS + Lucide Icons | UI minimalista y limpia enfocada en el prompt y el viewport 3D interactivo. |
| **Testing** | Vitest + Testing Library | Suite rápida para testing unitario, validación de esquemas Zod y evals de prompts/orquestación. |
| **CI/CD** | GitHub Actions | Automatización de linting, typechecking y tests de integración. |

---

## 📂 Estructura de Directorios

```text
/
├── packages/
│   ├── shared/                # Tipos compartidos, esquemas Zod (WorldSpec, AssetSpec, etc.)
│   │   └── src/
│   ├── server/                # Backend Orquestador
│   │   ├── src/
│   │   │   ├── domain/        # Lógica de orquestación pura y reglas de composición
│   │   │   ├── application/   # Casos de uso (GenerateWorldUseCase, PollStatusUseCase)
│   │   │   ├── infrastructure/# Adaptadores de API (WorldLabsProvider, TripoProvider, LLMProvider, SQLite)
│   │   │   └── interfaces/    # Endpoints HTTP/SSE (Fastify routes, schemas)
│   │   └── tests/
│   └── client/                # Frontend Web & Visor 3D
│       ├── src/
│       │   ├── components/    # Componentes UI (PromptBar, ProgressOverlay, Controls)
│       │   ├── viewer/        # Lógica de Three.js / Spark (SceneManager, AssetLoader, CameraController)
│       │   ├── hooks/         # Custom hooks para polling y estado de generación
│       │   └── state/         # Gestión de estado de UI y escena 3D
│       └── tests/
├── dbv-specs-ops/             # Documentación y control SDD del proyecto
└── [config files]             # package.json (monorepo/workspaces), tsconfig.json, .env.example
```

---

## 🔑 Decisiones Técnicas Clave

### Seguridad y Aislamiento de Claves

- **API Keys:** Las credenciales de World Labs, Tripo y LLM residen **exclusivamente en el backend** vía `.env`.
- **Exposición al Cliente:** El cliente nunca interactúa directamente con los proveedores externos; consume endpoints autenticados o identificados por `generationId`.
- **Validación de Entradas:** Validación estricta con Zod en el backend para sanear prompts y validar los JSON intermedios generados por el LLM antes de disparar tareas a las APIs.

### Estilo de Código y Patrones

- **Tipado Estricto:** `strict: true` en TypeScript. Prohibido el uso de `any`.
- **Manejo de Errores:** Patrón Result (`ok` / `err`) o clases de error tipadas para evitar fallos silenciosos en llamadas asíncronas a APIs externas.
- **Funciones Puras:** Descomposición de la composición espacial (cálculo de coordenadas, bounding boxes y escalas) en funciones matemáticas puras y testeadas.

### Gestión de Estado y Asincronía

- **Backend:** Manejo de ciclo de vida de generación mediante estados finitos (`ANALYZING`, `GENERATING_WORLD`, `GENERATING_ASSETS`, `COMPOSING`, `COMPLETED`, `FAILED`) persistidos en SQLite.
- **Comunicación en Tiempo Real:** SSE (Server-Sent Events) o Polling inteligente desde el cliente hacia el orquestador para informar el progreso al usuario sin bloquear la interfaz.
- **Frontend:** Estado local reactivo (Zustand o Context modular) desacoplado del loop de renderizado 3D de Three.js.

---

## 🔗 Integraciones Externas

| Servicio | Propósito | Notas / Límites |
| --- | --- | --- |
| **LLM Provider** (OpenAI / Anthropic / Gemini) | Análisis e interpretación del prompt en especificación estructurada JSON | Requiere salida en formato JSON estricto (`json_schema` / structured outputs). |
| **World Labs API** | Generación del entorno/mundo base 3D | Proceso asíncrono. Retorna escena (Gaussian Splat / Mesh). |
| **Tripo 3D API** | Generación de assets y props específicos en 3D | Proceso asíncrono. Retorna modelos 3D en formato GLB/glTF. |

---

## ⚠️ Restricciones y Riesgos Técnicos

- **Riesgo:** Integración de formatos heterogéneos (World Labs Mesh/Splat + Tripo GLB).
  - **Mitigación:** Capa de composición (`World Builder`) que gestiona transformaciones (posición, rotación, escala) y anclaje de assets dentro del canvas 3D unificado de Three.js / Spark.
- **Riesgo:** Latencia alta o fallos transitorios en APIs externas durante la generación.
  - **Mitigación:** Arquitectura orientada a jobs desacoplados con reintentos exponenciales, timeouts configurables y estado transparente en la UI.
- **Riesgo:** Consumo excesivo de créditos de API en desarrollo.
  - **Mitigación:** Modo Mock/Stub integrado en los proveedores (`MockWorldLabsProvider`, `MockTripoProvider`) para testing local y desarrollo de UI sin quemar tokens ni créditos.

---

## 🤖 Agent Harness (Arnés del Agente)

### 1. Gestión de Contexto (Context Engineering)
- **Contexto Estático:** `CLAUDE.md`, `GEMINI.md`, `dbv-specs-ops/memory.md` y `dbv-specs-ops/docs/SPECIFICATIONS.md` cargados al inicio.
- **Contexto Dinámico / Skills:** Skills especializadas para interpretación de prompts 3D, validación de escenas y testing de composición.

### 2. Herramientas y MCP (Model Context Protocol)
- **Servidores MCP Requeridos:** Filesystem, SQLite (inspección de base de datos de jobs) y herramientas HTTP para testing de endpoints.

### 3. Entorno de Ejecución (Sandboxing)
- **Aislamiento:** Entorno local Node.js v20+ con workspaces pnpm/npm.
- **Límites:** Máximo de 3 assets simultáneos por prompt en el MVP para acotar costes y tiempos de respuesta.

### 4. Guardrails Deterministas de Seguridad
- **Filtros de Código:** Linters (ESLint), Prettier y TypeScript check en pre-commit.
- **Detección de Secretos:** Bloqueo de commits si se detectan cadenas que coincidan con formatos de API keys.

### 5. Interfaz Externa para Agentes (Agent Readiness)
- **Autodescubrimiento:** `.well-known/agent-plugin/` con manifiesto estándar `plugin.json` y `mcp.json`.
- **Formato del Contenido:** Soporte para negociación `Accept: text/markdown` y `/llms.txt` estructurado.

---

**Instrucción para la IA:** Respeta las decisiones y configuraciones documentadas aquí. Cualquier cambio en las interfaces o contratos debe registrarse en `dbv-specs-ops/memory.md`.
