// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { SceneFile, SceneFileSchema, SceneSummary, SceneSummarySchema } from '@wordsmith/shared';
import { z } from 'zod';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function errorMessage(res: Response, fallback: string): Promise<string> {
  let message = fallback;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // Cuerpo no JSON: se usa el mensaje genérico
  }
  return message;
}

export async function listScenes(): Promise<Result<SceneSummary[]>> {
  let result: Result<SceneSummary[]>;
  try {
    const res = await fetch('/api/storage/scenes');
    if (res.ok) {
      const parsed = z.object({ scenes: z.array(SceneSummarySchema) }).safeParse(await res.json());
      result = parsed.success
        ? { ok: true, value: parsed.data.scenes }
        : { ok: false, error: 'Respuesta de escenas inválida.' };
    } else {
      result = { ok: false, error: await errorMessage(res, 'No se pudieron listar las escenas.') };
    }
  } catch {
    result = { ok: false, error: 'Sin conexión con el servidor.' };
  }
  return result;
}

export async function loadScene(id: string): Promise<Result<SceneFile>> {
  let result: Result<SceneFile>;
  try {
    const res = await fetch(`/api/storage/scenes/${encodeURIComponent(id)}`);
    if (res.ok) {
      const parsed = SceneFileSchema.safeParse(await res.json());
      result = parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: 'El fichero de escena no es válido.' };
    } else {
      result = { ok: false, error: await errorMessage(res, 'No se pudo cargar la escena.') };
    }
  } catch {
    result = { ok: false, error: 'Sin conexión con el servidor.' };
  }
  return result;
}

export async function saveScene(scene: SceneFile): Promise<Result<SceneSummary>> {
  let result: Result<SceneSummary>;
  try {
    const res = await fetch('/api/storage/scenes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(scene),
    });
    result = res.ok
      ? { ok: true, value: (await res.json()) as SceneSummary }
      : { ok: false, error: await errorMessage(res, 'No se pudo guardar la escena.') };
  } catch {
    result = { ok: false, error: 'Sin conexión con el servidor.' };
  }
  return result;
}

export async function deleteScene(id: string): Promise<Result<true>> {
  let result: Result<true>;
  try {
    const res = await fetch(`/api/storage/scenes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    result = res.ok ? { ok: true, value: true } : { ok: false, error: await errorMessage(res, 'No se pudo borrar la escena.') };
  } catch {
    result = { ok: false, error: 'Sin conexión con el servidor.' };
  }
  return result;
}

export interface UploadedFile {
  filename: string;
  url: string;
  name: string;
}

/** Sube un archivo importado a storage/ para que persista y pueda guardarse en escenas. */
export async function uploadFile(kind: 'world' | 'model', file: File): Promise<Result<UploadedFile>> {
  let result: Result<UploadedFile>;
  try {
    const res = await fetch(
      `/api/storage/upload?kind=${kind}&filename=${encodeURIComponent(file.name)}`,
      { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file }
    );
    result = res.ok
      ? { ok: true, value: (await res.json()) as UploadedFile }
      : { ok: false, error: await errorMessage(res, 'No se pudo importar el archivo.') };
  } catch {
    result = { ok: false, error: 'Sin conexión con el servidor.' };
  }
  return result;
}

/** Tipo de mundo a partir de la extensión / URL. */
export function guessWorldType(nameOrUrl: string): 'spz' | 'ply' | 'glb' | 'pano' {
  const lower = nameOrUrl.toLowerCase();
  let type: 'spz' | 'ply' | 'glb' | 'pano' = 'spz';
  if (/\.(png|jpe?g)(\b|$|#|\?)/.test(lower) || lower.includes('panos')) type = 'pano';
  else if (/\.(glb|gltf)(\b|$|#|\?)/.test(lower)) type = 'glb';
  else if (/\.ply(\b|$|#|\?)/.test(lower)) type = 'ply';
  return type;
}
