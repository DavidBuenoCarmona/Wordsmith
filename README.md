# Wordsmith 🌍✨

> **AI-Native 3D World Director** — Transform a single natural language prompt into an interactive, composed 3D world explorable directly in your web browser.

[![Español README](https://img.shields.io/badge/Idioma-Español%20(Secundario)-emerald.svg)](./README.es.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-cyan.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL-black.svg)](https://threejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-Backend-white.svg)](https://fastify.io/)
[![Built with dbv-specs-ops](https://img.shields.io/badge/Built%20with-dbv--specs--ops-emerald.svg)](https://github.com/davidbuenov/dbv-specs-ops)

---

> 🇪🇸 **Leer en Español**: [README en Español](./README.es.md)

---

## 🎯 What is Wordsmith?

Building coherent 3D scenes typically demands navigating multiple separate DCC tools, manually downloading assets, and tedious placement inside graphics engines. **Wordsmith** acts as an AI spatial director:

1. **Semantic Interpretation:** An LLM analyzes your prompt and decomposes the scene into a strongly-typed contract (`WorldSpec`).
2. **Coordinated Generation:**
   - **World Labs (Marble):** Generates the environment and terrain in 3D Gaussian Splatting (`.spz`).
   - **Tripo 3D:** Generates individual props, characters, and structures as GLB meshes.
3. **Automated Spatial Composition:** The placement engine computes bounding boxes, scales, rotations, and snaps props to the ground terrain.
4. **Interactive Web Exploration & Manipulation:** Real-time rendering via Three.js + SparkRenderer, free-flight camera controls (WASD + mouse), interactive transform gizmos (`TransformControls`), and autostereoscopic 3D support for **JupiterSR** displays.

---

## 🏗️ Monorepo Architecture

```text
Wordsmith/
├── packages/
│   ├── shared/    # Zod schemas (WorldSpec, JobState, Events) and shared TypeScript types
│   ├── server/    # Fastify orchestrator backend with SSE, LLM fallback hierarchy, and Hexagonal Architecture
│   └── client/    # React 18 + Three.js + SparkRenderer + JupiterSR SDK + TailwindCSS 3D viewer
├── dbv-specs-ops/ # Formal SDD framework documentation (Specs, Architecture, Backlog)
└── package.json   # Monorepo root npm workspaces configuration
```

---

## 🚀 Installation & Setup Guide

### 1. Prerequisites
- **Node.js**: `>= 20.11.0` (LTS recommended)
- **npm**: `>= 10.x`
- **Git**

### 2. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/davidbuenov/Wordsmith.git
cd Wordsmith

# Install all dependencies across the monorepo
npm install
```

### 3. API Keys & Environment Configuration

Wordsmith is designed to work with real AI generation services as well as in **100% offline mock mode**.

#### Step 3.1: Create your `.env` file

Copy the environment template in the project root:

```bash
# On Linux / macOS:
cp .env.example .env

# On Windows (PowerShell / Command Prompt):
copy .env.example .env
```

#### Step 3.2: Configure API Keys

Open `.env` in your text editor and fill in the credentials for the services you want to use:

```env
# =============================================================================
# Server Network Settings
# =============================================================================
PORT=3001
HOST=0.0.0.0

# =============================================================================
# 1. LLM Providers (Select at least ONE for live prompt decomposition)
# Hierarchy: OpenAI -> Anthropic -> Gemini -> Offline Mock
# =============================================================================
# OpenAI: https://platform.openai.com/api-keys (uses GPT-4o-mini)
OPENAI_API_KEY=sk-proj-...

# Anthropic: https://console.anthropic.com/settings/keys (uses Claude 3.5 Sonnet)
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini: https://aistudio.google.com/app/apikey (uses Gemini 1.5 Flash)
GEMINI_API_KEY=AIzaSy...

# =============================================================================
# 2. 3D Environment Generation (World Labs Marble)
# https://worldlabs.ai/
# =============================================================================
WORLD_LABS_API_KEY=wl-...
WORLD_LABS_BASE_URL=https://api.worldlabs.ai
WORLD_LABS_POLL_INTERVAL_MS=3000
WORLD_LABS_MAX_RETRIES=40

# =============================================================================
# 3. 3D Asset Generation (Tripo 3D)
# https://platform.tripo3d.ai/
# =============================================================================
TRIPO_API_KEY=tsk_...
TRIPO_BASE_URL=https://api.tripo3d.ai/v2/openapi
TRIPO_POLL_INTERVAL_MS=2500
TRIPO_MAX_RETRIES=60
```

> 💡 **Offline / Mock Mode:**  
> If you do not have API keys, simply leave them empty in `.env`. Wordsmith will automatically detect this and switch to deterministic mock providers with local cached 3D assets, allowing full testing of the UI, 3D viewer, and spatial composition without spending API credits.

---

## 💻 Running in Development

### Option A: Cross-Platform Scripts (Recommended)

- **Windows:** Double-click or execute `start.cmd` in your terminal. This opens the backend and frontend in separate processes. To stop them, execute `stop.cmd`.
- **macOS / Linux:** Run `chmod +x *.sh` once, then `./start.sh` to start background services. Run `./stop.sh` to terminate them.

### Option B: Manual npm Commands

In two separate terminal windows:

```bash
# Terminal 1: Start Backend Orchestrator (Port 3001)
npm run dev:server

# Terminal 2: Start Web Frontend (Port 3000)
npm run dev:client
```

Open **`http://localhost:3000`** in your browser.

---

## 🕶️ JupiterSR Autostereoscopic 3D Guide

Wordsmith includes full native support for **JupiterSR glasses-free autostereoscopic 3D displays** via the `jupiter-interlace-sdk`.

### How it Works
JupiterSR displays utilize slanted lenticular lens arrays that direct distinct subpixel color channels to each eye, producing true depth perception without 3D glasses or VR headsets.

### Modes & Controls

- **Jupiter 3D: OFF (Standard 2D Mode):** Direct WebGL rendering at native canvas resolution and device pixel ratio, providing maximum sharpness and performance for 3D Gaussian Splats (`SparkRenderer`) and GLTF meshes.
- **Jupiter 3D: ON (Interlaced 3D Mode):** Multi-view synthetic camera array generating interleaved subpixel patterns aligned to the physical lenticular lenses.

### Calibration & Render Parameters

Access the calibration panel by clicking the **Sliders icon** next to the 3D toggle:

#### 1. Render & Parallax Tab
- **Rendered Views (1–30):** Number of discrete camera angles rendered per frame. 
  - `9 views`: High performance and smooth frame rates (recommended default).
  - `30 views`: Maximum stereoscopic motion parallax fidelity.
- **View Width (px):** Buffer resolution per eye view (100–1920px, default `640px`).
- **View Spacing (Baseline):** Virtual interpupillary distance between cameras. Adjust to increase or decrease the perceived depth and 3D pop-out.
- **Focus Distance (Zero-Parallax Plane):** The focal distance where 3D elements have zero parallax (appear on the physical screen surface). Objects closer than this distance pop out in front of the screen; objects further away recede behind it.
- **Tone Mapping & Exposure:** Color mapping selection (`aces`, `reinhard`, or `none`).

#### 2. Optical Calibration Tab
- **Pitch:** Exact ratio and slant of the physical lenticular lens array (e.g., `0.27777`).
- **Tan:** Optical tangent of the lens angle (default `10`).
- **Offset:** Subpixel phase offset to align views with the observer's eyes.
- **View Order:** Optical progression sequence (`forward`, `reverse`, `pingpong`).
- **Subpixel Order:** Display hardware subpixel layout (`RGB` or `BGR`).
- **Rotation:** Panel orientation adjustment (`0°`, `90°`, `180°`, `270°`).

### Calibration Best Practices & Profiles
1. **Always Use Fullscreen:** For exact physical subpixel alignment, enter Fullscreen mode (using the button in the modal or `F11`).
2. **Export Profile:** Save your calibrated display configuration as a `.json` file (`jupiter-sr-profile-<timestamp>.json`).
3. **Import Profile:** Load pre-calibrated JSON profiles for different Jupiter monitor models instantly.
4. **Auto-Persistence:** Your active calibration is automatically persisted in browser `localStorage`.

---

## 🎮 3D Navigation & Scene Manipulation

- **Free-Flight Camera:** Click and drag with mouse to look around; use `W`, `A`, `S`, `D` keys to navigate through the 3D world.
- **Asset Selection:** Click on any 3D asset in the scene or inspector panel to select it.
- **Transform Gizmo:**
  - `Translate Mode`: Move assets along X, Y, Z axes.
  - `Rotate Mode`: Rotate assets smoothly.
  - `Snap to Ground`: Automatically drops floating objects to ground level (`Y = -1.5m`).

---

## 🧪 Testing & Evals

The codebase is covered by unit tests, integration tests, prompt evaluation suites, and 3D transform contracts:

```bash
# Run all test suites across the monorepo
npm test
```

---

## 📄 License

This project is licensed under the **MIT License**. See the `LICENSE` file for details.  
Created by **David Bueno Carmona** with the SDD framework [dbv-specs-ops](https://github.com/davidbuenov/dbv-specs-ops).
