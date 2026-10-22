// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import {
  WorldSpec,
  SceneFile,
  SceneFileSchema,
  SceneIdSchema,
  SceneSummary,
  FavoritesKind,
} from '@wordsmith/shared';

export type StorageResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type UploadKind = 'world' | 'model';

const UPLOAD_EXTENSIONS: Record<UploadKind, readonly string[]> = {
  world: ['.spz', '.ply', '.splat', '.glb', '.gltf', '.png', '.jpg', '.jpeg'],
  model: ['.glb', '.gltf'],
};

/** Nombre legible de un archivo local: sin el sufijo de hash de las importaciones y sin guiones. */
export function displayName(baseName: string): string {
  return baseName.replace(/-[0-9a-f]{8}$/, '').replace(/[-_]/g, ' ');
}

/** Comparador alfabético estable: sin distinguir mayúsculas/acentos y con números naturales. */
export function compareByName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base', numeric: true });
}

export interface CachedWorldLabsRecord {
  id: string;
  prompt: string;
  theme: string;
  lighting?: string;
  sceneUrl: string;
  previewUrl?: string;
  panoUrl?: string;
  colliderMeshUrl?: string;
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

export interface SavedWorldItem {
  id: string;
  name: string;
  description: string;
  theme: string;
  sceneUrl: string;
  previewUrl?: string;
  colliderUrl?: string;
  type: 'spz' | 'ply' | 'glb' | 'pano';
  source: 'local_file' | 'generation_cache' | 'reference';
  createdAt?: string;
}

export interface SavedModelItem {
  id: string;
  name: string;
  description?: string;
  prompt?: string;
  category?: string;
  modelUrl: string;
  source: 'local_file' | 'generation_cache' | 'reference';
  createdAt?: string;
}

export class GenerationStorage {
  private readonly rootDir: string;
  private readonly baseDir: string;
  private readonly worldsDir: string;
  private readonly modelsDir: string;
  private readonly worldLabsDir: string;
  private readonly tripoDir: string;
  private readonly scenesDir: string;
  private readonly favoritesPath: string;

  constructor(customBaseDir?: string) {
    if (customBaseDir) {
      this.baseDir = customBaseDir;
      this.rootDir = path.dirname(customBaseDir);
    } else if (process.env.WORDSMITH_STORAGE_DIR) {
      this.baseDir = process.env.WORDSMITH_STORAGE_DIR;
      this.rootDir = path.dirname(this.baseDir);
    } else {
      const detected = this.detectStorageDir();
      this.baseDir = detected.baseDir;
      this.rootDir = detected.rootDir;
    }

    this.worldsDir = path.join(this.rootDir, 'storage', 'worlds');
    this.modelsDir = path.join(this.rootDir, 'storage', 'models');
    this.worldLabsDir = path.join(this.baseDir, 'worldlabs');
    this.tripoDir = path.join(this.baseDir, 'tripo');
    this.scenesDir = path.join(this.rootDir, 'storage', 'scenes');
    this.favoritesPath = path.join(this.rootDir, 'storage', 'favorites.json');

    this.ensureDirectories();
  }

  private detectStorageDir(): { baseDir: string; rootDir: string } {
    let current = process.cwd();
    for (let i = 0; i < 4; i++) {
      const pkgPath = path.join(current, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.name === 'wordsmith-root' || pkg.workspaces) {
            return {
              baseDir: path.join(current, 'storage', 'generations'),
              rootDir: current,
            };
          }
        } catch {
          // Ignorar error de parseo y seguir
        }
      }
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }

