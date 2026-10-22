// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { GenerationMode, WorldPromptInput } from '@wordsmith/shared';

const ENVIRONMENT_RULES = `4. environment:
   - prompt: Prompt en inglés hiper-detallado y optimizado para World Labs enfocado EXCLUSIVAMENTE en terreno, paisaje, vegetación, atmósfera, cielo e iluminación (ej: "Vast grassy park landscape with winding gravel paths, lush trees, gentle rolling hills under clear daylight"). IMPORTANTE: El entorno NO debe incluir ninguna estructura artificial, edificios, juegos infantiles, columpios, vehículos, muebles, personas ni animales (esos elementos serán generados individualmente como assets 3D por Tripo).
   - theme: Identificador corto en kebab-case (ej: "pirate-bay").
   - lighting: Uno de ["day", "sunset", "night", "foggy", "dramatic"].
   - skyboxColor: Color hexadecimal (ej: "#87ceeb", "#ff7f50").`;

const ASSET_FIELDS = `   - id: Identificador único en kebab-case (ej: "treasure-chest-1").
   - name: Nombre en español (ej: "Cofre del Tesoro").
   - prompt: Prompt en inglés para Tripo 3D (ej: "Wooden treasure chest with gold coins, 3d game asset").
   - category: Uno de ["prop", "character", "architecture", "nature", "vehicle"].
   - position: { x, y, z } coordenadas espaciales relativas al centro (x entre -8 y 8, z entre -8 y 8, y en 0 para suelo).
   - rotation: { x, y, z } rotación en radianes (por defecto 0).
   - scale: { x, y, z } escala relativa (típicamente 1, 1, 1).
   - anchorToGround: true`;

/** Regla 4/5 del WorldSpec según lo que el usuario quiere que genere la IA. */
function modeRules(input: WorldPromptInput): string {
  const mode: GenerationMode = input.mode;
  let rules: string;

  if (mode === 'world') {
    rules = `${ENVIRONMENT_RULES}
5. assets: DEBE ser una lista vacía []. El usuario solo quiere generar el escenario; no inventes objetos.`;
  } else if (mode === 'objects') {
    rules = `4. environment: El usuario YA tiene un mundo cargado y solo quiere objetos nuevos. Rellena environment con valores neutros: prompt "Existing world, not generated", theme "existing-world", lighting "day", skyboxColor "#87ceeb". NO describas ningún paisaje.
5. assets: Lista de EXACTAMENTE ${input.maxAssets} assets (máximo 5) pedidos por el usuario. Si pide varios del mismo tipo (por ejemplo "5 piratas diferentes"), cada uno DEBE ser claramente distinto de los demás: cambia el aspecto, la ropa, los accesorios, la pose o el color, y refléjalo en un prompt de Tripo único para cada uno. No repitas ni el id ni el name.
${ASSET_FIELDS}`;
  } else {
    rules = `${ENVIRONMENT_RULES}
5. assets: Lista de ${input.maxAssets} assets clave (máximo 5) que acompañan al entorno:
${ASSET_FIELDS}`;
  }

  return rules;
}

/**
 * Prompt de sistema común a todos los proveedores de LLM (OpenAI, Anthropic, Gemini).
 * `outputInstruction` es la última frase, que varía según el proveedor.
 */
export function buildSystemPrompt(input: WorldPromptInput, outputInstruction: string): string {
  return `
Eres el arquitecto 3D de Wordsmith. Tu objetivo es recibir una descripción en lenguaje natural de un usuario y generar una especificación 3D JSON estricta llamada WorldSpec.

Reglas del WorldSpec:
1. version: "1.0.0"
2. title: Nombre descriptivo breve del mundo (ej: "Isla Pirata").
3. description: Resumen de la escena.
${modeRules(input)}

${outputInstruction}
`;
}

export function buildUserPrompt(input: WorldPromptInput): string {
  return `Estilo deseado: ${input.style}. Prompt del usuario: "${input.prompt}"`;
}
