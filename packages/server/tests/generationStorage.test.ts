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
import { GenerationStorage } from '../src/infrastructure/generationStorage.js';
import { HttpWorldLabsProvider } from '../src/infrastructure/httpWorldLabsProvider.js';
import { HttpTripoProvider } from '../src/infrastructure/httpTripoProvider.js';
import { MockWorldLabsProvider, MockTripoProvider } from '../src/infrastructure/mockProviders.js';

describe('GenerationStorage & Automatic Cache/Fallback System', () => {
  let tempDir: string;
  let storage: GenerationStorage;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wordsmith-storage-test-'));
    storage = new GenerationStorage(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignorar error de limpieza
    }
  });

  it('debe guardar y recuperar entornos de World Labs correctamente', async () => {
    const savedPath = await storage.saveWorldLabs(
      {
        prompt: 'Isla paradisíaca con palmeras y arena blanca',
        theme: 'tropical-beach',
        lighting: 'sunset',
        skyboxColor: '#ff9966',
      },
      {
        sceneUrl: 'https://cdn.worldlabs.ai/scenes/tropical-123.spz',
        previewUrl: 'https://cdn.worldlabs.ai/previews/tropical-123.jpg',
      },
      { world_id: 'test-wl-001' }
    );

    expect(fs.existsSync(savedPath)).toBe(true);

    const list = await storage.listWorldLabs();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('test-wl-001');
    expect(list[0].theme).toBe('tropical-beach');

    // Recuperar fallback por tema
    const fallbackTheme = await storage.getWorldLabsFallback({ theme: 'tropical' });
    expect(fallbackTheme).toBeDefined();
    expect(fallbackTheme?.sceneUrl).toBe('https://cdn.worldlabs.ai/scenes/tropical-123.spz');

    // Recuperar fallback genérico
    const fallbackAny = await storage.getWorldLabsFallback();
    expect(fallbackAny?.sceneUrl).toBe('https://cdn.worldlabs.ai/scenes/tropical-123.spz');
  });

  it('debe guardar y recuperar modelos 3D de Tripo correctamente', async () => {
    const savedPath = await storage.saveTripo(
      {
        id: 'treasure-chest-001',
        name: 'Cofre Dorado Pirata',
        prompt: 'Golden pirate treasure chest with skulls',
        category: 'prop',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        anchorToGround: true,
      },
      {
        modelUrl: 'https://cdn.tripo3d.ai/models/chest-123.glb',
      }
    );

    expect(fs.existsSync(savedPath)).toBe(true);

    const list = await storage.listTripo();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('treasure-chest-001');
    expect(list[0].name).toBe('Cofre Dorado Pirata');

    // Recuperar fallback por nombre
    const fallbackName = await storage.getTripoFallback({ name: 'Cofre' });
    expect(fallbackName?.modelUrl).toBe('https://cdn.tripo3d.ai/models/chest-123.glb');

    // Recuperar fallback por id
    const fallbackId = await storage.getTripoFallback({ id: 'treasure-chest-001' });
    expect(fallbackId?.modelUrl).toBe('https://cdn.tripo3d.ai/models/chest-123.glb');
  });

  it('HttpWorldLabsProvider debe recurrir al almacenamiento si la API falla o no hay tokens', async () => {
    // 1. Guardar primero un entorno de prueba en la caché local
    await storage.saveWorldLabs(
      {
        prompt: 'Parque temático futurista',
        theme: 'sci-fi-park',
      },
      {
        sceneUrl: 'https://cdn.worldlabs.ai/scenes/cached-scifi.spz',
        previewUrl: 'https://cdn.worldlabs.ai/previews/cached-scifi.jpg',
      },
      { world_id: 'scifi-001' }
    );

    // 2. Instanciar HttpWorldLabsProvider con endpoint inválido / sin tokens para forzar fallo
    const provider = new HttpWorldLabsProvider('invalid-api-key', 'http://localhost:12345/invalid', 10, 1, storage);

    // 3. Debe retornar el fallback guardado en vez de lanzar un error irrecuperable
    const result = await provider.generateEnvironment({
      prompt: 'Parque futurista con neones',
      theme: 'sci-fi-park',
      lighting: 'night',
      skyboxColor: '#000033',
    });

    expect(result.sceneUrl).toBe('https://cdn.worldlabs.ai/scenes/cached-scifi.spz');
  });

  it('HttpTripoProvider debe recurrir al almacenamiento si la API falla o no hay tokens', async () => {
    // 1. Guardar modelo previo en caché
    await storage.saveTripo(
      {
        id: 'cyber-car-1',
        name: 'Auto Cyberpunk',
        prompt: 'Futuristic flying car with neon lights',
        category: 'prop',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        anchorToGround: true,
      },
      {
        modelUrl: 'https://cdn.tripo3d.ai/models/cyber-car.glb',
      }
    );

    // 2. Instanciar HttpTripoProvider con endpoint inválido para forzar error
    const provider = new HttpTripoProvider('invalid-key', 'http://localhost:12345/invalid', 10, 1, storage);

    // 3. Debe retornar el modelo guardado en storage
    const result = await provider.generateAsset({
      id: 'cyber-car-1',
      name: 'Auto Cyberpunk',
      prompt: 'Futuristic flying car with neon lights',
      category: 'prop',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      anchorToGround: true,
    });

    expect(result.modelUrl).toBe('https://cdn.tripo3d.ai/models/cyber-car.glb');
  });

  it('MockWorldLabsProvider y MockTripoProvider deben priorizar la caché local si está disponible', async () => {
    await storage.saveWorldLabs(
      { prompt: 'Bosque místico', theme: 'mystic-forest' },
      { sceneUrl: 'https://cdn.worldlabs.ai/scenes/mystic.spz' }
    );

    await storage.saveTripo(
      {
        id: 'magic-wand-1',
        name: 'Varita Mágica',
        prompt: 'Glowing magic wand',
        category: 'prop',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        anchorToGround: true,
      },
      { modelUrl: 'https://cdn.tripo3d.ai/models/wand.glb' }
    );

    const mockWl = new MockWorldLabsProvider(0, storage);
    const envResult = await mockWl.generateEnvironment({
      prompt: 'Bosque místico con luciérnagas',
      theme: 'mystic-forest',
      lighting: 'night',
      skyboxColor: '#001122',
    });
    expect(envResult.sceneUrl).toBe('https://cdn.worldlabs.ai/scenes/mystic.spz');

    const mockTripo = new MockTripoProvider(0, storage);
    const assetResult = await mockTripo.generateAsset({
      id: 'magic-wand-1',
      name: 'Varita Mágica',
      prompt: 'Glowing magic wand',
      category: 'prop',
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      anchorToGround: true,
    });
    expect(assetResult.modelUrl).toBe('https://cdn.tripo3d.ai/models/wand.glb');
  });
});
