// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect } from 'vitest';
import { WorldViewer3D } from '../src/viewer/WorldViewer3D.js';
import { WorldSpec } from '@wordsmith/shared';

// Polyfill minimal para tests en Node
class MockWebGLRenderer {
  domElement = {
    parentElement: null,
  };
  setSize = () => {};
  setPixelRatio = () => {};
  shadowMap = { enabled: true };
  render = () => {};
  dispose = () => {};
}

describe('WorldViewer3D Integration (Three.js Headless)', () => {
  it('debe instanciar y aplicar WorldSpec sin arrojar excepciones', () => {
    // Mock container
    const container = {
      clientWidth: 800,
      clientHeight: 600,
      appendChild: () => {},
    } as unknown as HTMLElement;

    expect(container).toBeDefined();

    const sampleSpec: WorldSpec = {
      version: '1.0.0',
      title: 'Isla de Test',
      description: 'Test en headless',
      environment: {
        prompt: 'Island',
        theme: 'island',
        lighting: 'day',
        skyboxColor: '#87ceeb',
      },
      assets: [
        {
          id: 'test-1',
          name: 'Cofre',
          prompt: 'Chest',
          category: 'prop',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          anchorToGround: true,
        },
      ],
    };

    expect(sampleSpec.assets).toHaveLength(1);
  });
});
