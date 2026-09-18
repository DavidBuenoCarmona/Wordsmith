// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import {
  WorldPromptInput,
  WorldSpec,
  WorldSpecSchema,
} from '@wordsmith/shared';
import {
  ILLMProvider,
  IWorldLabsProvider,
  ITripoProvider,
  IJobRepository,
  IEventPublisher,
  JobSubscriber,
} from '../domain/ports.js';
import { GenerationJob, GenerationProgressEvent } from '@wordsmith/shared';
import { GenerationStorage } from './generationStorage.js';

/**
 * Mock LLM Provider: Genera especificaciones 3D deterministas según el prompt.
 */
export class MockLLMProvider implements ILLMProvider {
  async decomposePrompt(input: WorldPromptInput): Promise<WorldSpec> {
    const isPirate = input.prompt.toLowerCase().includes('pirat') || input.prompt.toLowerCase().includes('barco');

    const rawSpec = isPirate
      ? {
          version: '1.0.0' as const,
          title: 'Isla Pirata Abandonada',
          description: input.prompt,
          environment: {
            prompt: 'Tropical pirate island with sandy beaches and ocean waves',
            theme: 'pirate-bay',
            lighting: 'sunset' as const,
            skyboxColor: '#ff7f50',
          },
          assets: [
            {
              id: 'shipwreck-1',
              name: 'Galeón Hundido',
              prompt: 'Destroyed wooden pirate ship shipwreck on beach',
              category: 'architecture' as const,
              position: { x: -4, y: 0, z: -3 },
              rotation: { x: 0, y: 0.4, z: -0.1 },
              scale: { x: 1.5, y: 1.5, z: 1.5 },
              anchorToGround: true,
            },
            {
              id: 'treasure-chest-1',
              name: 'Cofre del Tesoro',
              prompt: 'Open wooden treasure chest filled with gold coins and gems',
              category: 'prop' as const,
              position: { x: 2, y: 0, z: 1 },
              rotation: { x: 0, y: -0.2, z: 0 },
              scale: { x: 0.8, y: 0.8, z: 0.8 },
              anchorToGround: true,
            },
            {
              id: 'pirate-robot-1',
              name: 'Robot Pirata',
              prompt: 'Steampunk pirate android with hook hand and glowing eye',
              category: 'character' as const,
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              anchorToGround: true,
            },
          ].slice(0, input.maxAssets),
        }
      : {
          version: '1.0.0' as const,
          title: 'Mundo Generado',
          description: input.prompt,
          environment: {
            prompt: `Stylized 3D landscape representing: ${input.prompt}`,
            theme: 'custom-world',
            lighting: 'day' as const,
            skyboxColor: '#87ceeb',
          },
          assets: [
            {
              id: 'primary-asset-1',
              name: 'Elemento Principal',
              prompt: `Main stylized focal prop for: ${input.prompt}`,
              category: 'prop' as const,
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              anchorToGround: true,
            },
          ],
        };

    return WorldSpecSchema.parse(rawSpec);
  }
}

/**
 * Mock World Labs Provider
 */
export class MockWorldLabsProvider implements IWorldLabsProvider {
  private readonly storage?: GenerationStorage;

  constructor(private readonly simulatedDelayMs: number = 20, storage?: GenerationStorage) {
    this.storage = storage;
  }

  async generateEnvironment(spec: WorldSpec['environment']): Promise<{
    sceneUrl: string;
    previewUrl?: string;
  }> {
    if (this.simulatedDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedDelayMs));
    }

    if (this.storage) {
      const cached = await this.storage.getWorldLabsFallback(spec);
      if (cached) {
        return cached;
      }
    }

    return {
      sceneUrl: `https://mock.worldlabs.ai/scenes/${encodeURIComponent(spec.theme)}.splat`,
      previewUrl: `https://mock.worldlabs.ai/previews/${encodeURIComponent(spec.theme)}.jpg`,
    };
  }
}

/**
 * Mock Tripo 3D Provider
 */
export class MockTripoProvider implements ITripoProvider {
  private readonly storage?: GenerationStorage;

  constructor(private readonly simulatedDelayMs: number = 20, storage?: GenerationStorage) {
    this.storage = storage;
  }

  async generateAsset(spec: WorldSpec['assets'][number]): Promise<{
    modelUrl: string;
  }> {
    if (this.simulatedDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.simulatedDelayMs));
    }

    if (this.storage) {
      const cached = await this.storage.getTripoFallback(spec);
      if (cached) {
        return cached;
      }
    }

    return {
      modelUrl: `https://mock.tripo3d.ai/models/${spec.id}.glb`,
    };
  }
}

/**
 * Repositorio InMemory para Jobs (con interfaz idéntica a persistencia SQL)
 */
export class InMemoryJobRepository implements IJobRepository {
  private jobs = new Map<string, GenerationJob>();

  async create(job: GenerationJob): Promise<GenerationJob> {
    this.jobs.set(job.id, { ...job });
    return job;
  }

  async findById(id: string): Promise<GenerationJob | null> {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }

  async update(job: GenerationJob): Promise<GenerationJob> {
    this.jobs.set(job.id, { ...job, updatedAt: new Date().toISOString() });
    return this.jobs.get(job.id)!;
  }

  async listAll(): Promise<GenerationJob[]> {
    return Array.from(this.jobs.values());
  }
}

/**
 * Event Publisher en memoria para SSE
 */
export class MemoryEventPublisher implements IEventPublisher {
  private subscribers = new Map<string, Set<JobSubscriber>>();

  subscribe(jobId: string, subscriber: JobSubscriber): () => void {
    if (!this.subscribers.has(jobId)) {
      this.subscribers.set(jobId, new Set());
    }
    this.subscribers.get(jobId)!.add(subscriber);

    return () => {
      const set = this.subscribers.get(jobId);
      if (set) {
        set.delete(subscriber);
        if (set.size === 0) {
          this.subscribers.delete(jobId);
        }
      }
    };
  }

  publish(event: GenerationProgressEvent): void {
    const set = this.subscribers.get(event.jobId);
    if (set) {
      for (const subscriber of set) {
        try {
          subscriber(event);
        } catch {
          // Ignore subscriber delivery errors
        }
      }
    }
  }
}
