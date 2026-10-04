# Wordsmith 🌍✨

> **AI-Native 3D World Director** — Transforma un único prompt en lenguaje natural en un mundo 3D compuesto, interactivo y explorable en el navegador.

[![English README](https://img.shields.io/badge/Language-English%20(Primary)-blue.svg)](./README.md)
[![Changelog](https://img.shields.io/badge/Changelog-v0.3.0-orange.svg)](./CHANGELOG.es.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg)](https://threejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-Backend-white.svg)](https://fastify.io/)
[![Built with dbv-specs-ops](https://img.shields.io/badge/Built%20with-dbv--specs--ops-emerald.svg)](https://github.com/davidbuenov/dbv-specs-ops)

---

> 📖 **Read in English**: [English README](./README.md) · [English Changelog](./CHANGELOG.md)  
> 📜 **Registro de Cambios**: [Changelog en Español](./CHANGELOG.es.md)

---

## 🎯 ¿Qué es Wordsmith?

Crear un mundo 3D coherente suele requerir múltiples herramientas complejas, descarga manual de assets e integración tediosa en motores gráficos. **Wordsmith** actúa como un director de creación:

1. **Interpretación:** Un LLM analiza tu prompt y descompone la escena en un contrato estructurado (`WorldSpec`).
2. **Generación Coordinada:**
   - **World Labs (Marble):** Genera el entorno base y terreno en Gaussian Splatting 3D (`.spz`).
   - **Tripo 3D:** Genera los props, personajes y estructuras en formato GLB.
3. **Composición Espacial Automática:** El motor calcula anclajes, escalas, rotaciones y elevación al terreno.
4. **Exploración Web & Manipulación:** Visualización interactiva en tiempo real con Three.js + SparkRenderer, controles de cámara libres (WASD + mouse), gizmos de transformación (`TransformControls`) y soporte para monitores 3D autoestereoscópicos **JupiterSR**.

---

## 🏗️ Arquitectura del Monorepo

```text
Wordsmith/
├── packages/
│   ├── shared/    # Esquemas Zod (WorldSpec, JobState, Eventos) y tipos TS
│   ├── server/    # Backend orquestador Fastify con SSE, fallback de LLMs y arquitectura hexagonal
│   └── client/    # Frontend React + Three.js + SparkRenderer + JupiterSR SDK + TailwindCSS
├── dbv-specs-ops/ # Documentación formal SDD (Specs, Arquitectura, Backlog)
└── package.json   # Configuración de workspaces npm
```

---

## 🚀 Guía de Instalación y Configuración Paso a Paso

### 1. Prerrequisitos
- **Node.js**: `>= 20.11.0` (LTS recomendado)
- **npm**: `>= 10.x`
- **Git**

### 2. Clonar el Repositorio e Instalar Dependencias

```bash
# Clonar el repositorio
git clone https://github.com/davidbuenov/Wordsmith.git
cd Wordsmith

# Instalar todas las dependencias del monorepo
npm install
```

### 3. Configuración del Entorno y Claves de API

Wordsmith está diseñado para funcionar tanto con servicios reales de Inteligencia Artificial como en **modo Mock 100% offline**.

#### Paso 3.1: Crear el archivo `.env`

Copiá la plantilla de variables de entorno en la raíz del proyecto:

```bash
# En Linux / macOS:
cp .env.example .env

# En Windows (PowerShell / Command Prompt):
copy .env.example .env
```

#### Paso 3.2: Configurar las Claves de API

Abrí `.env` en tu editor de texto y completá las credenciales de los servicios que quieras utilizar:

```env
# =============================================================================
# Configuración de Red del Servidor
# =============================================================================
PORT=3001
HOST=0.0.0.0

# =============================================================================
# 1. Proveedores LLM (Configurá al menos UNO para descomposición en vivo)
# Jerarquía: OpenAI -> Anthropic -> Gemini -> Mock Offline
# =============================================================================
# OpenAI: https://platform.openai.com/api-keys (utiliza GPT-4o-mini)
OPENAI_API_KEY=sk-proj-...

# Anthropic: https://console.anthropic.com/settings/keys (utiliza Claude 3.5 Sonnet)
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini: https://aistudio.google.com/app/apikey (utiliza Gemini 1.5 Flash)
GEMINI_API_KEY=AIzaSy...

# =============================================================================
# 2. Generación de Entornos 3D (World Labs Marble)
# https://worldlabs.ai/
# =============================================================================
WORLD_LABS_API_KEY=wl-...
WORLD_LABS_BASE_URL=https://api.worldlabs.ai
WORLD_LABS_POLL_INTERVAL_MS=3000
WORLD_LABS_MAX_RETRIES=40

# =============================================================================
# 3. Generación de Modelos 3D (Tripo 3D)
# https://platform.tripo3d.ai/
# =============================================================================
TRIPO_API_KEY=tsk_...
TRIPO_BASE_URL=https://api.tripo3d.ai/v2/openapi
TRIPO_POLL_INTERVAL_MS=2500
TRIPO_MAX_RETRIES=60
```

> 💡 **Modo Offline / Mock:**  
> Si no contás con claves de API, simplemente dejalas vacías en `.env`. Wordsmith lo detecta automáticamente y activa adaptadores Mock deterministas con modelos y entornos 3D precargados en caché local, permitiéndote probar toda la interfaz, el visor 3D y la composición espacial sin costo alguno.

---

## 💻 Ejecución en Desarrollo

### Opción A: Scripts Multiplataforma (Recomendado)

- **Windows:** Hacé doble clic o ejecutá `start.cmd` en la terminal para abrir el backend y el frontend en procesos dedicados. Para detenerlos, ejecutá `stop.cmd`.
- **macOS / Linux:** Ejecutá `chmod +x *.sh` una vez, y luego `./start.sh` para iniciar en segundo plano. Para detenerlos, ejecutá `./stop.sh`.

### Opción B: Ejecución Manual con npm

En dos terminales separadas:

```bash
# Terminal 1: Iniciar Backend Orquestador (Puerto 3001)
npm run dev:server

# Terminal 2: Iniciar Frontend Web (Puerto 3000)
npm run dev:client
```

Abrí **`http://localhost:3000`** en tu navegador web.

---

## 🕶️ Guía de Uso 3D Autoestereoscópico (JupiterSR)

Wordsmith cuenta con integración completa con monitores 3D autoestereoscópicos (3D sin gafas) mediante el **Jupiter Interlace SDK**.

### ¿Cómo Funciona?
Los monitores JupiterSR utilizan una lámina de microlentes lenticulares inclinadas que proyectan diferentes canales de subpíxeles a cada ojo, permitiendo percibir profundidad real y paralaje de movimiento sin necesidad de gafas ni visores VR.

### Modos y Controles

- **Jupiter 3D: OFF (Modo 2D Estándar):** Renderizado directo nativo de alta resolución en Three.js con máxima nitidez y rendimiento para Gaussian Splats (`SparkRenderer`) y mallas GLTF.
- **Jupiter 3D: ON (Modo 3D Entrelazado):** Array de cámaras sintéticas que genera patrones de subpíxeles entrelazados en tiempo real alineados con las lentes ópticas del monitor.

### Parámetros de Calibración y Render

Hacé clic en el **icono de deslizadores** junto al botón 3D para abrir el panel de configuración:

#### 1. Pestaña de Render & Paralaje
- **Vistas Renderizadas (1–30):** Cantidad de ángulos de cámara calculados por fotograma.
  - `9 vistas`: Alta fluidez y excelente tasa de FPS (recomendado por defecto).
  - `30 vistas`: Máxima suavidad y fidelidad de paralaje al mover la cabeza.
- **Ancho de Vista (`viewWidth` en px):** Resolución del búfer por vista (100–1920px, defecto `640px`).
- **Separación de Cámaras (`viewSpacing`):** Distancia interpupilar virtual. Ajusta la intensidad del efecto 3D y la separación estéreo.
- **Distancia de Foco (`focusDistance` / Plano Zero-Parallax):** Plano donde la imagen converge en la superficie física de la pantalla. Los objetos más cercanos saltan hacia afuera de la pantalla; los objetos más lejanos se adentran en el fondo.
- **Tone Mapping & Exposición:** Mapeo tonal seleccionable (`aces`, `reinhard` o `none`).

#### 2. Pestaña de Calibración Óptica
- **Pitch:** Relación exacta de inclinación y paso de la lámina lenticular física (ej. `0.27777`).
- **Tan:** Tangente óptica del ángulo de las lentes (defecto `10`).
- **Offset:** Desfase de subpíxel para sincronizar las vistas con los ojos del usuario.
- **Orden de Vistas (`order`):** Secuencia de progresión (`forward`, `reverse`, `pingpong`).
- **Subpíxeles (`subpixelOrder`):** Distribución de subpíxeles del panel físico (`RGB` o `BGR`).
- **Rotación (`rotation`):** Ajuste de orientación del panel (`0°`, `90°`, `180°`, `270°`).

### Buenas Prácticas de Calibración y Perfiles
1. **Usar Pantalla Completa:** Para que los subpíxeles virtuales coincidan exactamente 1:1 con los subpíxeles físicos del display, activá **Fullscreen** (botón en el modal o tecla `F11`).
2. **Exportar Perfil:** Guardá tu calibración personalizada en formato `.json` (`jupiter-sr-profile-<timestamp>.json`).
3. **Importar Perfil:** Cargá perfiles preconfigurados para distintos modelos de monitores Jupiter.
4. **Persistencia Automática:** Toda la configuración se guarda automáticamente en el `localStorage` de tu navegador.

---

## 🎮 Navegación 3D y Manipulación de Escena

- **Cámara Libre:** Clic y arrastre con el mouse para orientar la vista; teclas `W`, `A`, `S`, `D` para desplazarte en el espacio.
- **Selección de Assets:** Clic en cualquier objeto 3D de la escena o desde el panel de inspección.
- **Gizmo de Transformación:**
  - `Modo Traslación`: Mover objetos en los ejes X, Y, Z.
  - `Modo Rotación`: Rotación suave del modelo.
  - `Pegar al Suelo (Snap to Ground)`: Ancla automáticamente objetos flotantes a la altura del suelo (`Y = -1.5m`).

---

## 🧪 Tests y Evals

El proyecto cuenta con suites de pruebas unitarias, integración, evals de prompts y transformaciones 3D:

```bash
# Ejecutar todos los tests en todos los paquetes del monorepo
npm test
```

---

## 📄 Licencia

Este proyecto está bajo la Licencia **MIT**. Consulta el archivo `LICENSE` para más detalles.  
Desarrollado por **David Bueno Carmona** con el framework SDD [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops).
