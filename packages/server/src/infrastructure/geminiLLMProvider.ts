// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { ILLMProvider } from '../domain/ports.js';
import { buildSystemPrompt, buildUserPrompt } from './llmPrompt.js';
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

    const systemPrompt = buildSystemPrompt(input, "IMPORTANTE: Responde ÚNICAMENTE con JSON válido, sin bloques de formato ni explicaciones.");

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
                  { text: `${systemPrompt}\n\n${buildUserPrompt(input)}` },
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
