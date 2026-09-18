// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { z } from 'zod';
import { WorldSpecSchema } from './world.js';

export const GenerationPhaseSchema = z.enum([
  'QUEUED',
  'ANALYZING',
  'GENERATING_WORLD',
  'GENERATING_ASSETS',
  'COMPOSING',
  'COMPLETED',
  'FAILED',
]);

export type GenerationPhase = z.infer<typeof GenerationPhaseSchema>;

export const AssetStateSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['PENDING', 'GENERATING', 'READY', 'FAILED']),
  modelUrl: z.string().url().optional(),
  error: z.string().optional(),
});

export type AssetState = z.infer<typeof AssetStateSchema>;

export const EnvironmentStateSchema = z.object({
  status: z.enum(['PENDING', 'GENERATING', 'READY', 'FAILED']),
  sceneUrl: z.string().url().optional(),
  previewUrl: z.string().url().optional(),
  error: z.string().optional(),
});

export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;

export const GenerationJobSchema = z.object({
  id: z.string().uuid(),
  prompt: z.string(),
  phase: GenerationPhaseSchema,
  progress: z.number().min(0).max(100),
  message: z.string(),
  worldSpec: WorldSpecSchema.optional(),
  environment: EnvironmentStateSchema.optional(),
  assets: z.array(AssetStateSchema).default([]),
  error: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type GenerationJob = z.infer<typeof GenerationJobSchema>;

export const GenerationProgressEventSchema = z.object({
  jobId: z.string().uuid(),
  phase: GenerationPhaseSchema,
  progress: z.number().min(0).max(100),
  message: z.string(),
  environment: EnvironmentStateSchema.optional(),
  assets: z.array(AssetStateSchema).optional(),
  worldSpec: WorldSpecSchema.optional(),
  error: z.string().optional(),
});

export type GenerationProgressEvent = z.infer<typeof GenerationProgressEventSchema>;
