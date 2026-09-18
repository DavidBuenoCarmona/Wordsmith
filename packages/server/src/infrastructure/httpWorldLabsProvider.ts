// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { IWorldLabsProvider } from '../domain/ports.js';
import { WorldSpec } from '@wordsmith/shared';
import { GenerationStorage } from './generationStorage.js';

interface WorldLabsOperationResponse {
  operation_id: string;
  done: boolean;
  error?: string | null;
  metadata?: {
    world_id?: string;
    progress?: {
      status?: string;
      description?: string;
    };
  };
}

interface WorldLabsWorldDetailResponse {
  world_id: string;
  world_marble_url?: string;
  assets?: {
    thumbnail_url?: string;
    mesh?: {
      collider_mesh_url?: string;
      hq_mesh_url?: string;
    };
    splats?: {
      spz_urls?: Record<string, string>;
    };
  };
}

export class HttpWorldLabsProvider implements IWorldLabsProvider {
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
    this.baseUrl = (baseUrl || process.env.WORLD_LABS_BASE_URL || 'https://api.worldlabs.ai/marble/').replace(/\/$/, '');
    this.pollIntervalMs = pollIntervalMs ?? (Number(process.env.WORLD_LABS_POLL_INTERVAL_MS) || 5000);
    this.maxRetries = maxRetries ?? (Number(process.env.WORLD_LABS_MAX_RETRIES) || 60); // 60 * 5s = 300s (5 min)
    this.storage = storage ?? new GenerationStorage();
  }

  async generateEnvironment(spec: WorldSpec['environment']): Promise<{
    sceneUrl: string;
    previewUrl?: string;
  }> {
    try {
      return await this.executeGeneration(spec);
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.warn(`⚠️ [World Labs API Error] ${errMsg}. Comprobando almacenamiento local por si no quedan tokens o es una prueba...`);

      const fallback = await this.storage.getWorldLabsFallback(spec);
      if (fallback) {
        console.log(`📦 [World Labs Cache Fallback] Usando entorno guardado como base: ${fallback.sceneUrl}`);
        return fallback;
      }

      throw error;
    }
  }

  private async executeGeneration(spec: WorldSpec['environment']): Promise<{
    sceneUrl: string;
    previewUrl?: string;
  }> {
    // 1. Iniciar generación del entorno 3D en World Labs Marble API
    const startUrl = `${this.baseUrl}/v1/worlds:generate`;
    const payload = {
      world_prompt: {
        text_prompt: `${spec.prompt}`,
        type: 'text',
      },
      theme: spec.theme,
      lighting: spec.lighting,
      format: 'gaussian_splat_and_mesh',
    };

    const res = await fetch(startUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'WLT-Api-Key': this.apiKey,
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`[World Labs API Error ${res.status}] ${errText}`);
    }

    const genData = (await res.json()) as { operation_id?: string; world_id?: string };
    const operationId = genData.operation_id;
    let worldId = genData.world_id;

    // 2. Polling de la operación asíncrona
    if (operationId) {
      const opUrl = `${this.baseUrl}/v1/operations/${operationId}`;
      let attempts = 0;

      while (attempts < this.maxRetries) {
        await new Promise((r) => setTimeout(r, this.pollIntervalMs));
        attempts++;

        const opRes = await fetch(opUrl, {
          headers: {
            'WLT-Api-Key': this.apiKey,
            Authorization: `Bearer ${this.apiKey}`,
          },
        });

        if (!opRes.ok) continue;

        const opJson = (await opRes.json()) as WorldLabsOperationResponse;
        if (opJson.metadata?.world_id) {
          worldId = opJson.metadata.world_id;
        }

        if (opJson.done) {
          break;
        }

        if (opJson.error) {
          throw new Error(`[World Labs Failed] ${opJson.error}`);
        }
      }
    }

    // 3. Obtener detalles del World 3D generado
    if (worldId) {
      const worldUrl = `${this.baseUrl}/v1/worlds/${worldId}`;
      const worldRes = await fetch(worldUrl, {
        headers: {
          'WLT-Api-Key': this.apiKey,
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (worldRes.ok) {
        const worldData = (await worldRes.json()) as WorldLabsWorldDetailResponse;
        const meshUrl = worldData.assets?.mesh?.collider_mesh_url || worldData.assets?.mesh?.hq_mesh_url;
        const splatUrl = worldData.assets?.splats?.spz_urls?.full_res || worldData.assets?.splats?.spz_urls?.['500k'];
        
        const result = {
          sceneUrl: meshUrl || splatUrl || worldData.world_marble_url || `https://marble.worldlabs.ai/world/${worldId}`,
          previewUrl: worldData.assets?.thumbnail_url,
        };

        // Guardar resultado exitoso en el directorio de storage
        try {
          const savedPath = await this.storage.saveWorldLabs(spec, result, worldData);
          console.log(`💾 [World Labs Storage] Entorno guardado con éxito en: ${savedPath}`);
        } catch (saveErr) {
          console.warn('⚠️ [Storage] No se pudo guardar la caché de World Labs:', saveErr);
        }

        return result;
      }
    }

    const fallbackResult = {
      sceneUrl: `https://marble.worldlabs.ai/world/${worldId || operationId}`,
    };

    try {
      await this.storage.saveWorldLabs(spec, fallbackResult);
    } catch {
      // Ignorar errores no críticos de persistencia
    }

    return fallbackResult;
  }
}
