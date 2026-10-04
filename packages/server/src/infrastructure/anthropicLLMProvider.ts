// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { ILLMProvider } from '../domain/ports.js';
import { WorldPromptInput, WorldSpec, WorldSpecSchema } from '@wordsmith/shared';

export class AnthropicLLMProvider implements ILLMProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'claude-3-5-sonnet-20241022',
    baseUrl?: string
  ) {
    this.baseUrl = (baseUrl || 'https://api.anthropic.com/v1').replace(/\/$/, '');
  }

  async decomposePrompt(input: WorldPromptInput): Promise<WorldSpec> {
    const url = `${this.baseUrl}/messages`;

    const systemPrompt = `
Eres el arquitecto 3D de Wordsmith. Tu objetivo es recibir una descripción en lenguaje natural de un usuario y generar una especificación 3D JSON estricta llamada WorldSpec.

Reglas del WorldSpec:
1. version: "1.0.0"
2. title: Nombre descriptivo breve del mundo (ej: "Isla Pirata").
3. description: Resumen de la escena.
4. environment:
   - prompt: Prompt en inglés hiper-detallado y optimizado para World Labs enfocado EXCLUSIVAMENTE en terreno, paisaje, vegetación, atmósfera, cielo e iluminación (ej: "Vast grassy park landscape with winding gravel paths, lush trees, gentle rolling hills under clear daylight"). IMPORTANTE: El entorno NO debe incluir ninguna estructura artificial, edificios, juegos infantiles, columpios, vehículos, muebles, personas ni animales (esos elementos serán generados individualmente como assets 3D por Tripo).
   - theme: Identificador corto en kebab-case (ej: "pirate-bay").
   - lighting: Uno de ["day", "sunset", "night", "foggy", "dramatic"].
   - skyboxColor: Color hexadecimal (ej: "#87ceeb", "#ff7f50").
5. assets: Lista de ${input.maxAssets} assets clave (máximo 5) que acompañan al entorno:
   - id: Identificador único en kebab-case (ej: "treasure-chest-1").
   - name: Nombre en español (ej: "Cofre del Tesoro").
   - prompt: Prompt en inglés para Tripo 3D (ej: "Wooden treasure chest with gold coins, 3d game asset").
   - category: Uno de ["prop", "character", "architecture", "nature", "vehicle"].
   - position: { x, y, z } coordenadas espaciales relativas al centro (x entre -8 y 8, z entre -8 y 8, y en 0 para suelo).
   - rotation: { x, y, z } rotación en radianes (por defecto 0).
   - scale: { x, y, z } escala relativa (típicamente 1, 1, 1).
   - anchorToGround: true

IMPORTANTE: Responde ÚNICAMENTE con el objeto JSON válido, sin bloques de markdown (\`\`\`json) ni texto introductorio.
`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: 2000,
        system: systemPrompt,
        messages: [
          { role: 'user', content: `Estilo deseado: ${input.style}. Prompt del usuario: "${input.prompt}"` },
        ],
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[Anthropic API Error ${res.status}] ${errText}`);
    }

    const data = await res.json();
    const rawText = data.content?.[0]?.text;
    if (!rawText) {
      throw new Error('[Anthropic Error] Respuesta vacía del modelo Claude.');
    }

    // Limpiar posibles bloques markdown
    const cleanedJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedJson = JSON.parse(cleanedJson);
    return WorldSpecSchema.parse(parsedJson);
  }
}
