// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorldPromptInputSchema, WorldSpecSchema, GenerationJob } from '@wordsmith/shared';
import { GenerationOrchestrator } from '../src/application/orchestrator.js';
import { ITripoProvider, IWorldLabsProvider } from '../src/domain/ports.js';
import {
  MockLLMProvider,
  InMemoryJobRepository,
  MemoryEventPublisher,
} from '../src/infrastructure/mockProviders.js';
import { buildSystemPrompt } from '../src/infrastructure/llmPrompt.js';

const worldLabs: IWorldLabsProvider = {
  generateEnvironment: vi.fn(async () => ({ sceneUrl: 'https://cdn.example.com/world.spz' })),
};
const tripo: ITripoProvider = {
  generateAsset: vi.fn(async (spec) => ({ modelUrl: `https://cdn.example.com/${spec.id}.glb` })),
};

async function runJob(input: unknown, providers?: { worldLabs?: IWorldLabsProvider; tripo?: ITripoProvider }) {
  const repo = new InMemoryJobRepository();
  const orchestrator = new GenerationOrchestrator({
    llmProvider: new MockLLMProvider(),
    worldLabsProvider: providers?.worldLabs ?? worldLabs,
    tripoProvider: providers?.tripo ?? tripo,
    jobRepository: repo,
    eventPublisher: new MemoryEventPublisher(),
  });
  const job = await orchestrator.startJob(WorldPromptInputSchema.parse(input));
  let final: GenerationJob | null = null;
  for (let i = 0; i < 100; i++) {
    final = await orchestrator.getJob(job.id);
    if (final && (final.phase === 'COMPLETED' || final.phase === 'FAILED')) break;
    await new Promise((r) => setTimeout(r, 10));
  }
  return final as GenerationJob;
}

describe('Modos de generación (all / world / objects)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('el modo por defecto es "all" y se valida el enum', () => {
    expect(WorldPromptInputSchema.parse({ prompt: 'Isla pirata' }).mode).toBe('all');
    expect(WorldPromptInputSchema.safeParse({ prompt: 'Isla pirata', mode: 'nada' }).success).toBe(false);
  });

  it('modo "all": genera mundo y objetos como siempre', async () => {
    const job = await runJob({ prompt: 'Isla pirata con un cofre', maxAssets: 2 });
    expect(job.phase).toBe('COMPLETED');
    expect(job.mode).toBe('all');
    expect(job.environment?.status).toBe('READY');
    expect(job.assets).toHaveLength(2);
    expect(worldLabs.generateEnvironment).toHaveBeenCalledTimes(1);
    expect(tripo.generateAsset).toHaveBeenCalledTimes(2);
  });

  it('modo "world": solo escenario, sin llamar a Tripo y sin assets', async () => {
    const job = await runJob({ prompt: 'Isla pirata con playa', mode: 'world', maxAssets: 3 });
    expect(job.phase).toBe('COMPLETED');
    expect(job.mode).toBe('world');
    expect(job.environment?.sceneUrl).toBe('https://cdn.example.com/world.spz');
    expect(job.worldSpec?.assets).toEqual([]);
    expect(job.assets).toEqual([]);
    expect(tripo.generateAsset).not.toHaveBeenCalled();
  });

  it('modo "objects": N objetos distintos con ids únicos, sin llamar a World Labs', async () => {
    const job = await runJob({ prompt: 'piratas con espada', mode: 'objects', maxAssets: 5 });
    expect(job.phase).toBe('COMPLETED');
    expect(job.mode).toBe('objects');
    expect(job.environment).toBeUndefined();
    expect(worldLabs.generateEnvironment).not.toHaveBeenCalled();
    expect(tripo.generateAsset).toHaveBeenCalledTimes(5);

    expect(job.assets).toHaveLength(5);
    expect(job.assets.every((a) => a.status === 'READY' && a.modelUrl)).toBe(true);
    expect(new Set(job.assets.map((a) => a.id)).size).toBe(5);
    expect(new Set(job.worldSpec?.assets.map((a) => a.prompt)).size).toBe(5);
    expect(WorldSpecSchema.safeParse(job.worldSpec).success).toBe(true);
  });

  it('los ids de objetos de dos jobs distintos no colisionan (no se sobrescriben modelos en storage)', async () => {
    const a = await runJob({ prompt: 'piratas con espada', mode: 'objects', maxAssets: 2 });
    const b = await runJob({ prompt: 'piratas con espada', mode: 'objects', maxAssets: 2 });
    const idsA = a.assets.map((x) => x.id);
    const idsB = b.assets.map((x) => x.id);
    expect(idsA.some((id) => idsB.includes(id))).toBe(false);
  });

  it('modo "objects": si Tripo falla en todos, el job falla con el error', async () => {
    const failing: ITripoProvider = {
      generateAsset: vi.fn(async () => {
        throw new Error('Sin créditos de Tripo');
      }),
    };
    const job = await runJob({ prompt: 'piratas', mode: 'objects', maxAssets: 2 }, { tripo: failing });
    expect(job.phase).toBe('FAILED');
    expect(job.error).toContain('Sin créditos de Tripo');
  });

  it('modo "objects": si solo falla alguno, el job se completa con los que salieron bien', async () => {
    let calls = 0;
    const flaky: ITripoProvider = {
      generateAsset: vi.fn(async (spec) => {
        calls++;
        if (calls === 1) throw new Error('fallo puntual');
        return { modelUrl: `https://cdn.example.com/${spec.id}.glb` };
      }),
    };
    const job = await runJob({ prompt: 'piratas', mode: 'objects', maxAssets: 3 }, { tripo: flaky });
    expect(job.phase).toBe('COMPLETED');
    expect(job.assets.filter((a) => a.status === 'READY')).toHaveLength(2);
    expect(job.assets.filter((a) => a.status === 'FAILED')).toHaveLength(1);
  });

  it('modo "world": si World Labs falla, el job falla', async () => {
    const failing: IWorldLabsProvider = {
      generateEnvironment: vi.fn(async () => {
        throw new Error('World Labs caído');
      }),
    };
    const job = await runJob({ prompt: 'Isla pirata', mode: 'world' }, { worldLabs: failing });
    expect(job.phase).toBe('FAILED');
    expect(job.error).toContain('World Labs caído');
  });

  it('el prompt del LLM cambia según el modo', () => {
    const base = WorldPromptInputSchema.parse({ prompt: 'piratas', maxAssets: 4 });
    const all = buildSystemPrompt({ ...base, mode: 'all' }, 'FIN');
    const world = buildSystemPrompt({ ...base, mode: 'world' }, 'FIN');
    const objects = buildSystemPrompt({ ...base, mode: 'objects' }, 'FIN');

    expect(all).toContain('Lista de 4 assets clave');
    expect(world).toContain('DEBE ser una lista vacía');
    expect(world).toContain('World Labs');
    expect(objects).toContain('EXACTAMENTE 4 assets');
    expect(objects).toContain('claramente distinto');
    expect(objects).not.toContain('terreno, paisaje, vegetación');
    for (const p of [all, world, objects]) expect(p.trim().endsWith('FIN')).toBe(true);
  });
});
