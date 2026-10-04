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
    console.log(`🧠 [Fase 1/3 - LLM] Descomponiendo prompt en WorldSpec...`);
    
    const worldSpec = await this.ctx.llmProvider.decomposePrompt(input);
    job.worldSpec = worldSpec;
    job.environment = { status: 'PENDING' };
    job.assets = worldSpec.assets.map((a) => ({
      id: a.id,
      name: a.name,
      status: 'PENDING',
    }));
    await this.ctx.jobRepository.update(job);

    console.log(`   ✨ Mundo: "${worldSpec.title}" (Entorno: ${worldSpec.environment.theme})`);
    console.log(`   📦 Assets identificados (${worldSpec.assets.length}): ${worldSpec.assets.map((a) => a.name).join(', ')}`);

    // Fase 2: Generación concurrente (World Labs + Tripo 3D)
    await this.updatePhase(
      job,
      'GENERATING_WORLD',
      20,
      `Generando entorno 3D y ${worldSpec.assets.length} assets en paralelo...`
    );
    console.log(`⚡ [Fase 2/3 - Generación Concurrente] Disparando World Labs y ${worldSpec.assets.length} assets de Tripo simultáneamente...`);

    const totalTasks = 1 + worldSpec.assets.length;
    let completedTasks = 0;
    const baseProgress = 20;
    const maxGenProgress = 85;
    const progressPerTask = (maxGenProgress - baseProgress) / Math.max(totalTasks, 1);

    const onTaskCompleted = async (itemDesc: string) => {
      completedTasks++;
      const currentProgress = Math.round(baseProgress + (completedTasks * progressPerTask));
      const phase: GenerationJob['phase'] =
        job.environment?.status === 'READY' ? 'GENERATING_ASSETS' : 'GENERATING_WORLD';
      await this.updatePhase(
        job,
        phase,
        currentProgress,
        `Progreso: ${completedTasks}/${totalTasks} elementos listos (${itemDesc})`
      );
    };

    // Tarea concurrente: Entorno (World Labs)
    const worldLabsPromise = (async () => {
      try {
        console.log(`🌍 [World Labs] Solicitando generación del entorno...`);
        job.environment = { status: 'GENERATING' };
        await this.ctx.jobRepository.update(job);

        const envResult = await this.ctx.worldLabsProvider.generateEnvironment(worldSpec.environment);
        job.environment = {
          status: 'READY',
          sceneUrl: envResult.sceneUrl,
          previewUrl: envResult.previewUrl,
        };
        console.log(`   ✅ [World Labs] Entorno listo: ${envResult.sceneUrl}`);
      } catch (err) {
        const errorText = err instanceof Error ? err.message : 'Error generando entorno';
        console.error(`   ⚠️ [World Labs] Falló entorno: ${errorText}`);
        job.environment = {
          status: 'FAILED',
          error: errorText,
        };
      } finally {
        await onTaskCompleted('Entorno World Labs');
      }
    })();

    // Tareas concurrentes: Assets 3D (Tripo)
    const assetPromises = worldSpec.assets.map(async (assetSpec, index) => {
      try {
        console.log(`   ⏳ [Tripo] Generando asset [${assetSpec.id}]: "${assetSpec.name}"...`);
        job.assets[index].status = 'GENERATING';
        await this.ctx.jobRepository.update(job);

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
      } finally {
        await onTaskCompleted(`Asset ${assetSpec.name}`);
      }
    });

    // Esperar a que TODAS las tareas concurrentes finalicen
    await Promise.all([worldLabsPromise, ...assetPromises]);

    // Fase 3: Composición final
    await this.updatePhase(job, 'COMPOSING', 90, 'Componiendo escena 3D y calculando anclajes espaciales...');
    console.log(`🏗️ [Fase 3/3 - World Builder] Componiendo posiciones espaciales y anclajes en Three.js...`);

    // Finalizado
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
