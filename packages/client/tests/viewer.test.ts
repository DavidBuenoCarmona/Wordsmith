// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as THREE from 'three';
import { WorldSpec } from '@wordsmith/shared';

// Polyfill minimal de Canvas / DOM para Three.js y TransformControls en Node
function createMockDomElement() {
  const listeners: Record<string, Function[]> = {};
  return {
    clientWidth: 800,
    clientHeight: 600,
    style: {},
    tabIndex: 0,
    ownerDocument: {
      addEventListener: (event: string, fn: Function) => {
        listeners[event] = listeners[event] || [];
        listeners[event].push(fn);
      },
      removeEventListener: (event: string, fn: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((f) => f !== fn);
        }
      },
    },
    addEventListener: (event: string, fn: Function) => {
      listeners[event] = listeners[event] || [];
      listeners[event].push(fn);
    },
    removeEventListener: (event: string, fn: Function) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((f) => f !== fn);
      }
    },
    dispatchEvent: (event: Event) => true,
    focus: () => {},
    getBoundingClientRect: () => ({
      left: 0,
      top: 0,
      width: 800,
      height: 600,
      right: 800,
      bottom: 600,
    }),
    parentElement: null as any,
  };
}

// Mock Three.js WebGLRenderer constructor
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class MockWebGLRenderer {
    domElement = createMockDomElement();
    setSize = vi.fn();
    setPixelRatio = vi.fn();
    shadowMap = { enabled: true, type: actual.PCFSoftShadowMap };
    outputColorSpace = actual.SRGBColorSpace;
    render = vi.fn();
    dispose = vi.fn();
  }

  return {
    ...actual,
    WebGLRenderer: MockWebGLRenderer as unknown as typeof actual.WebGLRenderer,
  };
});

// Mock SparkRenderer & SplatMesh para Node
vi.mock('@sparkjsdev/spark', () => {
  class MockSparkRenderer extends THREE.Object3D {
    constructor() {
      super();
    }
  }

  class MockSplatMesh extends THREE.Object3D {
    constructor() {
      super();
    }
  }

  const SplatFileType = {
    PLY: 'ply',
    SPZ: 'spz',
    SPLAT: 'splat',
    KSPLAT: 'ksplat',
    PCSOGS: 'pcsogs',
    PCSOGSZIP: 'pcsogszip',
    RAD: 'rad',
  };

  return {
    SparkRenderer: MockSparkRenderer,
    SplatMesh: MockSplatMesh,
    SplatFileType,
  };
});

// Import WorldViewer3D after mocks
import { WorldViewer3D } from '../src/viewer/WorldViewer3D.js';

function createMockContainer(): HTMLElement {
  const container = {
    clientWidth: 800,
    clientHeight: 600,
    appendChild: (child: any) => {
      child.parentElement = container;
    },
    removeChild: (child: any) => {
      child.parentElement = null;
    },
  } as unknown as HTMLElement;

  return container;
}

