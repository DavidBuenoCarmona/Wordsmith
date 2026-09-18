// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { WorldPromptInputSchema } from '@wordsmith/shared';
import { GenerationOrchestrator } from './application/orchestrator.js';
import { ProviderFactory } from './infrastructure/providerFactory.js';
import {
  InMemoryJobRepository,
  MemoryEventPublisher,
} from './infrastructure/mockProviders.js';

export function buildServer(orchestrator?: GenerationOrchestrator, eventPublisher?: MemoryEventPublisher): FastifyInstance {
  const server = Fastify({ logger: false });

  const publisher = eventPublisher ?? new MemoryEventPublisher();
  const repo = new InMemoryJobRepository();
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
  });

  // Health check
  server.get('/health', async () => {
    return { status: 'ok', service: 'wordsmith-orchestrator', timestamp: new Date().toISOString() };
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
