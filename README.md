# Wordsmith 🌍✨

> **AI-Native 3D World Director** — Transforma un único prompt en lenguaje natural en un mundo 3D compuesto, interactivo y explorable en el navegador.

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg)](https://threejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-Backend-white.svg)](https://fastify.io/)
[![Built with dbv-specs-ops](https://img.shields.io/badge/Built%20with-dbv--specs--ops-emerald.svg)](https://github.com/davidbuenov/dbv-specs-ops)

---

## 🎯 ¿Qué es Wordsmith?

Crear un mundo 3D coherente suele requerir múltiples herramientas complejas, descarga manual de assets e integración tediosa en motores gráficos. **Wordsmith** actúa como un director de creación:

1. **Interpretación:** Un LLM analiza tu prompt y descompone la escena en un contrato estructurado (`WorldSpec`).
2. **Generación Coordinada:**
   - **World Labs:** Genera el entorno y terreno 3D base.
   - **Tripo 3D:** Genera los props, personajes y estructuras en formato GLB.
3. **Composición Automática:** El motor espacial calcula anclajes, escalas y rotaciones.
4. **Exploración Web:** Visualización interactiva en tiempo real con Three.js y controles de cámara.

---

## 🏗️ Arquitectura del Monorepo

```text
Wordsmith/
├── packages/
│   ├── shared/    # Esquemas Zod (WorldSpec, JobState, Eventos) y tipos TS
│   ├── server/    # Backend orquestador Fastify con SSE y arquitectura hexagonal
│   └── client/    # Frontend React + Three.js + TailwindCSS + Visor 3D
├── dbv-specs-ops/ # Documentación formal SDD (Specs, Arquitectura, Backlog)
└── package.json   # Configuración de workspaces npm
```

---

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js >= 20.x
- npm >= 10.x

### Instalación

```bash
# Clonar e instalar dependencias de todo el monorepo
npm install
```

### Ejecución en Desarrollo

#### Opción A: Scripts Multiplataforma (Recomendado)

- **Windows:** Ejecuta `start.cmd` para iniciar backend y frontend en ventanas dedicadas. Para detenerlos, ejecuta `stop.cmd`.
- **macOS / Linux:** Ejecuta `./start.sh` para iniciar los procesos en segundo plano. Para detenerlos, ejecuta `./stop.sh`.

#### Opción B: Ejecución Manual con npm

En dos terminales separadas:

```bash
# 1. Iniciar Backend Orquestador (Puerto 3001)
npm run dev:server

# 2. Iniciar Frontend Web (Puerto 3000 con proxy a API)
npm run dev:client
```

Abre `http://localhost:3000` en tu navegador para interactuar con la experiencia.

---

## 🧪 Tests y Evals

El proyecto cuenta con suites de pruebas unitarias, integración y evals de prompts:

```bash
# Ejecutar todos los tests en todos los paquetes
npm test
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.
Desarrollado por **David Bueno Carmona** con el framework SDD [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops).