describe('WorldViewer3D - Transform Gizmo & Selection (Unit & Integration)', () => {
  let viewer: WorldViewer3D;
  let container: HTMLElement;
  const onAssetSelected = vi.fn();
  const onAssetTransformed = vi.fn();
  const onAssetDeleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    container = createMockContainer();
    viewer = new WorldViewer3D(container, {
      onAssetSelected,
      onAssetTransformed,
      onAssetDeleted,
    });
  });

  it('debe instanciar y permitir seleccionar y deseleccionar un asset', () => {
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
          id: 'test-chest-1',
          name: 'Cofre de Oro',
          prompt: 'Chest',
          category: 'prop',
          position: { x: 2, y: 0, z: -3 },
          rotation: { x: 0, y: 1.5, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          anchorToGround: true,
        },
      ],
    };

    viewer.applyWorldSpec(sampleSpec, 'https://example.com/scene.spz', {
      'test-chest-1': 'https://example.com/chest.glb',
    });

    expect(viewer.getSelectedAssetId()).toBeNull();

    // Seleccionar asset
    viewer.selectAsset('test-chest-1');
    expect(viewer.getSelectedAssetId()).toBe('test-chest-1');
    expect(onAssetSelected).toHaveBeenCalledWith(
      'test-chest-1',
      expect.any(THREE.Vector3),
      expect.any(THREE.Euler)
    );

    // Deseleccionar asset
    viewer.deselectAsset();
    expect(viewer.getSelectedAssetId()).toBeNull();
    expect(onAssetSelected).toHaveBeenCalledWith(null);
  });

  it('debe cambiar el modo de transformación entre translate y rotate', () => {
    viewer.setTransformMode('rotate');
    viewer.setTransformMode('translate');
  });

  it('debe ajustar la elevación al suelo con snapSelectedToGround()', () => {
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
          id: 'asset-floating',
          name: 'Flotando',
          prompt: 'Floating object',
          category: 'prop',
          position: { x: 5, y: 10, z: 5 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          anchorToGround: true,
        },
      ],
    };

    viewer.applyWorldSpec(sampleSpec, 'https://example.com/scene.spz', {
      'asset-floating': 'https://example.com/mesh.glb',
    });

    viewer.selectAsset('asset-floating');
    viewer.snapSelectedToGround();

    expect(onAssetTransformed).toHaveBeenCalledWith(
      'asset-floating',
      expect.objectContaining({
        x: 5,
        y: viewer.getGroundLevel(),
        z: 5,
      }),
      expect.objectContaining({
        x: 0,
        y: 0,
        z: 0,
      })
    );
  });

  it('debe cambiar de selección entre múltiples assets', () => {
    const multiSpec: WorldSpec = {
      version: '1.0.0',
      title: 'Mundo Multi-Asset',
      description: 'Test selección múltiple',
      environment: {
        prompt: 'Forest',
        theme: 'forest',
        lighting: 'day',
        skyboxColor: '#87ceeb',
      },
      assets: [
        {
          id: 'tree-1',
          name: 'Árbol Roble',
          prompt: 'Oak tree',
          category: 'prop',
          position: { x: 1, y: 0, z: 2 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          anchorToGround: true,
        },
        {
          id: 'rock-1',
          name: 'Roca Grande',
          prompt: 'Big rock',
          category: 'prop',
          position: { x: -3, y: 0, z: -1 },
          rotation: { x: 0, y: 0.5, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          anchorToGround: true,
        },
      ],
    };

    viewer.applyWorldSpec(multiSpec, 'https://example.com/scene.glb');

    viewer.selectAsset('tree-1');
    expect(viewer.getSelectedAssetId()).toBe('tree-1');
    expect(onAssetSelected).toHaveBeenLastCalledWith(
      'tree-1',
      expect.any(THREE.Vector3),
      expect.any(THREE.Euler)
    );

    viewer.selectAsset('rock-1');
    expect(viewer.getSelectedAssetId()).toBe('rock-1');
    expect(onAssetSelected).toHaveBeenLastCalledWith(
      'rock-1',
      expect.any(THREE.Vector3),
      expect.any(THREE.Euler)
    );
  });

  it('debe bloquear la navegación de cámara durante el arrastre del gizmo', () => {
    const spec: WorldSpec = {
      version: '1.0.0',
      title: 'Test Dragging Lock',
      description: 'Prueba de bloqueo de cámara',
      environment: {
        prompt: 'Cave',
        theme: 'cave',
        lighting: 'night',
        skyboxColor: '#000000',
      },
      assets: [
        {
          id: 'crystal-1',
          name: 'Cristal Mágico',
          prompt: 'Crystal',
          category: 'prop',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          anchorToGround: true,
        },
      ],
    };

    viewer.applyWorldSpec(spec, 'https://example.com/scene.glb');
    viewer.selectAsset('crystal-1');

    // Simular evento dragging-changed de TransformControls
    const transformControls = (viewer as any).transformControls;
    expect(transformControls).toBeDefined();

    transformControls.dispatchEvent({ type: 'dragging-changed', value: true });
    expect((viewer as any).isDraggingGizmo).toBe(true);

    transformControls.dispatchEvent({ type: 'dragging-changed', value: false });
    expect((viewer as any).isDraggingGizmo).toBe(false);
    expect(onAssetTransformed).toHaveBeenCalledWith(
      'crystal-1',
      expect.objectContaining({ x: 0, y: viewer.getGroundLevel(), z: 0 }),
      expect.objectContaining({ x: 0, y: 0, z: 0 })
    );
  });

  it('debe limpiar mapa y entidades al invocar clearScene o clearEnvironment', () => {
    const spec: WorldSpec = {
      version: '1.0.0',
      title: 'Test Clean Scene',
      description: 'Prueba de limpieza de escena',
      environment: {
        prompt: 'Desert',
        theme: 'desert',
        lighting: 'day',
      },
      assets: [
        {
          id: 'cactus-1',
          name: 'Cactus',
          prompt: 'Cactus',
          category: 'prop',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
          anchorToGround: true,
        },
      ],
    };

    viewer.applyWorldSpec(spec, 'https://example.com/desert.glb');
    expect((viewer as any).assetMeshes.length).toBe(1);
    expect((viewer as any).environmentMesh).toBeDefined();

    viewer.clearScene();
    expect((viewer as any).assetMeshes.length).toBe(0);
    expect((viewer as any).environmentMesh).toBeNull();
    expect((viewer as any).defaultGround.visible).toBe(true);
    expect((viewer as any).gridHelper.visible).toBe(true);
  });
});

