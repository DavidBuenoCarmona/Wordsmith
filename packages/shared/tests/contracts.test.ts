// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect } from 'vitest';
import {
  WorldPromptInputSchema,
  WorldSpecSchema,
  GenerationJobSchema,
  GenerationProgressEventSchema,
} from '../src/index.js';

describe('Contracts & Schemas Suite (packages/shared)', () => {
  describe('WorldPromptInputSchema', () => {
    it('debe validar correctamente un prompt válido', () => {
      const input = {
        prompt: 'Isla pirata con un barco hundido y un cofre del tesoro',
        maxAssets: 3,
        style: 'stylized',
      };

      const result = WorldPromptInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.prompt).toBe(input.prompt);
      }
    });

    it('debe fallar si el prompt es demasiado corto (< 5 chars)', () => {
      const input = { prompt: 'hola' };
      const result = WorldPromptInputSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('debe aplicar defaults para maxAssets y style', () => {
      const input = { prompt: 'Un bosque mágico con árboles brillantes' };
      const result = WorldPromptInputSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.maxAssets).toBe(3);
        expect(result.data.style).toBe('stylized');
      }
    });
  });

  describe('WorldSpecSchema', () => {
    it('debe validar una especificación de mundo 3D completa', () => {
      const spec = {
        title: 'Isla Pirata',
        description: 'Una pequeña isla tropical con restos de una batalla naval.',
        environment: {
          prompt: 'Tropical sandy island with palm trees and ocean shore',
          theme: 'pirate-island',
          lighting: 'sunset',
          skyboxColor: '#ff7f50',
        },
        assets: [
          {
            id: 'shipwreck-1',
            name: 'Barco destruido',
            prompt: 'Destroyed pirate galleon shipwreck on sand',
            category: 'architecture',
            position: { x: 5, y: 0, z: -2 },
          },
          {
            id: 'chest-1',
            name: 'Cofre del tesoro',
            prompt: 'Glowing open wooden pirate treasure chest with gold coins',
            category: 'prop',
            position: { x: 1, y: 0, z: 2 },
          },
        ],
      };

      const result = WorldSpecSchema.safeParse(spec);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.version).toBe('1.0.0');
        expect(result.data.assets).toHaveLength(2);
        expect(result.data.assets[0].rotation).toEqual({ x: 0, y: 0, z: 0 });
        expect(result.data.assets[0].scale).toEqual({ x: 1, y: 1, z: 1 });
      }
    });

    it('debe rechazar si no tiene al menos 1 asset o supera 5', () => {
      const specWithoutAssets = {
        title: 'Mundo vacío',
        description: 'Sin assets',
        environment: {
          prompt: 'Empty plain',
          theme: 'plain',
        },
        assets: [],
      };

      const result = WorldSpecSchema.safeParse(specWithoutAssets);
      expect(result.success).toBe(false);
    });
  });

  describe('GenerationJobSchema & Events', () => {
    it('debe validar un Job completo con su ciclo de vida y fechas', () => {
      const now = new Date().toISOString();
      const job = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        prompt: 'Isla pirata con robot',
        phase: 'GENERATING_ASSETS',
        progress: 60,
        message: 'Generando assets en Tripo 3D...',
        assets: [
          {
            id: 'robot-1',
            name: 'Robot Pirata',
            status: 'GENERATING',
          },
        ],
        createdAt: now,
        updatedAt: now,
      };

      const result = GenerationJobSchema.safeParse(job);
      expect(result.success).toBe(true);
    });

    it('debe validar eventos SSE de progreso', () => {
      const event = {
        jobId: '123e4567-e89b-12d3-a456-426614174000',
        phase: 'COMPLETED',
        progress: 100,
        message: 'Escena 3D unificada y lista para explorar',
      };

      const result = GenerationProgressEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  });
});
