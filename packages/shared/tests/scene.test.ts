// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect } from 'vitest';
import { SceneFileSchema, SceneIdSchema, FavoritesBodySchema } from '../src/index.js';

const base = {
  format: 'wordsmith-scene',
  version: 1,
  name: 'Mi escena',
  savedAt: '2026-10-16T10:00:00.000Z',
  world: null,
  models: [],
};

describe('Scene file contract (v0.4.0)', () => {
  it('acepta una escena mínima sin mundo ni modelos', () => {
    expect(SceneFileSchema.safeParse(base).success).toBe(true);
  });

  it('aplica valores por defecto a rotación, escala, oculto y bloqueado', () => {
    const parsed = SceneFileSchema.parse({
      ...base,
      models: [{ name: 'Cofre', modelUrl: '/api/storage/files/c.glb', position: { x: 1, y: 2, z: 3 } }],
    });
    expect(parsed.models[0].rotation).toEqual({ x: 0, y: 0, z: 0 });
    expect(parsed.models[0].scale).toEqual({ x: 1, y: 1, z: 1 });
    expect(parsed.models[0].hidden).toBe(false);
    expect(parsed.models[0].locked).toBe(false);
  });

  it('rechaza formato/versión desconocidos y nombres vacíos', () => {
    expect(SceneFileSchema.safeParse({ ...base, format: 'other' }).success).toBe(false);
    expect(SceneFileSchema.safeParse({ ...base, version: 2 }).success).toBe(false);
    expect(SceneFileSchema.safeParse({ ...base, name: '   ' }).success).toBe(false);
  });

  it('valida el mundo referenciado', () => {
    const ok = SceneFileSchema.safeParse({
      ...base,
      world: { name: 'Parque', sceneUrl: '/api/storage/files/p.spz', type: 'spz', colliderUrl: 'https://x/y.glb' },
    });
    expect(ok.success).toBe(true);
    const bad = SceneFileSchema.safeParse({ ...base, world: { name: 'Parque', sceneUrl: '', type: 'spz' } });
    expect(bad.success).toBe(false);
  });

  it('SceneIdSchema solo admite slugs seguros', () => {
    expect(SceneIdSchema.safeParse('mi-escena-2').success).toBe(true);
    expect(SceneIdSchema.safeParse('../etc/passwd').success).toBe(false);
    expect(SceneIdSchema.safeParse('Mayusculas').success).toBe(false);
  });

  it('FavoritesBodySchema exige un array de ids', () => {
    expect(FavoritesBodySchema.safeParse({ ids: ['a', 'b'] }).success).toBe(true);
    expect(FavoritesBodySchema.safeParse({ ids: 'a' }).success).toBe(false);
  });
});
