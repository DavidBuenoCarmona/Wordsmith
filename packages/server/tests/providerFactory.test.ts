// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProviderFactory } from '../src/infrastructure/providerFactory.js';
import { OpenAILLMProvider } from '../src/infrastructure/openaiLLMProvider.js';
import { AnthropicLLMProvider } from '../src/infrastructure/anthropicLLMProvider.js';
import { GeminiLLMProvider } from '../src/infrastructure/geminiLLMProvider.js';
import { MockLLMProvider } from '../src/infrastructure/mockProviders.js';

describe('ProviderFactory Fallback Hierarchy', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('debe seleccionar MockLLMProvider si ninguna clave está configurada', () => {
    const provider = ProviderFactory.createLLMProvider();
    expect(provider instanceof MockLLMProvider).toBe(true);
  });

  it('debe priorizar OpenAI si OPENAI_API_KEY está configurada', () => {
    process.env.OPENAI_API_KEY = 'sk-valid-key';
    const provider = ProviderFactory.createLLMProvider();
    expect(provider instanceof OpenAILLMProvider).toBe(true);
  });

  it('debe seleccionar Anthropic si OPENAI no existe pero ANTHROPIC_API_KEY sí', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-valid-key';
    const provider = ProviderFactory.createLLMProvider();
    expect(provider instanceof AnthropicLLMProvider).toBe(true);
  });

  it('debe seleccionar Gemini si OPENAI y ANTHROPIC no existen pero GEMINI_API_KEY sí', () => {
    process.env.GEMINI_API_KEY = 'AIza-valid-gemini-key';
    const provider = ProviderFactory.createLLMProvider();
    expect(provider instanceof GeminiLLMProvider).toBe(true);
  });
});
