// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { ITripoProvider } from '../domain/ports.js';
import { WorldSpec } from '@wordsmith/shared';
import { GenerationStorage } from './generationStorage.js';

interface TripoTaskResponse {
  code: number;
  data: {
    task_id: string;
  };
}

interface TripoTaskStatusResponse {
  code: number;
  data: {
    task_id: string;
    type: string;
    status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
    progress: number;
    output?: {
      model?: string; // URL al archivo .glb
      pbr_model?: string;
      base_model?: string;
      rendered_image?: string;
    };
  };
}

export class HttpTripoProvider implements ITripoProvider {
  private readonly baseUrl: string;
  private readonly pollIntervalMs: number;
  private readonly maxRetries: number;
  private readonly storage: GenerationStorage;

  constructor(
    private readonly apiKey: string,
    baseUrl?: string,
    pollIntervalMs?: number,
    maxRetries?: number,
    storage?: GenerationStorage
  ) {
    let rawUrl = (baseUrl || process.env.TRIPO_BASE_URL || 'https://api.tripo3d.ai/v2/openapi')
      .replace(/\/$/, '')
      .replace('openapi.tripo3d.ai', 'api.tripo3d.ai')
      .replace(/\/v3$/, '')
      .replace(/\/v2\/openapi$/, '');
    this.baseUrl = `${rawUrl}/v2/openapi`;
    this.pollIntervalMs = pollIntervalMs ?? (Number(process.env.TRIPO_POLL_INTERVAL_MS) || 2500);
    this.maxRetries = maxRetries ?? (Number(process.env.TRIPO_MAX_RETRIES) || 60); // 60 * 2.5s = 150 segundos
    this.storage = storage ?? new GenerationStorage();
  }

  async generateAsset(spec: WorldSpec['assets'][number]): Promise<{ modelUrl: string }> {
    try {
      return await this.executeGeneration(spec);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ [Tripo 3D API Error] ${errMsg}. Comprobando almacenamiento local por si no quedan tokens o es una prueba...`);

      const fallback = await this.storage.getTripoFallback(spec);
      if (fallback) {
        console.log(`📦 [Tripo 3D Cache Fallback] Usando modelo guardado para "${spec.name}": ${fallback.modelUrl}`);
        return fallback;
      }

      throw error;
    }
  }

  private async executeGeneration(spec: WorldSpec['assets'][number]): Promise<{ modelUrl: string }> {
    // 1. Iniciar tarea de generación text-to-model (OpenAPI v2)
    const startUrl = `${this.baseUrl}/task`;
    const payload = {
      type: 'text_to_model',
      prompt: `${spec.prompt}, 3D game prop, stylized, centered`,
    };

    const res = await fetch(startUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[Tripo API Error ${res.status}] ${errText}`);
    }

    const taskData = (await res.json()) as TripoTaskResponse;
    const taskId = taskData.data.task_id;

    // 2. Polling hasta que el asset esté completado
    const statusUrl = `${this.baseUrl}/task/${taskId}`;
    let attempts = 0;

    while (attempts < this.maxRetries) {
      await new Promise((r) => setTimeout(r, this.pollIntervalMs));
      attempts++;

      const statusRes = await fetch(statusUrl, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!statusRes.ok) {
        continue;
      }

      const statusJson = (await statusRes.json()) as TripoTaskStatusResponse;
      const { status, output } = statusJson.data;
      const modelUrl = output?.pbr_model || output?.model || output?.base_model;

      if (status === 'success' && modelUrl) {
        const result = {
          modelUrl,
        };

        // Guardar resultado exitoso en storage
        try {
          const savedPath = await this.storage.saveTripo(spec, result, statusJson);
          console.log(`💾 [Tripo Storage] Modelo 3D guardado con éxito en: ${savedPath}`);
        } catch (saveErr) {
          console.warn('⚠️ [Storage] No se pudo guardar la caché de Tripo:', saveErr);
        }

        return result;
      }

      if (status === 'failed' || status === 'cancelled') {
        throw new Error(`[Tripo Task Failed] La generación del asset '${spec.name}' falló en el servidor.`);
      }
    }

    throw new Error(`[Tripo Timeout] Se agotó el tiempo de espera (${(this.pollIntervalMs * this.maxRetries) / 1000}s) generando el asset '${spec.name}'.`);
  }
}
