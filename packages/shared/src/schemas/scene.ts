// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { z } from 'zod';
import { Vector3Schema, Rotation3Schema } from './world.js';

/** Formato de fichero de escena guardada (JSON simple: mundo + modelos con su transformación). */
export const SCENE_FILE_FORMAT = 'wordsmith-scene' as const;
export const SCENE_FILE_VERSION = 1 as const;

export const SceneWorldRefSchema = z.object({
  name: z.string().min(1),
  sceneUrl: z.string().min(1),
  type: z.enum(['spz', 'ply', 'glb', 'pano']),
  colliderUrl: z.string().min(1).optional(),
});

export type SceneWorldRef = z.infer<typeof SceneWorldRefSchema>;

export const SceneModelSchema = z.object({
  name: z.string().min(1),
  modelUrl: z.string().min(1),
  position: Vector3Schema,
  rotation: Rotation3Schema.default({ x: 0, y: 0, z: 0 }),
  scale: Vector3Schema.default({ x: 1, y: 1, z: 1 }),
  hidden: z.boolean().default(false),
  locked: z.boolean().default(false),
});

export type SceneModel = z.infer<typeof SceneModelSchema>;

export const LightingPresetSchema = z.enum(['day', 'sunset', 'night', 'foggy']);
export type LightingPreset = z.infer<typeof LightingPresetSchema>;

export const SceneFileSchema = z.object({
  format: z.literal(SCENE_FILE_FORMAT),
  version: z.literal(SCENE_FILE_VERSION),
  name: z.string().trim().min(1).max(80),
  savedAt: z.string(),
  world: SceneWorldRefSchema.nullable(),
  camera: z
    .object({
      position: Vector3Schema,
      rotation: Vector3Schema,
    })
    .optional(),
  floorOverride: z.number().nullable().optional(),
  lighting: LightingPresetSchema.optional(),
  models: z.array(SceneModelSchema).max(500),
});

export type SceneFile = z.infer<typeof SceneFileSchema>;

export const SceneSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  savedAt: z.string(),
  worldName: z.string().nullable(),
  modelCount: z.number().int().nonnegative(),
});

export type SceneSummary = z.infer<typeof SceneSummarySchema>;

/** Identificador estable (slug) de una escena; también es el nombre del fichero JSON. */
export const SceneIdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/);

export const FavoritesKindSchema = z.enum(['worlds', 'models']);
export type FavoritesKind = z.infer<typeof FavoritesKindSchema>;

export const FavoritesBodySchema = z.object({
  ids: z.array(z.string().min(1).max(300)).max(500),
});