    return {
      baseDir: path.join(process.cwd(), 'storage', 'generations'),
      rootDir: process.cwd(),
    };
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(this.worldsDir)) {
      fs.mkdirSync(this.worldsDir, { recursive: true });
    }
    if (!fs.existsSync(this.modelsDir)) {
      fs.mkdirSync(this.modelsDir, { recursive: true });
    }
    if (!fs.existsSync(this.worldLabsDir)) {
      fs.mkdirSync(this.worldLabsDir, { recursive: true });
    }
    if (!fs.existsSync(this.tripoDir)) {
      fs.mkdirSync(this.tripoDir, { recursive: true });
    }
    if (!fs.existsSync(this.scenesDir)) {
      fs.mkdirSync(this.scenesDir, { recursive: true });
    }
  }

  public getWorldsDir(): string {
    return this.worldsDir;
  }

  public getModelsDir(): string {
    return this.modelsDir;
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
          // Los registros guardados por la app conservan el colisionador dentro de rawResponse
          const rawCollider = parsed.rawResponse?.assets?.mesh?.collider_mesh_url;
          if (!parsed.colliderMeshUrl && typeof rawCollider === 'string') {
            parsed.colliderMeshUrl = rawCollider;
          }
          records.push(parsed);
        } else if (parsed.world?.assets?.splats?.spz_urls?.full_res || parsed.world?.assets?.splats?.spz_urls?.['500k'] || parsed.world?.assets?.mesh?.collider_mesh_url) {
          const w = parsed.world || parsed.operation?.response;
          const splatUrl = w.assets?.splats?.spz_urls?.full_res || w.assets?.splats?.spz_urls?.['500k'];
          records.push({
            id: w.world_id || file.replace('.json', ''),
            prompt: w.world_prompt?.text_prompt || w.display_name || 'Cached Playground',
            theme: 'playground',
            sceneUrl: splatUrl || w.assets?.mesh?.collider_mesh_url || w.world_marble_url,
            previewUrl: w.assets?.thumbnail_url,
            panoUrl: w.assets?.imagery?.pano_url,
            colliderMeshUrl: w.assets?.mesh?.collider_mesh_url,
            createdAt: new Date().toISOString(),
            rawResponse: parsed,
          });
        }
      } catch {
        // Ignorar
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
      const match = list.find((r) => r.theme && r.theme.toLowerCase().includes(spec.theme!.toLowerCase()));
      if (match) return { sceneUrl: match.sceneUrl, previewUrl: match.previewUrl };
    }

    if (spec?.prompt) {
      const promptLower = spec.prompt.toLowerCase();
      const match = list.find((r) => r.prompt && (r.prompt.toLowerCase().includes(promptLower) || promptLower.includes(r.theme?.toLowerCase() || '')));
      if (match) return { sceneUrl: match.sceneUrl, previewUrl: match.previewUrl };
    }

    // Si no se pasó spec (búsqueda genérica abierta), retornar el más reciente
    if (!spec || (!spec.theme && !spec.prompt)) {
      const latest = list[0];
      return { sceneUrl: latest.sceneUrl, previewUrl: latest.previewUrl };
    }

    return null;
  }

  // --- Listado Consolidado de Mundos Guardados (para el selector de la UI) ---

  async listAllSavedWorlds(): Promise<SavedWorldItem[]> {
    this.ensureDirectories();
    const results: SavedWorldItem[] = [];
    const seenUrls = new Set<string>();

    // 1. Escanear directorio dedicado storage/worlds/ por archivos locales (.spz, .splat, .glb, .json)
    if (fs.existsSync(this.worldsDir)) {
      const localFiles = await fs.promises.readdir(this.worldsDir);
      for (const file of localFiles) {
        const ext = path.extname(file).toLowerCase();
        const baseName = path.basename(file, ext);

        if (ext === '.spz' || ext === '.splat' || ext === '.ply') {
          const fileUrl = `/api/storage/files/${encodeURIComponent(file)}`;
          seenUrls.add(fileUrl);
          results.push({
            id: `local-${file}`,
            name: `${displayName(baseName)} (Local ${ext.toUpperCase().replace('.', '')})`,
            description: `Archivo local 3D Gaussian Splatting en storage/worlds/${file}`,
            theme: baseName,
            sceneUrl: fileUrl,
            type: ext === '.ply' ? 'ply' : 'spz',
            source: 'local_file',
          });
        } else if (ext === '.png' || ext === '.jpg' || ext === '.jpeg') {
          const fileUrl = `/api/storage/files/${encodeURIComponent(file)}`;
          seenUrls.add(fileUrl);
          results.push({
            id: `local-${file}`,
            name: `${displayName(baseName)} (Local 360)`,
            description: `Panorama 360 local en storage/worlds/${file}`,
            theme: baseName,
            sceneUrl: fileUrl,
            type: 'pano',
            source: 'local_file',
          });
        } else if (ext === '.glb') {
          const fileUrl = `/api/storage/files/${encodeURIComponent(file)}`;
          seenUrls.add(fileUrl);
          results.push({
            id: `local-${file}`,
            name: `${displayName(baseName)} (Local GLB)`,
            description: `Archivo local 3D GLB en storage/worlds/${file}`,
            theme: baseName,
            sceneUrl: fileUrl,
            type: 'glb',
            source: 'local_file',
          });
        }
      }
    }

    // 2. Escanear registros en storage/generations/worldlabs/
    const cachedList = await this.listWorldLabs();
    for (const item of cachedList) {
      if (seenUrls.has(item.sceneUrl)) continue;
      seenUrls.add(item.sceneUrl);

      const isSpz = item.sceneUrl.includes('.spz') || item.sceneUrl.includes('.splat');
      const isGlb = item.sceneUrl.includes('.glb');

      results.push({
        id: item.id,
        name: item.theme ? `${item.theme.charAt(0).toUpperCase() + item.theme.slice(1)}` : 'Mundo Guardado',
        description: item.prompt || 'Mundo 3D generado',
        theme: item.theme || 'custom',
        sceneUrl: item.sceneUrl,
        previewUrl: item.previewUrl,
        colliderUrl: item.colliderMeshUrl,
        type: isSpz ? 'spz' : isGlb ? 'glb' : 'pano',
        source: 'generation_cache',
        createdAt: item.createdAt,
      });
    }

    // 3. Incluir el Parque Infantil de Referencia oficial si no está ya
    const defaultPlaygroundUrl = 'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/d8d581cb-71ae-49d3-945d-d3e889f4c642_ceramic.spz';
    if (!seenUrls.has(defaultPlaygroundUrl)) {
      results.push({
        id: 'reference-playground',
        name: 'Parque Infantil (World Labs)',
        description: 'Escenario completo 3D Gaussian Splatting de parque infantil con toboganes, columpios y arenero.',
        theme: 'playground',
        sceneUrl: defaultPlaygroundUrl,
        previewUrl: 'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/c82503bc-265c-4d97-981e-0adca15df304_sand_mpi/thumbnail.webp',
        colliderUrl: 'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/49925c3c.glb',
        type: 'spz',
        source: 'reference',
      });
    }

    return results.sort(compareByName);
  }

  // --- Listado Consolidado de Modelos 3D Guardados (para el selector de modelos de la UI) ---

  async listAllSavedModels(): Promise<SavedModelItem[]> {
    this.ensureDirectories();
    const results: SavedModelItem[] = [];
    const seenUrls = new Set<string>();

    // 1. Escanear directorio dedicado storage/models/ por archivos locales (.glb, .gltf)
    if (fs.existsSync(this.modelsDir)) {
      const localFiles = await fs.promises.readdir(this.modelsDir);
      for (const file of localFiles) {
        const ext = path.extname(file).toLowerCase();
        const baseName = path.basename(file, ext);

        if (ext === '.glb' || ext === '.gltf') {
          const fileUrl = `/api/storage/files/${encodeURIComponent(file)}`;
          seenUrls.add(fileUrl);
          results.push({
            id: `local-model-${file}`,
            name: displayName(baseName),
            description: `Modelo 3D local GLB en storage/models/${file}`,
            modelUrl: fileUrl,
            category: 'prop',
            source: 'local_file',
          });
        }
      }
    }

    // 2. Escanear registros en storage/generations/tripo/
    const cachedTripoList = await this.listTripo();
    for (const item of cachedTripoList) {
      if (seenUrls.has(item.modelUrl)) continue;
      seenUrls.add(item.modelUrl);

      results.push({
        id: item.id,
        name: item.name || 'Modelo Tripo 3D',
        description: item.prompt || 'Modelo 3D generado con Tripo',
        prompt: item.prompt,
        category: item.category || 'prop',
        modelUrl: item.modelUrl,
        source: 'generation_cache',
        createdAt: item.createdAt,
      });
    }

    return results.sort(compareByName);
  }

  // Resolver ruta de archivo local para servirlo
  getLocalFilePath(filename: string): string | null {
    const safeName = path.basename(filename);
    const p1 = path.join(this.worldsDir, safeName);
    if (fs.existsSync(p1)) return p1;

    const p2 = path.join(this.modelsDir, safeName);
    if (fs.existsSync(p2)) return p2;

    const p3 = path.join(this.worldLabsDir, safeName);
    if (fs.existsSync(p3)) return p3;

    const p4 = path.join(this.tripoDir, safeName);
    if (fs.existsSync(p4)) return p4;

    return null;
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

    let finalModelUrl = result.modelUrl;

    // Descargar el archivo binario .glb localmente para que nunca expire la URL firmada de S3
    if (result.modelUrl && result.modelUrl.startsWith('http')) {
      try {
        const fetchRes = await fetch(result.modelUrl);
        if (fetchRes.ok) {
          const buffer = Buffer.from(await fetchRes.arrayBuffer());
          const glbFilename = `${slug}_${id}.glb`;
          const localGlbPath = path.join(this.modelsDir, glbFilename);
          await fs.promises.writeFile(localGlbPath, buffer);
          finalModelUrl = `/api/storage/files/${encodeURIComponent(glbFilename)}`;
          result.modelUrl = finalModelUrl;
          console.log(`💾 [Storage] Modelo GLB descargado y guardado permanentemente en: ${localGlbPath}`);
        }
      } catch (err) {
        console.warn('⚠️ [Storage] No se pudo descargar localmente el GLB de Tripo:', err);
      }
    }

    const record: CachedTripoRecord = {
      id,
      name: spec.name,
      prompt: spec.prompt,
      category: spec.category,
      modelUrl: finalModelUrl,
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
        // Ignorar
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

    const latest = list[0];
    return { modelUrl: latest.modelUrl };
  }

  // --- Escenas guardadas (JSON: mundo + modelos con posición/rotación/escala) ---

  static sceneIdFromName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
      .replace(/-+$/g, '');
  }

  private static summarizeScene(id: string, scene: SceneFile): SceneSummary {
    return {
      id,
      name: scene.name,
      savedAt: scene.savedAt,
      worldName: scene.world?.name ?? null,
      modelCount: scene.models.length,
    };
  }

  async saveScene(scene: SceneFile): Promise<StorageResult<SceneSummary>> {
    this.ensureDirectories();
    const id = GenerationStorage.sceneIdFromName(scene.name) || 'scene';
    let result: StorageResult<SceneSummary>;

    try {
      await fs.promises.writeFile(
        path.join(this.scenesDir, `${id}.json`),
        JSON.stringify(scene, null, 2),
        'utf8'
      );
      result = { ok: true, value: GenerationStorage.summarizeScene(id, scene) };
    } catch (err) {
      result = { ok: false, error: `No se pudo guardar la escena: ${(err as Error).message}` };
    }

    return result;
  }

  async getScene(id: string): Promise<SceneFile | null> {
    let scene: SceneFile | null = null;

    if (SceneIdSchema.safeParse(id).success) {
      try {
        const content = await fs.promises.readFile(path.join(this.scenesDir, `${id}.json`), 'utf8');
        const parsed = SceneFileSchema.safeParse(JSON.parse(content));
        scene = parsed.success ? parsed.data : null;
      } catch {
        scene = null;
      }
    }

    return scene;
  }

  async listScenes(): Promise<SceneSummary[]> {
    this.ensureDirectories();
    const files = await fs.promises.readdir(this.scenesDir);
    const summaries: SceneSummary[] = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      const id = path.basename(file, '.json');
      const scene = await this.getScene(id);
      if (scene) summaries.push(GenerationStorage.summarizeScene(id, scene));
    }

    return summaries.sort(compareByName);
  }

  async deleteScene(id: string): Promise<boolean> {
    let deleted = false;

    if (SceneIdSchema.safeParse(id).success) {
      try {
        await fs.promises.unlink(path.join(this.scenesDir, `${id}.json`));
        deleted = true;
      } catch {
        deleted = false;
      }
    }

    return deleted;
  }

  // --- Importación de archivos del usuario (persisten para poder guardarse en escenas) ---

  /**
   * Guarda un archivo importado en storage/worlds o storage/models con un nombre
   * derivado del hash del contenido: reimportar el mismo archivo no crea duplicados.
   */
  async saveUpload(
    kind: UploadKind,
    originalName: string,
    data: Buffer
  ): Promise<StorageResult<{ filename: string; url: string; name: string }>> {
    this.ensureDirectories();
    const ext = path.extname(originalName).toLowerCase();
    let result: StorageResult<{ filename: string; url: string; name: string }>;

    if (!UPLOAD_EXTENSIONS[kind].includes(ext)) {
      result = { ok: false, error: `Extensión '${ext || '(ninguna)'}' no permitida para ${kind}.` };
    } else if (data.length === 0) {
      result = { ok: false, error: 'El archivo está vacío.' };
    } else {
      const baseName = path.basename(originalName, ext);
      const slug = this.slugify(baseName) || kind;
      const hash = crypto.createHash('sha1').update(data).digest('hex').slice(0, 8);
      const filename = `${slug}-${hash}${ext}`;
      const dir = kind === 'world' ? this.worldsDir : this.modelsDir;
      const filePath = path.join(dir, filename);

      try {
        if (!fs.existsSync(filePath)) {
          await fs.promises.writeFile(filePath, data);
        }
        result = {
          ok: true,
          value: {
            filename,
            url: `/api/storage/files/${encodeURIComponent(filename)}`,
            name: displayName(baseName),
          },
        };
      } catch (err) {
        result = { ok: false, error: `No se pudo guardar el archivo: ${(err as Error).message}` };
      }
    }

    return result;
  }

  // --- Favoritos (pins) de mundos y modelos ---

  async getFavorites(kind: FavoritesKind): Promise<string[]> {
    const all = await this.readFavoritesFile();
    return all[kind];
  }

  async setFavorites(kind: FavoritesKind, ids: string[]): Promise<string[]> {
    const all = await this.readFavoritesFile();
    all[kind] = Array.from(new Set(ids));
    await fs.promises.mkdir(path.dirname(this.favoritesPath), { recursive: true });
    await fs.promises.writeFile(this.favoritesPath, JSON.stringify(all, null, 2), 'utf8');
    return all[kind];
  }

  private async readFavoritesFile(): Promise<Record<FavoritesKind, string[]>> {
    const empty: Record<FavoritesKind, string[]> = { worlds: [], models: [] };
    const onlyStrings = (value: unknown): string[] =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    let result = empty;

    try {
      const content = await fs.promises.readFile(this.favoritesPath, 'utf8');
      const parsed = JSON.parse(content) as Partial<Record<FavoritesKind, unknown>>;
      result = { worlds: onlyStrings(parsed.worlds), models: onlyStrings(parsed.models) };
    } catch {
      result = empty;
    }

    return result;
  }
}
