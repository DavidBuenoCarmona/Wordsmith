// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SceneFile } from '@wordsmith/shared';
import { GenerationStorage, compareByName } from '../src/infrastructure/generationStorage.js';

function sampleScene(name: string): SceneFile {
  return {
    format: 'wordsmith-scene',
    version: 1,
    name,
    savedAt: '2026-10-16T10:00:00.000Z',
    world: { name: 'Parque', sceneUrl: '/api/storage/files/parque.spz', type: 'spz' },
    models: [
      {
        name: 'Tobogán',
        modelUrl: '/api/storage/files/slide.glb',
        position: { x: 1, y: 0.5, z: -2 },
        rotation: { x: 0, y: 1.2, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        hidden: false,
        locked: false,
      },
    ],
  };
}

describe('GenerationStorage v0.4.0 — orden alfabético, escenas, subidas y favoritos', () => {
  let tempDir: string;
  let storage: GenerationStorage;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wordsmith-scenes-test-'));
    storage = new GenerationStorage(path.join(tempDir, 'generations'));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('compareByName ordena sin distinguir mayúsculas, acentos ni números naturales', () => {
    const names = [{ name: 'zorro' }, { name: 'Árbol 10' }, { name: 'árbol 2' }, { name: 'Banco' }];
    const sorted = names.sort(compareByName).map((n) => n.name);
    expect(sorted).toEqual(['árbol 2', 'Árbol 10', 'Banco', 'zorro']);
  });

  it('listAllSavedModels devuelve los modelos en orden alfabético', async () => {
    const dir = storage.getModelsDir();
    for (const f of ['zebra.glb', 'Alpaca.glb', 'mono.glb']) {
      await fs.promises.writeFile(path.join(dir, f), 'x');
    }
    const names = (await storage.listAllSavedModels()).map((m) => m.name);
    expect(names).toEqual(['Alpaca', 'mono', 'zebra']);
  });

  it('listAllSavedWorlds ordena alfabéticamente, incluido el mundo de referencia', async () => {
    const dir = storage.getWorldsDir();
    await fs.promises.writeFile(path.join(dir, 'zeta.spz'), 'x');
    await fs.promises.writeFile(path.join(dir, 'beta.ply'), 'x');
    const worlds = await storage.listAllSavedWorlds();
    const names = worlds.map((w) => w.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true })));
    expect(worlds.find((w) => w.id === 'local-beta.ply')?.type).toBe('ply');
    expect(worlds.some((w) => w.id === 'reference-playground')).toBe(true);
  });

  it('guarda, lista, recupera y borra escenas', async () => {
    const saved = await storage.saveScene(sampleScene('Mi Escena Pirata'));
    expect(saved.ok).toBe(true);
    if (!saved.ok) return;
    expect(saved.value.id).toBe('mi-escena-pirata');
    expect(saved.value.modelCount).toBe(1);

    await storage.saveScene(sampleScene('Alfa'));
    const list = await storage.listScenes();
    expect(list.map((s) => s.name)).toEqual(['Alfa', 'Mi Escena Pirata']);

    const loaded = await storage.getScene('mi-escena-pirata');
    expect(loaded?.models[0].position).toEqual({ x: 1, y: 0.5, z: -2 });
    expect(loaded?.world?.sceneUrl).toBe('/api/storage/files/parque.spz');

    expect(await storage.deleteScene('alfa')).toBe(true);
    expect(await storage.getScene('alfa')).toBeNull();
    expect(await storage.deleteScene('alfa')).toBe(false);
  });

  it('rechaza ids de escena con path traversal', async () => {
    expect(await storage.getScene('../secret')).toBeNull();
    expect(await storage.deleteScene('..%2Fsecret')).toBe(false);
  });

  it('saveUpload guarda sin duplicar por contenido y rechaza extensiones no permitidas', async () => {
    const data = Buffer.from('glb-binary');
    const first = await storage.saveUpload('model', 'Mi Modelo.glb', data);
    const second = await storage.saveUpload('model', 'Mi Modelo.glb', data);
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.value.filename).toBe(second.value.filename);
    expect(first.value.url).toBe(`/api/storage/files/${first.value.filename}`);
    expect(fs.existsSync(path.join(storage.getModelsDir(), first.value.filename))).toBe(true);

    const bad = await storage.saveUpload('model', 'virus.exe', data);
    expect(bad.ok).toBe(false);
    const empty = await storage.saveUpload('world', 'vacio.spz', Buffer.alloc(0));
    expect(empty.ok).toBe(false);
  });

  it('saveUpload de un mundo aparece en el listado de mundos', async () => {
    const res = await storage.saveUpload('world', 'Isla Bonita.spz', Buffer.from('spz'));
    expect(res.ok).toBe(true);
    const worlds = await storage.listAllSavedWorlds();
    expect(worlds.some((w) => w.name === 'isla bonita (Local SPZ)')).toBe(true);
  });

  it('persiste favoritos por tipo sin duplicados', async () => {
    expect(await storage.getFavorites('worlds')).toEqual([]);
    await storage.setFavorites('worlds', ['a', 'b', 'a']);
    await storage.setFavorites('models', ['m1']);
    expect(await storage.getFavorites('worlds')).toEqual(['a', 'b']);
    expect(await storage.getFavorites('models')).toEqual(['m1']);
  });
});
