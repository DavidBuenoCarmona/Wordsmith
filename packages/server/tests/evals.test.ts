// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect } from 'vitest';
import { MockLLMProvider } from '../../server/src/infrastructure/mockProviders.js';
import { WorldSpecSchema, WorldPromptInput } from '@wordsmith/shared';

describe('Evals Suite: LLM Prompt Decomposition & Safety Guardrails', () => {
  const llm = new MockLLMProvider();

  it('Eval 1: Debe descomponer un prompt complejo manteniendo conformidad de esquema', async () => {
    const input: WorldPromptInput = {
      prompt: 'Isla pirata abandonada con un galeón destruido y cofre de oro',
      maxAssets: 3,
      style: 'stylized',
    };

    const spec = await llm.decomposePrompt(input);
    const parseResult = WorldSpecSchema.safeParse(spec);

    expect(parseResult.success).toBe(true);
    expect(spec.assets.length).toBeGreaterThanOrEqual(1);
    expect(spec.assets.length).toBeLessThanOrEqual(3);
  });

  it('Eval 2: Debe asignar coordenadas 3D finitas y válidas a todos los assets', async () => {
    const input: WorldPromptInput = {
      prompt: 'Castillo medieval con dragón en la torre y antorchas',
      maxAssets: 2,
      style: 'fantasy',
    };

    const spec = await llm.decomposePrompt(input);
    for (const asset of spec.assets) {
      expect(Number.isFinite(asset.position.x)).toBe(true);
      expect(Number.isFinite(asset.position.y)).toBe(true);
      expect(Number.isFinite(asset.position.z)).toBe(true);
      expect(asset.scale.x).toBeGreaterThan(0);
    }
  });

  it('Eval 3: Guardrail de seguridad: debe incluir theme y lighting válidos en el entorno', async () => {
    const input: WorldPromptInput = {
      prompt: 'Ciudad futurista cyberpunk con rascacielos',
      maxAssets: 1,
      style: 'sci-fi',
    };

    const spec = await llm.decomposePrompt(input);
    expect(spec.environment.theme).toBeDefined();
    expect(['day', 'sunset', 'night', 'foggy', 'dramatic']).toContain(spec.environment.lighting);
  });
});
