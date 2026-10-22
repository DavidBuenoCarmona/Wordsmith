// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { ILLMProvider } from '../domain/ports.js';
import { buildSystemPrompt, buildUserPrompt } from './llmPrompt.js';
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

    const systemPrompt = buildSystemPrompt(input, "IMPORTANTE: Responde ÚNICAMENTE con el objeto JSON válido.");

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
          { role: 'user', content: buildUserPrompt(input) },
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
