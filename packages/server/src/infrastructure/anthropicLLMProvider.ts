// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { ILLMProvider } from '../domain/ports.js';
import { buildSystemPrompt, buildUserPrompt } from './llmPrompt.js';
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

    const systemPrompt = buildSystemPrompt(input, "IMPORTANTE: Responde ÚNICAMENTE con el objeto JSON válido, sin bloques de markdown (```json) ni texto introductorio.");

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
          { role: 'user', content: buildUserPrompt(input) },
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
