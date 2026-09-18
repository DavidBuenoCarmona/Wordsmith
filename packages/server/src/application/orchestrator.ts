// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { randomUUID } from 'node:crypto';
import {
  WorldPromptInput,
  GenerationJob,
  GenerationProgressEvent,
} from '@wordsmith/shared';
import {
  ILLMProvider,
  IWorldLabsProvider,
  ITripoProvider,
  IJobRepository,
  IEventPublisher,
} from '../domain/ports.js';

export interface OrchestratorContext {
  llmProvider: ILLMProvider;
  worldLabsProvider: IWorldLabsProvider;
  tripoProvider: ITripoProvider;
  jobRepository: IJobRepository;
  eventPublisher: IEventPublisher;
}

export class GenerationOrchestrator {
  constructor(private readonly ctx: OrchestratorContext) {}

  async startJob(input: WorldPromptInput): Promise<GenerationJob> {
    const now = new Date().toISOString();
    const job: GenerationJob = {
      id: randomUUID(),
      prompt: input.prompt,
      phase: 'QUEUED',
      progress: 0,
      message: 'Job encolado para procesamiento.',
      assets: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.ctx.jobRepository.create(job);

    console.log(`\n────────────────────────────────────────────────────────────`);
    console.log(`🚀 [Job Iniciado] ID: ${job.id}`);
    console.log(`📝 [Prompt]: "${input.prompt}" (Estilo: ${input.style}, Max Assets: ${input.maxAssets})`);
    console.log(`────────────────────────────────────────────────────────────`);

    // Lanzar pipeline asíncrono en background
    queueMicrotask(() => {
      this.executePipeline(job.id, input).catch(async (error) => {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido en el pipeline';
        console.error(`❌ [Job Falló] ID: ${job.id} — Error: ${errorMsg}`);
        
        const current = await this.ctx.jobRepository.findById(job.id);
        if (current) {
          current.phase = 'FAILED';
          current.error = errorMsg;
          current.message = `Falló la generación: ${errorMsg}`;
          await this.ctx.jobRepository.update(current);
          this.ctx.eventPublisher.publish({
            jobId: current.id,
            phase: 'FAILED',
            progress: current.progress,
            message: current.message,
            error: errorMsg,
          });
        }
      });
    });

    return job;
  }

  async getJob(id: string): Promise<GenerationJob | null> {
    return this.ctx.jobRepository.findById(id);
  }

  private async executePipeline(jobId: string, input: WorldPromptInput): Promise<void> {
    const job = await this.ctx.jobRepository.findById(jobId);
    if (!job) return;

    // Fase 1: Análisis y descomposición
    await this.updatePhase(job, 'ANALYZING', 15, 'Analizando prompt y descomponiendo escena 3D...');
    console.log(`🧠 [Fase 1/4 - LLM] Descomponiendo prompt en WorldSpec...`);
    
    const worldSpec = await this.ctx.llmProvider.decomposePrompt(input);
    job.worldSpec = worldSpec;
    job.assets = worldSpec.assets.map((a) => ({
      id: a.id,
      name: a.name,
      status: 'PENDING',
    }));
    await this.ctx.jobRepository.update(job);

    console.log(`   ✨ Mundo: "${worldSpec.title}" (Entorno: ${worldSpec.environment.theme})`);
    console.log(`   📦 Assets identificados (${worldSpec.assets.length}): ${worldSpec.assets.map((a) => a.name).join(', ')}`);

    // Fase 2: Generación del entorno (World Labs)
    await this.updatePhase(job, 'GENERATING_WORLD', 35, `Generando entorno 3D (${worldSpec.environment.theme})...`);
    console.log(`🌍 [Fase 2/4 - World Labs] Solicitando generación del entorno...`);
    
    const envResult = await this.ctx.worldLabsProvider.generateEnvironment(worldSpec.environment);
    job.environment = {
      status: 'READY',
      sceneUrl: envResult.sceneUrl,
      previewUrl: envResult.previewUrl,
    };
    await this.ctx.jobRepository.update(job);
    console.log(`   ✅ Entorno listo: ${envResult.sceneUrl}`);

    // Fase 3: Generación de Assets 3D (Tripo)
    await this.updatePhase(job, 'GENERATING_ASSETS', 60, `Generando ${worldSpec.assets.length} assets 3D en paralelo...`);
    console.log(`🧩 [Fase 3/4 - Tripo 3D] Generando ${worldSpec.assets.length} assets en paralelo...`);
    
    const assetPromises = worldSpec.assets.map(async (assetSpec, index) => {
      try {
        console.log(`   ⏳ [Tripo] Generando asset [${assetSpec.id}]: "${assetSpec.name}"...`);
        const assetResult = await this.ctx.tripoProvider.generateAsset(assetSpec);
        job.assets[index] = {
          id: assetSpec.id,
          name: assetSpec.name,
          status: 'READY',
          modelUrl: assetResult.modelUrl,
        };
        console.log(`   ✅ [Tripo] Asset listo [${assetSpec.id}]: ${assetResult.modelUrl}`);
      } catch (err) {
        const errorText = err instanceof Error ? err.message : 'Error generando asset';
        console.error(`   ⚠️ [Tripo] Falló asset [${assetSpec.id}]: ${errorText}`);
        job.assets[index] = {
          id: assetSpec.id,
          name: assetSpec.name,
          status: 'FAILED',
          error: errorText,
        };
      }
    });

    await Promise.all(assetPromises);
    await this.ctx.jobRepository.update(job);

    // Fase 4: Composición
    await this.updatePhase(job, 'COMPOSING', 85, 'Componiendo escena 3D y calculando anclajes espaciales...');
    console.log(`🏗️ [Fase 4/4 - World Builder] Componiendo posiciones espaciales y anclajes en Three.js...`);

    // Fase 5: Completado
    await this.updatePhase(job, 'COMPLETED', 100, '¡Mundo 3D generado y listo para explorar!');
    console.log(`🎉 [Job Completado] ID: ${job.id} — Escena lista para renderizar.`);
    console.log(`────────────────────────────────────────────────────────────\n`);
  }

  private async updatePhase(
    job: GenerationJob,
    phase: GenerationJob['phase'],
    progress: number,
    message: string,
  ): Promise<void> {
    job.phase = phase;
    job.progress = progress;
    job.message = message;
    await this.ctx.jobRepository.update(job);

    const event: GenerationProgressEvent = {
      jobId: job.id,
      phase,
      progress,
      message,
      environment: job.environment,
      assets: job.assets,
      worldSpec: job.worldSpec,
    };

    this.ctx.eventPublisher.publish(event);
  }
}
