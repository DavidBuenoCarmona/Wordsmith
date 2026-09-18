// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import {
  ILLMProvider,
  IWorldLabsProvider,
  ITripoProvider,
} from '../domain/ports.js';
import {
  MockLLMProvider,
  MockWorldLabsProvider,
  MockTripoProvider,
} from './mockProviders.js';
import { OpenAILLMProvider } from './openaiLLMProvider.js';
import { AnthropicLLMProvider } from './anthropicLLMProvider.js';
import { GeminiLLMProvider } from './geminiLLMProvider.js';
import { HttpWorldLabsProvider } from './httpWorldLabsProvider.js';
import { HttpTripoProvider } from './httpTripoProvider.js';
import { GenerationStorage } from './generationStorage.js';

export class ProviderFactory {
  private static sharedStorage = new GenerationStorage();

  /**
   * Cascada de fallback para LLM:
   * 1. OpenAI (si OPENAI_API_KEY existe)
   * 2. Anthropic (si ANTHROPIC_API_KEY existe)
   * 3. Google Gemini (si GEMINI_API_KEY existe)
   * 4. Mock determinista local (si ninguna está presente)
   */
  static createLLMProvider(): ILLMProvider {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey && openaiKey.trim().length > 0 && !openaiKey.startsWith('sk-placeholder')) {
      console.log('🤖 [LLM] Usando OpenAI Provider real (GPT-4o-mini).');
      return new OpenAILLMProvider(openaiKey);
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey && anthropicKey.trim().length > 0 && !anthropicKey.startsWith('sk-ant-placeholder')) {
      console.log('🤖 [LLM] Usando Anthropic Claude Provider real (Claude 3.5 Sonnet).');
      return new AnthropicLLMProvider(anthropicKey);
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey && geminiKey.trim().length > 0 && !geminiKey.startsWith('AIza-placeholder')) {
      console.log('🤖 [LLM] Usando Google Gemini Provider real (Gemini 1.5 Flash).');
      return new GeminiLLMProvider(geminiKey);
    }

    console.log('🧪 [LLM] Ninguna API key de LLM detectada (OpenAI/Anthropic/Gemini). Usando MockLLMProvider determinista.');
    return new MockLLMProvider();
  }

  static createWorldLabsProvider(): IWorldLabsProvider {
    const apiKey = process.env.WORLD_LABS_API_KEY;
    if (apiKey && apiKey.trim().length > 0 && !apiKey.startsWith('wl-placeholder')) {
      console.log('🌍 [World Labs] Usando HttpWorldLabsProvider real con auto-guardado y fallback.');
      return new HttpWorldLabsProvider(apiKey, undefined, undefined, undefined, this.sharedStorage);
    }
    console.log('🧪 [World Labs] WORLD_LABS_API_KEY no detectada. Usando MockWorldLabsProvider.');
    return new MockWorldLabsProvider(20, this.sharedStorage);
  }

  static createTripoProvider(): ITripoProvider {
    const apiKey = process.env.TRIPO_API_KEY;
    if (apiKey && apiKey.trim().length > 0 && !apiKey.startsWith('tsk-placeholder')) {
      console.log('🧩 [Tripo 3D] Usando HttpTripoProvider real con auto-guardado y fallback.');
      return new HttpTripoProvider(apiKey, undefined, undefined, undefined, this.sharedStorage);
    }
    console.log('🧪 [Tripo 3D] TRIPO_API_KEY no detectada. Usando MockTripoProvider.');
    return new MockTripoProvider(20, this.sharedStorage);
  }
}
