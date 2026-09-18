// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import { WorldSpec } from '@wordsmith/shared';

export interface CachedWorldLabsRecord {
  id: string;
  prompt: string;
  theme: string;
  lighting?: string;
  sceneUrl: string;
  previewUrl?: string;
  createdAt: string;
  rawResponse?: unknown;
}

export interface CachedTripoRecord {
  id: string;
  name: string;
  prompt: string;
  category?: string;
  modelUrl: string;
  createdAt: string;
  rawResponse?: unknown;
}

export class GenerationStorage {
  private readonly baseDir: string;
  private readonly worldLabsDir: string;
  private readonly tripoDir: string;

  constructor(customBaseDir?: string) {
    if (customBaseDir) {
      this.baseDir = customBaseDir;
    } else if (process.env.WORDSMITH_STORAGE_DIR) {
      this.baseDir = process.env.WORDSMITH_STORAGE_DIR;
    } else {
      this.baseDir = this.detectStorageDir();
    }

    this.worldLabsDir = path.join(this.baseDir, 'worldlabs');
    this.tripoDir = path.join(this.baseDir, 'tripo');

    this.ensureDirectories();
  }

  private detectStorageDir(): string {
    let current = process.cwd();
    // Buscar la raíz del proyecto (donde esté package.json de wordsmith-root)
    for (let i = 0; i < 4; i++) {
      const pkgPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name === 'wordsmith-root' || pkg.workspaces) {
            return path.join(current, 'storage', 'generations');
          }
        } catch {
          // Ignorar error de parseo y seguir
        }
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    return path.join(process.cwd(), 'storage', 'generations');
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.worldLabsDir)) {
      fs.mkdirSync(this.worldLabsDir, { recursive: true });
    }
    if (!fs.existsSync(this.tripoDir)) {
      fs.mkdirSync(this.tripoDir, { recursive: true });
    }
  }

  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  // --- World Labs Cache ---

  async saveWorldLabs(
    spec: WorldSpec['environment'],
    result: { sceneUrl: string; previewUrl?: string },
    rawResponse?: unknown
  ): Promise<string> {
    this.ensureDirectories();
    const id = (rawResponse as { world_id?: string })?.world_id || `wl-${Date.now()}`;
    const slug = this.slugify(spec.theme || spec.prompt || 'world');
    const filename = `${slug}_${id.slice(0, 8)}.json`;
    const filePath = path.join(this.worldLabsDir, filename);

    const record: CachedWorldLabsRecord = {
      id,
      prompt: spec.prompt,
      theme: spec.theme,
      lighting: spec.lighting,
      sceneUrl: result.sceneUrl,
      previewUrl: result.previewUrl,
      createdAt: new Date().toISOString(),
      rawResponse,
    };

    await fs.promises.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
    return filePath;
  }

  async listWorldLabs(): Promise<CachedWorldLabsRecord[]> {
    this.ensureDirectories();
    const files = await fs.promises.readdir(this.worldLabsDir);
    const records: CachedWorldLabsRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.promises.readFile(path.join(this.worldLabsDir, file), 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.sceneUrl) {
          records.push(parsed);
        } else if (parsed.world?.assets?.mesh?.collider_mesh_url || parsed.operation?.response?.assets?.mesh?.collider_mesh_url) {
          // Soporte para archivos crudos como reference-playground.json
          const w = parsed.world || parsed.operation?.response;
          records.push({
            id: w.world_id || file.replace('.json', ''),
            prompt: w.world_prompt?.text_prompt || w.display_name || 'Cached Playground',
            theme: 'playground',
            sceneUrl: w.assets?.mesh?.collider_mesh_url || w.assets?.splats?.spz_urls?.full_res || w.world_marble_url,
            previewUrl: w.assets?.thumbnail_url,
            createdAt: new Date().toISOString(),
            rawResponse: parsed,
          });
        }
      } catch {
        // Ignorar archivos corruptos
      }
    }

    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getWorldLabsFallback(
    spec?: Partial<WorldSpec['environment']>
  ): Promise<{ sceneUrl: string; previewUrl?: string } | null> {
    const list = await this.listWorldLabs();
    if (list.length === 0) {
      return null;
    }

    if (spec?.theme) {
      const match = list.find((r) => r.theme.toLowerCase().includes(spec.theme!.toLowerCase()));
      if (match) return { sceneUrl: match.sceneUrl, previewUrl: match.previewUrl };
    }

    if (spec?.prompt) {
      const promptLower = spec.prompt.toLowerCase();
      const match = list.find((r) => r.prompt.toLowerCase().includes(promptLower) || promptLower.includes(r.theme.toLowerCase()));
      if (match) return { sceneUrl: match.sceneUrl, previewUrl: match.previewUrl };
    }

    // Si no hay coincidencia exacta, devolver el más reciente disponible
    const latest = list[0];
    return { sceneUrl: latest.sceneUrl, previewUrl: latest.previewUrl };
  }

  // --- Tripo 3D Cache ---

  async saveTripo(
    spec: WorldSpec['assets'][number],
    result: { modelUrl: string },
    rawResponse?: unknown
  ): Promise<string> {
    this.ensureDirectories();
    const id = spec.id || `tripo-${Date.now()}`;
    const slug = this.slugify(spec.name || spec.prompt || 'asset');
    const filename = `${slug}_${id}.json`;
    const filePath = path.join(this.tripoDir, filename);

    const record: CachedTripoRecord = {
      id,
      name: spec.name,
      prompt: spec.prompt,
      category: spec.category,
      modelUrl: result.modelUrl,
      createdAt: new Date().toISOString(),
      rawResponse,
    };

    await fs.promises.writeFile(filePath, JSON.stringify(record, null, 2), 'utf8');
    return filePath;
  }

  async listTripo(): Promise<CachedTripoRecord[]> {
    this.ensureDirectories();
    const files = await fs.promises.readdir(this.tripoDir);
    const records: CachedTripoRecord[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await fs.promises.readFile(path.join(this.tripoDir, file), 'utf8');
        const parsed = JSON.parse(content);
        if (parsed.modelUrl) {
          records.push(parsed);
        }
      } catch {
        // Ignorar archivos corruptos
      }
    }

    return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getTripoFallback(
    spec?: Partial<WorldSpec['assets'][number]>
  ): Promise<{ modelUrl: string } | null> {
    const list = await this.listTripo();
    if (list.length === 0) {
      return null;
    }

    if (spec?.id) {
      const match = list.find((r) => r.id === spec.id);
      if (match) return { modelUrl: match.modelUrl };
    }

    if (spec?.name) {
      const nameLower = spec.name.toLowerCase();
      const match = list.find((r) => r.name.toLowerCase().includes(nameLower) || nameLower.includes(r.name.toLowerCase()));
      if (match) return { modelUrl: match.modelUrl };
    }

    if (spec?.prompt) {
      const promptLower = spec.prompt.toLowerCase();
      const match = list.find((r) => r.prompt.toLowerCase().includes(promptLower) || promptLower.includes(r.prompt.toLowerCase()));
      if (match) return { modelUrl: match.modelUrl };
    }

    // Si no hay coincidencia exacta, devolver el más reciente disponible
    const latest = list[0];
    return { modelUrl: latest.modelUrl };
  }
}
