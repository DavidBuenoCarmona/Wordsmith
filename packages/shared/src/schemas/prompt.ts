// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { z } from 'zod';

/**
 * Validación estricta del prompt inicial introducido por el usuario.
 */
export const WorldPromptInputSchema = z.object({
  prompt: z
    .string()
    .min(5, 'El prompt debe contener al menos 5 caracteres.')
    .max(1000, 'El prompt no puede superar los 1000 caracteres.')
    .trim(),
  maxAssets: z.number().int().min(1).max(5).default(3),
  style: z
    .enum(['realistic', 'stylized', 'low-poly', 'fantasy', 'sci-fi'])
    .default('stylized'),
});

export type WorldPromptInput = z.infer<typeof WorldPromptInputSchema>;
