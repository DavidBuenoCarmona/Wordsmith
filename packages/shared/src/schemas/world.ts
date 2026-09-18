// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { z } from 'zod';

export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});

export type Vector3 = z.infer<typeof Vector3Schema>;

export const Rotation3Schema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
});

export type Rotation3 = z.infer<typeof Rotation3Schema>;

export const EnvironmentSpecSchema = z.object({
  prompt: z.string().min(3).describe('Prompt optimizado para World Labs'),
  theme: z.string(),
  lighting: z.enum(['day', 'sunset', 'night', 'foggy', 'dramatic']).default('day'),
  skyboxColor: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).default('#87ceeb'),
});

export type EnvironmentSpec = z.infer<typeof EnvironmentSpecSchema>;

export const AssetSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  prompt: z.string().min(3).describe('Prompt optimizado para Tripo 3D'),
  category: z.enum(['prop', 'character', 'architecture', 'nature', 'vehicle']),
  position: Vector3Schema,
  rotation: Rotation3Schema.default({ x: 0, y: 0, z: 0 }),
  scale: Vector3Schema.default({ x: 1, y: 1, z: 1 }),
  anchorToGround: z.boolean().default(true),
});

export type AssetSpec = z.infer<typeof AssetSpecSchema>;

export const WorldSpecSchema = z.object({
  version: z.literal('1.0.0').default('1.0.0'),
  title: z.string().min(1),
  description: z.string(),
  environment: EnvironmentSpecSchema,
  assets: z.array(AssetSpecSchema).min(1).max(5),
});

export type WorldSpec = z.infer<typeof WorldSpecSchema>;
