// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { ILLMProvider } from '../domain/ports.js';
import { WorldPromptInput, WorldSpec, WorldSpecSchema } from '@wordsmith/shared';

export class OpenAILLMProvider implements ILLMProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'gpt-4o-mini',
    baseUrl?: string
  ) {
    this.baseUrl = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  }

  async decomposePrompt(input: WorldPromptInput): Promise<WorldSpec> {
    const url = `${this.baseUrl}/chat/completions`;

    const systemPrompt = `
Eres el arquitecto 3D de Wordsmith. Tu objetivo es recibir una descripción en lenguaje natural de un usuario y generar una especificación 3D JSON estricta llamada WorldSpec.

Reglas del WorldSpec:
1. version: "1.0.0"
2. title: Nombre descriptivo breve del mundo (ej: "Isla Pirata").
3. description: Resumen de la escena.
4. environment:
   - prompt: Prompt en inglés hiper-detallado y optimizado para World Labs (ej: "Tropical sandy island with ocean shore, palm trees, sunny day").
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

IMPORTANTE: Responde ÚNICAMENTE con el objeto JSON válido.
`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Estilo deseado: ${input.style}. Prompt del usuario: "${input.prompt}"` },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[OpenAI API Error ${res.status}] ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('[OpenAI Error] Respuesta vacía del modelo LLM.');
    }

    const parsedJson = JSON.parse(content);
    return WorldSpecSchema.parse(parsedJson);
  }
}
