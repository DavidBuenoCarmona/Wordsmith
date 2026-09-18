// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { ILLMProvider } from '../domain/ports.js';
import { WorldPromptInput, WorldSpec, WorldSpecSchema } from '@wordsmith/shared';

export class GeminiLLMProvider implements ILLMProvider {
  private readonly baseUrl: string;

  constructor(
    private readonly apiKey: string,
    private readonly model = 'gemini-1.5-flash-latest',
    baseUrl?: string
  ) {
    this.baseUrl = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
  }

  async decomposePrompt(input: WorldPromptInput): Promise<WorldSpec> {
    // Lista de modelos a intentar en orden por si la cuenta tiene nombres canónicos distintos
    const modelsToTry = [
      this.model,
      'gemini-2.5-flash',
      'gemini-2.5-pro'
    ];

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

IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin bloques de formato ni explicaciones.
`;

    let lastError = '';

    for (const modelName of modelsToTry) {
      const url = `${this.baseUrl}/models/${modelName}:generateContent?key=${this.apiKey}`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\n\nEstilo deseado: ${input.style}. Prompt del usuario: "${input.prompt}"` },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.7,
            },
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            const parsedJson = JSON.parse(rawText.replace(/```json/g, '').replace(/```/g, '').trim());
            return WorldSpecSchema.parse(parsedJson);
          }
        } else {
          lastError = await res.text();
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    throw new Error(`[Gemini API Error] No se pudo generar con los modelos disponibles. Detalle: ${lastError}`);
  }
}
