// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../src/server.js';
import { GenerationOrchestrator } from '../src/application/orchestrator.js';
import {
  MockLLMProvider,
  MockWorldLabsProvider,
  MockTripoProvider,
  InMemoryJobRepository,
  MemoryEventPublisher,
} from '../src/infrastructure/mockProviders.js';

describe('Server Integration & Orchestrator Pipeline', () => {
  let server: FastifyInstance;
  let repo: InMemoryJobRepository;
  let publisher: MemoryEventPublisher;
  let orchestrator: GenerationOrchestrator;

  beforeEach(async () => {
    repo = new InMemoryJobRepository();
    publisher = new MemoryEventPublisher();
    orchestrator = new GenerationOrchestrator({
      llmProvider: new MockLLMProvider(),
      worldLabsProvider: new MockWorldLabsProvider(10),
      tripoProvider: new MockTripoProvider(10),
      jobRepository: repo,
      eventPublisher: publisher,
    });
    server = buildServer(orchestrator, publisher);
    await server.ready();
  });

  afterEach(async () => {
    await server.close();
  });

  it('GET /health debe retornar status ok', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('wordsmith-orchestrator');
  });

  it('POST /api/generate debe rechazar prompts inválidos (<5 chars)', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/generate',
      payload: {
        prompt: 'abc',
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it('POST /api/generate debe crear un job e iniciar la generación asíncrona', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/api/generate',
      payload: {
        prompt: 'Isla pirata con un galeón hundido y cofre de oro',
        maxAssets: 2,
        style: 'stylized',
      },
    });

    expect(res.statusCode).toBe(202);
    const job = JSON.parse(res.body);
    expect(job.id).toBeDefined();
    expect(job.phase).toBe('QUEUED');

    // Esperar a que el pipeline asíncrono complete (con mocks tarda < 100ms)
    await new Promise((resolve) => setTimeout(resolve, 150));

    const statusRes = await server.inject({
      method: 'GET',
      url: `/api/jobs/${job.id}`,
    });

    expect(statusRes.statusCode).toBe(200);
    const finalJob = JSON.parse(statusRes.body);
    expect(finalJob.phase).toBe('COMPLETED');
    expect(finalJob.progress).toBe(100);
    expect(finalJob.environment.sceneUrl).toContain('worldlabs.ai');
    expect(finalJob.assets).toHaveLength(2);
    expect(finalJob.assets[0].status).toBe('READY');
  });
});
