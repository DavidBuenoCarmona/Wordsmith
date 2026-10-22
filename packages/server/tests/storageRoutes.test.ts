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
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';

const validScene = {
  format: 'wordsmith-scene',
  version: 1,
  name: 'Demo Jurado',
  savedAt: '2026-10-16T10:00:00.000Z',
  world: { name: 'Parque', sceneUrl: '/api/storage/files/parque.spz', type: 'spz' },
  models: [
    {
      name: 'Cofre',
      modelUrl: '/api/storage/files/cofre.glb',
      position: { x: 0, y: 1, z: -3 },
      rotation: { x: 0, y: 0.5, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
  ],
};

describe('Storage routes v0.4.0 (escenas, importación y favoritos)', () => {
  let server: FastifyInstance;
  let tempDir: string;
  const previousEnv = process.env.WORDSMITH_STORAGE_DIR;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'wordsmith-routes-test-'));
    process.env.WORDSMITH_STORAGE_DIR = path.join(tempDir, 'generations');
    server = buildServer();
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
    if (previousEnv === undefined) delete process.env.WORDSMITH_STORAGE_DIR;
    else process.env.WORDSMITH_STORAGE_DIR = previousEnv;
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('POST/GET/DELETE /api/storage/scenes — ciclo completo de una escena', async () => {
    const created = await server.inject({ method: 'POST', url: '/api/storage/scenes', payload: validScene });
    expect(created.statusCode).toBe(201);
    expect(JSON.parse(created.body).id).toBe('demo-jurado');

    const list = await server.inject({ method: 'GET', url: '/api/storage/scenes' });
    expect(JSON.parse(list.body).scenes).toHaveLength(1);

    const got = await server.inject({ method: 'GET', url: '/api/storage/scenes/demo-jurado' });
    expect(got.statusCode).toBe(200);
    const scene = JSON.parse(got.body);
    expect(scene.models[0].rotation.y).toBe(0.5);
    expect(scene.models[0].hidden).toBe(false);

    const del = await server.inject({ method: 'DELETE', url: '/api/storage/scenes/demo-jurado' });
    expect(del.statusCode).toBe(200);
    const missing = await server.inject({ method: 'GET', url: '/api/storage/scenes/demo-jurado' });
    expect(missing.statusCode).toBe(404);
  });

  it('POST /api/storage/scenes rechaza escenas inválidas', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/storage/scenes',
      payload: { ...validScene, models: [{ name: 'x' }] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('GET /api/storage/scenes/:id con id malicioso responde 404', async () => {
    const res = await server.inject({ method: 'GET', url: '/api/storage/scenes/..%2F..%2Fpackage' });
    expect(res.statusCode).toBe(404);
  });

  it('POST /api/storage/upload guarda el archivo y lo sirve de vuelta', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/storage/upload?kind=model&filename=Mi%20Robot.glb',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('glTF-binary-content'),
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.url).toMatch(/^\/api\/storage\/files\/mi-robot-[0-9a-f]{8}\.glb$/);

    const served = await server.inject({ method: 'GET', url: body.url });
    expect(served.statusCode).toBe(200);
    expect(served.body).toBe('glTF-binary-content');

    const models = JSON.parse((await server.inject({ method: 'GET', url: '/api/storage/models' })).body).models;
    expect(models.some((m: { name: string }) => m.name === 'mi robot')).toBe(true);
  });

  it('POST /api/storage/upload rechaza extensiones no permitidas', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/storage/upload?kind=model&filename=script.js',
      headers: { 'content-type': 'application/octet-stream' },
      payload: Buffer.from('alert(1)'),
    });
    expect(res.statusCode).toBe(400);
  });

  it('PUT/GET /api/storage/favorites/:kind persiste los pins', async () => {
    const put = await server.inject({
      method: 'PUT',
      url: '/api/storage/favorites/worlds',
      payload: { ids: ['reference-playground', 'local-a.spz'] },
    });
    expect(put.statusCode).toBe(200);

    const got = await server.inject({ method: 'GET', url: '/api/storage/favorites/worlds' });
    expect(JSON.parse(got.body).ids).toEqual(['reference-playground', 'local-a.spz']);

    const other = await server.inject({ method: 'GET', url: '/api/storage/favorites/models' });
    expect(JSON.parse(other.body).ids).toEqual([]);

    const bad = await server.inject({ method: 'GET', url: '/api/storage/favorites/other' });
    expect(bad.statusCode).toBe(400);
  });
});
