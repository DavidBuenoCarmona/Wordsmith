// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import {
  WorldPromptInput,
  WorldSpec,
  GenerationJob,
  GenerationProgressEvent,
} from '@wordsmith/shared';

export interface ILLMProvider {
  decomposePrompt(input: WorldPromptInput): Promise<WorldSpec>;
}

export interface IWorldLabsProvider {
  generateEnvironment(spec: WorldSpec['environment']): Promise<{
    sceneUrl: string;
    previewUrl?: string;
  }>;
}

export interface ITripoProvider {
  generateAsset(spec: WorldSpec['assets'][number]): Promise<{
    modelUrl: string;
  }>;
}

export interface IJobRepository {
  create(job: GenerationJob): Promise<GenerationJob>;
  findById(id: string): Promise<GenerationJob | null>;
  update(job: GenerationJob): Promise<GenerationJob>;
  listAll(): Promise<GenerationJob[]>;
}

export type JobSubscriber = (event: GenerationProgressEvent) => void;

export interface IEventPublisher {
  subscribe(jobId: string, subscriber: JobSubscriber): () => void;
  publish(event: GenerationProgressEvent): void;
}
