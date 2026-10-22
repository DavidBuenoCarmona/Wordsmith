// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect } from 'vitest';
import { compareNames, sortWithFavorites } from '../src/utils/sort.js';
import { guessWorldType } from '../src/api/storage.js';

describe('orden alfabético y favoritos', () => {
  const items = [
    { id: 'c', name: 'Zorro' },
    { id: 'a', name: 'árbol 10' },
    { id: 'b', name: 'Árbol 2' },
    { id: 'd', name: 'banco' },
  ];

  it('ordena sin distinguir mayúsculas, acentos y con números naturales', () => {
    expect([...items].sort(compareNames).map((i) => i.name)).toEqual(['Árbol 2', 'árbol 10', 'banco', 'Zorro']);
  });

  it('los favoritos van primero y cada grupo queda alfabético', () => {
    const sorted = sortWithFavorites(items, new Set(['c', 'a']));
    expect(sorted.map((i) => i.id)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('no muta el array original', () => {
    const copy = [...items];
    sortWithFavorites(items, new Set(['c']));
    expect(items).toEqual(copy);
  });

  it('guessWorldType reconoce el tipo de mundo por extensión', () => {
    expect(guessWorldType('mapa.spz')).toBe('spz');
    expect(guessWorldType('/api/storage/files/isla-1a2b3c4d.ply')).toBe('ply');
    expect(guessWorldType('ciudad.glb#ciudad.glb')).toBe('glb');
    expect(guessWorldType('pano.JPG')).toBe('pano');
  });
});
