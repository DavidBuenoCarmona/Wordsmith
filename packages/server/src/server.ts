// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import {
  WorldPromptInputSchema,
  SceneFileSchema,
  FavoritesKindSchema,
  FavoritesBodySchema,
} from '@wordsmith/shared';
import { GenerationOrchestrator } from './application/orchestrator.js';
import { ProviderFactory } from './infrastructure/providerFactory.js';
import {
  InMemoryJobRepository,
  MemoryEventPublisher,
} from './infrastructure/mockProviders.js';
import { GenerationStorage } from './infrastructure/generationStorage.js';

/** Límite de subida de archivos importados (mundos .spz/.ply y modelos .glb pueden ser grandes). */
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

const UploadQuerySchema = z.object({
  kind: z.enum(['world', 'model']),
  filename: z.string().min(1).max(200),
});

export function buildServer(orchestrator?: GenerationOrchestrator, eventPublisher?: MemoryEventPublisher): FastifyInstance {
  const server = Fastify({ logger: false });

  const publisher = eventPublisher ?? new MemoryEventPublisher();
  const repo = new InMemoryJobRepository();
  const storage = new GenerationStorage();
  const orch =
    orchestrator ??
    new GenerationOrchestrator({
      llmProvider: ProviderFactory.createLLMProvider(),
      worldLabsProvider: ProviderFactory.createWorldLabsProvider(),
      tripoProvider: ProviderFactory.createTripoProvider(),
      jobRepository: repo,
      eventPublisher: publisher,
    });

  server.register(cors, {
    origin: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Cuerpo binario crudo para importar archivos (mundos / modelos) desde el navegador
  server.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer', bodyLimit: MAX_UPLOAD_BYTES },
    (_request, body, done) => done(null, body)
  );

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', service: 'wordsmith-orchestrator', timestamp: new Date().toISOString() };
  });

  // Listar todos los mundos guardados (.spz, .glb y caché de generaciones)
  server.get('/api/storage/worlds', async () => {
    const worlds = await storage.listAllSavedWorlds();
    return { worlds };
  });

  // Listar todos los modelos 3D guardados (archivos .glb en storage/models y caché de Tripo)
  server.get('/api/storage/models', async () => {
    const models = await storage.listAllSavedModels();
    return { models };
  });

  // Servir archivos locales (.spz, .splat, .glb)
  server.get('/api/storage/files/:filename', async (request, reply) => {
    const { filename } = request.params as { filename: string };
    const filePath = storage.getLocalFilePath(filename);

    if (!filePath || !fs.existsSync(filePath)) {
      return reply.status(404).send({ error: `File '${filename}' not found in storage.` });
    }

    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.glb') contentType = 'model/gltf-binary';
    else if (ext === '.json') contentType = 'application/json';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';

    reply.header('Content-Type', contentType);
    reply.header('Access-Control-Allow-Origin', '*');
    const stream = fs.createReadStream(filePath);
    return reply.send(stream);
  });

  // Importar un archivo del usuario: se guarda en storage/ para poder incluirlo en escenas guardadas
  server.post('/api/storage/upload', async (request, reply) => {
    const query = UploadQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: 'Invalid upload query', details: query.error.format() });
    }
    if (!Buffer.isBuffer(request.body)) {
      return reply.status(400).send({ error: 'Expected application/octet-stream body.' });
    }

    const saved = await storage.saveUpload(query.data.kind, query.data.filename, request.body);
    if (!saved.ok) {
      return reply.status(400).send({ error: saved.error });
    }
    return reply.status(201).send(saved.value);
  });

  // Escenas guardadas (mundo + modelos con sus transformaciones)
  server.get('/api/storage/scenes', async () => {
    const scenes = await storage.listScenes();
    return { scenes };
  });

  server.get('/api/storage/scenes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const scene = await storage.getScene(id);
    if (!scene) {
      return reply.status(404).send({ error: `Scene '${id}' not found.` });
    }
    return scene;
  });

  server.post('/api/storage/scenes', async (request, reply) => {
    const parsed = SceneFileSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid scene file', details: parsed.error.format() });
    }
    const saved = await storage.saveScene(parsed.data);
    if (!saved.ok) {
      return reply.status(500).send({ error: saved.error });
    }
    return reply.status(201).send(saved.value);
  });

  server.delete('/api/storage/scenes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await storage.deleteScene(id);
    if (!deleted) {
      return reply.status(404).send({ error: `Scene '${id}' not found.` });
    }
    return { deleted: id };
  });

  // Favoritos (pins) de mundos y modelos
  server.get('/api/storage/favorites/:kind', async (request, reply) => {
    const kind = FavoritesKindSchema.safeParse((request.params as { kind: string }).kind);
    if (!kind.success) {
      return reply.status(400).send({ error: 'kind must be "worlds" or "models".' });
    }
    return { ids: await storage.getFavorites(kind.data) };
  });

  server.put('/api/storage/favorites/:kind', async (request, reply) => {
    const kind = FavoritesKindSchema.safeParse((request.params as { kind: string }).kind);
    const body = FavoritesBodySchema.safeParse(request.body);
    if (!kind.success || !body.success) {
      return reply.status(400).send({ error: 'Invalid favorites request.' });
    }
    return { ids: await storage.setFavorites(kind.data, body.data.ids) };
  });

  // Obtener escenario de referencia guardado por defecto
  server.get('/api/storage/reference', async () => {
    return {
      worldSpec: {
        version: '1.0.0',
        title: 'Parque Infantil (Escenario de Referencia)',
        description: 'Parque infantil colorido y soleado con toboganes, columpios, arenero y árboles verdes en un parque público.',
        environment: {
          prompt: 'Parque infantil colorido y soleado con toboganes, columpios, arenero y árboles verdes en un parque público.',
          theme: 'playground',
          lighting: 'day',
          skyboxColor: '#87ceeb',
        },
        assets: [
          {
            id: 'slide-1',
            name: 'Tobogán Infantil',
            prompt: 'Colorful red and yellow playground slide for kids',
            category: 'architecture',
            position: { x: -2, y: 0, z: -1 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            anchorToGround: true,
          },
          {
            id: 'swings-1',
            name: 'Columpios',
            prompt: 'Metal swing set with rubber seats in a park',
            category: 'architecture',
            position: { x: 2, y: 0, z: -2 },
            rotation: { x: 0, y: 0.3, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
            anchorToGround: true,
          },
        ],
      },
      environment: {
        status: 'READY',
        sceneUrl: 'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/d8d581cb-71ae-49d3-945d-d3e889f4c642_ceramic.spz',
        previewUrl: 'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/c82503bc-265c-4d97-981e-0adca15df304_sand_mpi/thumbnail.webp',
      },
    };
  });

  // Iniciar generación de mundo
  server.post('/api/generate', async (request, reply) => {
    const parseResult = WorldPromptInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      console.warn('⚠️ [API] Petición rechazada por validación inválida:', parseResult.error.format());
      return reply.status(400).send({
        error: 'Validation failed',
        details: parseResult.error.format(),
      });
    }

    const job = await orch.startJob(parseResult.data);
    return reply.status(202).send(job);
  });

  // Consultar estado puntual del job
  server.get('/api/jobs/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await orch.getJob(id);
    if (!job) {
      return reply.status(404).send({ error: 'Job not found' });
    }
    return job;
  });

  // Server-Sent Events para streaming en tiempo real del progreso
  server.get('/api/jobs/:id/events', async (request, reply) => {
    const { id } = request.params as { id: string };
    const initialJob = await orch.getJob(id);
    if (!initialJob) {
      return reply.status(404).send({ error: 'Job not found' });
    }

    console.log(`📡 [SSE Client Conectado] Job ID: ${id}`);

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Enviar estado actual inmediato
    reply.raw.write(`data: ${JSON.stringify({
      jobId: initialJob.id,
      phase: initialJob.phase,
      progress: initialJob.progress,
      message: initialJob.message,
      environment: initialJob.environment,
      assets: initialJob.assets,
      worldSpec: initialJob.worldSpec,
    })}\n\n`);

    const unsubscribe = publisher.subscribe(id, (event) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.phase === 'COMPLETED' || event.phase === 'FAILED') {
        unsubscribe();
        reply.raw.end();
      }
    });

    request.raw.on('close', () => {
      console.log(`🔌 [SSE Client Desconectado] Job ID: ${id}`);
      unsubscribe();
    });
  });

  return server;
}
