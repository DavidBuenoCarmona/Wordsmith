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
      expect.any(THREE.Euler),
      expect.any(THREE.Vector3)
    );

    // Deseleccionar asset
    viewer.deselectAsset();
    expect(viewer.getSelectedAssetId()).toBeNull();
    expect(onAssetSelected).toHaveBeenCalledWith(null);
  });

  it('debe cambiar el modo de transformación entre translate, rotate y scale', () => {
    viewer.setTransformMode('rotate');
    expect((viewer as any).transformMode).toBe('rotate');
    viewer.setTransformMode('scale');
    expect((viewer as any).transformMode).toBe('scale');
    viewer.setTransformMode('translate');
    expect((viewer as any).transformMode).toBe('translate');
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
        y: viewer.getGroundLevel() + 0.5, // pivote centrado: la base queda sobre el suelo con media altura (1 m estimado)
        z: 5,
      }),
      expect.objectContaining({
        x: 0,
        y: 0,
        z: 0,
      }),
      expect.objectContaining({
        x: 1,
        y: 1,
        z: 1,
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
      expect.any(THREE.Euler),
      expect.any(THREE.Vector3)
    );

    viewer.selectAsset('rock-1');
    expect(viewer.getSelectedAssetId()).toBe('rock-1');
    expect(onAssetSelected).toHaveBeenLastCalledWith(
      'rock-1',
      expect.any(THREE.Vector3),
      expect.any(THREE.Euler),
      expect.any(THREE.Vector3)
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
      expect.objectContaining({ x: 0, y: viewer.getGroundLevel() + 0.5, z: 0 }),
      expect.objectContaining({ x: 0, y: 0, z: 0 }),
      expect.objectContaining({ x: 1, y: 1, z: 1 })
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

  it('debe mantener desactivado el entrelazado en modo 2D estándar para evitar borrosidad', () => {
    expect((viewer as any).isInterlaceActive).toBe(false);

    viewer.setInterlaceMode('interlaced');
    if ((viewer as any).interlacer) {
      expect((viewer as any).isInterlaceActive).toBe(true);
    }

    viewer.setInterlaceMode('2d');
    expect((viewer as any).isInterlaceActive).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// v0.4.0 — Outliner, foco de cámara, edición numérica, historial, suelo y escenas
// -----------------------------------------------------------------------------
describe('WorldViewer3D v0.4.0 - edición de escena', () => {
  let viewer: WorldViewer3D;
  const onObjectsChanged = vi.fn();
  const onAssetTransformed = vi.fn();
  const onAssetDeleted = vi.fn();

  const spec = (): WorldSpec => ({
    version: '1.0.0',
    title: 'Escena v0.4',
    description: 'Tests de edición',
    environment: { prompt: 'Park', theme: 'park', lighting: 'day', skyboxColor: '#87ceeb' },
    assets: [
      {
        id: 'a-1',
        name: 'Banco',
        prompt: 'Bench',
        category: 'prop',
        position: { x: 4, y: 0, z: -4 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        anchorToGround: true,
      },
      {
        id: 'a-2',
        name: 'Árbol',
        prompt: 'Tree',
        category: 'nature',
        position: { x: -3, y: 0, z: 2 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
        anchorToGround: true,
      },
    ],
  });

  const groupOf = (id: string): THREE.Group =>
    (viewer as any).assetMeshes.find((g: THREE.Group) => g.name === id);

  beforeEach(() => {
    vi.clearAllMocks();
    viewer = new WorldViewer3D(createMockContainer(), { onObjectsChanged, onAssetTransformed, onAssetDeleted });
    // Sin red en los tests: los modelos de los marcadores no se descargan
    (viewer as any).gltfLoader.load = () => {};
    viewer.applyWorldSpec(spec(), undefined, {
      'a-1': 'https://example.com/bench.glb',
      'a-2': 'blob:http://localhost/tree',
    });
  });

  it('listObjects expone todos los objetos con nombre, visibilidad y bloqueo', () => {
    expect(viewer.listObjects()).toEqual([
      { id: 'a-1', name: 'Banco', visible: true, locked: false },
      { id: 'a-2', name: 'Árbol', visible: true, locked: false },
    ]);
    expect(onObjectsChanged).toHaveBeenCalled();
  });

  it('setAssetTransform aplica coordenadas numéricas y se puede deshacer / rehacer', () => {
    viewer.selectAsset('a-1');
    const group = groupOf('a-1');
    const originalY = group.position.y;

    viewer.setAssetTransform('a-1', { position: { x: 10, z: -2 }, rotation: { y: Math.PI / 2 }, scale: { x: 2 } });
    expect(group.position.x).toBe(10);
    expect(group.position.z).toBe(-2);
    expect(group.position.y).toBe(originalY);
    expect(group.rotation.y).toBeCloseTo(Math.PI / 2);
    expect(group.scale.x).toBe(2);
    expect(onAssetTransformed).toHaveBeenLastCalledWith(
      'a-1',
      expect.objectContaining({ x: 10, z: -2 }),
      expect.objectContaining({ y: expect.closeTo(Math.PI / 2) }),
      expect.objectContaining({ x: 2 })
    );

    expect(viewer.undo()).toBe(true);
    expect(group.position.x).toBe(4);
    expect(group.scale.x).toBe(1);
    expect(viewer.redo()).toBe(true);
    expect(group.position.x).toBe(10);
  });

  it('ignora valores no finitos y limita la escala mínima', () => {
    viewer.setAssetTransform('a-1', { position: { x: NaN }, scale: { y: -5 } });
    const group = groupOf('a-1');
    expect(group.position.x).toBe(4);
    expect(group.scale.y).toBeGreaterThan(0);
  });

  it('renombrar, ocultar y bloquear actualizan la lista; un objeto bloqueado no se mueve', () => {
    viewer.renameAsset('a-1', '  Banco del parque ');
    expect(viewer.listObjects()[0].name).toBe('Banco del parque');
    viewer.undo();
    expect(viewer.listObjects()[0].name).toBe('Banco');

    viewer.selectAsset('a-1');
    viewer.setAssetVisible('a-1', false);
    expect(viewer.getSelectedAssetId()).toBeNull();
    expect(viewer.listObjects()[0].visible).toBe(false);
    viewer.selectAsset('a-1');
    expect(viewer.getSelectedAssetId()).toBeNull();
    viewer.setAssetVisible('a-1', true);

    viewer.setAssetLocked('a-1', true);
    viewer.setAssetTransform('a-1', { position: { x: 99 } });
    expect(groupOf('a-1').position.x).toBe(4);
  });

  it('focusAsset (tecla F) lleva la cámara frente al objeto y lo deja centrado', () => {
    expect(viewer.focusAsset('a-1')).toBe(true);
    (viewer as any).updateCameraTween(5); // avanza la transición hasta el final

    const camera = (viewer as any).camera as THREE.PerspectiveCamera;
    const group = groupOf('a-1');
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    const toObject = group.position.clone().sub(camera.position).normalize();

    expect(forward.dot(toObject)).toBeGreaterThan(0.99);
    expect(camera.position.distanceTo(group.position)).toBeGreaterThan(1);
    expect((viewer as any).cameraTween).toBeNull();
  });

  it('focusAsset sin selección enmarca todos los objetos y devuelve false si no hay ninguno', () => {
    expect(viewer.focusAsset()).toBe(true);
    viewer.clearAssets();
    expect(viewer.focusAsset()).toBe(false);
  });

  it('duplicateSelected crea una copia con nombre único y se deshace con undo', () => {
    viewer.selectAsset('a-1');
    const cloneId = viewer.duplicateSelected();
    expect(cloneId).not.toBeNull();
    expect(viewer.listObjects().map((o) => o.name)).toContain('Banco 2');
    expect(viewer.listObjects()).toHaveLength(3);

    viewer.undo();
    expect(viewer.listObjects()).toHaveLength(2);
  });

  it('borrar un objeto se puede deshacer y rehacer', () => {
    viewer.selectAsset('a-2');
    viewer.deleteSelectedAsset();
    expect(viewer.listObjects()).toHaveLength(1);
    expect(onAssetDeleted).toHaveBeenCalledWith('a-2');

    viewer.undo();
    expect(viewer.listObjects()).toHaveLength(2);
    viewer.redo();
    expect(viewer.listObjects()).toHaveLength(1);
  });

  it('suelo manual (floorOverride) tiene prioridad y "Floor" apoya la base del objeto sobre él', () => {
    viewer.setFloorOverride(3);
    expect(viewer.getGroundHeightAt(0, 0)).toBe(3);

    viewer.selectAsset('a-1');
    viewer.snapSelectedToGround();
    expect(groupOf('a-1').position.y).toBeCloseTo(3.5); // suelo + media altura estimada

    viewer.setFloorOverride(null);
    expect(viewer.getGroundHeightAt(0, 0)).toBeCloseTo(viewer.getGroundLevel());
  });

  it('el rayo de suelo parte de la altura del objeto: no sube a techos ni superficies superiores', () => {
    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(50, 50), new THREE.MeshBasicMaterial());
    ceiling.rotation.x = Math.PI / 2; // normal hacia abajo => techo
    ceiling.position.y = 20;
    ceiling.updateMatrixWorld(true);
    (viewer as any).environmentMesh = ceiling;
    expect(viewer.getGroundHeightAt(0, 0, 5)).toBeCloseTo(viewer.getGroundLevel());

    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 50),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    );
    table.rotation.x = -Math.PI / 2; // normal hacia arriba
    table.position.y = 1;
    table.updateMatrixWorld(true);
    (viewer as any).environmentMesh = table;
    expect(viewer.getGroundHeightAt(0, 0, 5)).toBeCloseTo(1);
  });

  it('serializeModels guarda posición/rotación/escala y omite objetos sin URL persistente', () => {
    const { models, skipped } = viewer.serializeModels();
    expect(models).toHaveLength(1);
    expect(models[0]).toMatchObject({
      name: 'Banco',
      modelUrl: 'https://example.com/bench.glb',
      position: { x: 4, z: -4 },
      scale: { x: 1, y: 1, z: 1 },
      hidden: false,
      locked: false,
    });
    expect(skipped).toBe(1); // el blob: no es persistente
  });

  it('con un objeto seleccionado W/E/R son del gizmo: WASD solo vuela con el ratón pulsado', () => {
    const camera = (viewer as any).camera as THREE.PerspectiveCamera;
    viewer.selectAsset('a-1');
    (viewer as any).keysDown.add('KeyW');

    const start = camera.position.clone();
    (viewer as any).updateNavigation(1);
    expect(camera.position.distanceTo(start)).toBe(0);

    (viewer as any).isPointerDown = true;
    (viewer as any).updateNavigation(1);
    expect(camera.position.distanceTo(start)).toBeGreaterThan(0);
  });

  it('sin selección WASD vuela libremente', () => {
    const camera = (viewer as any).camera as THREE.PerspectiveCamera;
    const start = camera.position.clone();
    (viewer as any).keysDown.add('KeyW');
    (viewer as any).updateNavigation(1);
    expect(camera.position.distanceTo(start)).toBeGreaterThan(0);
  });

  it('el modo presentación orbita alrededor de los objetos y se detiene', () => {
    const camera = (viewer as any).camera as THREE.PerspectiveCamera;
    viewer.setAutoOrbit(true);
    expect(viewer.isAutoOrbiting()).toBe(true);

    (viewer as any).updateAutoOrbit(0);
    const first = camera.position.clone();
    (viewer as any).updateAutoOrbit(2);
    expect(camera.position.distanceTo(first)).toBeGreaterThan(0.1);

    viewer.setAutoOrbit(false);
    expect(viewer.isAutoOrbiting()).toBe(false);
  });

  it('los presets de iluminación cambian el fondo y la niebla', () => {
    viewer.setLightingPreset('night');
    expect(viewer.getLightingPreset()).toBe('night');
    expect(((viewer as any).scene.background as THREE.Color).getHexString()).toBe('02030a');

    viewer.setLightingPreset('foggy');
    expect((viewer as any).scene.fog).not.toBeNull();
    viewer.setLightingPreset('day');
    expect((viewer as any).scene.fog).toBeNull();
  });

  it('getCameraPose / setCameraPose son simétricos (restaurar una escena guardada)', () => {
    viewer.setCameraPose({ position: { x: 1, y: 2, z: 3 }, rotation: { x: -0.2, y: 1.1, z: 0 } });
    const pose = viewer.getCameraPose();
    expect(pose.position).toEqual({ x: 1, y: 2, z: 3 });
    expect(pose.rotation.y).toBeCloseTo(1.1);
    expect(pose.rotation.x).toBeCloseTo(-0.2);
  });
});


// -----------------------------------------------------------------------------
// Modo "solo objetos": los modelos generados se añaden en fila delante de la cámara
// -----------------------------------------------------------------------------
describe('WorldViewer3D - spawnModelsInFront (añadir objetos generados a la escena)', () => {
  let viewer: WorldViewer3D;

  beforeEach(() => {
    viewer = new WorldViewer3D(createMockContainer());
    // Cargador GLB simulado: una caja de 1 x 2 x 1 m
    (viewer as any).gltfLoader.load = (_url: string, onLoad: (gltf: { scene: THREE.Group }) => void) => {
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()));
      onLoad({ scene });
    };
  });

  const items = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ url: `/api/storage/files/pirata-${i}.glb`, name: 'Pirata' }));

  it('coloca N objetos en fila delante de la cámara, apoyados en el suelo y con nombres únicos', async () => {
    const { ids, failed } = await viewer.spawnModelsInFront(items(3));
    expect(failed).toBe(0);
    expect(ids).toHaveLength(3);

    const objs = viewer.listObjects();
    expect(objs.map((o) => o.name).sort()).toEqual(['Pirata', 'Pirata 2', 'Pirata 3']);
    expect(viewer.getSelectedAssetId()).toBeNull();

    const groups = (viewer as any).assetMeshes as THREE.Group[];
    const xs = groups.map((g) => g.position.x).sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-2.2);
    expect(xs[1]).toBeCloseTo(0);
    expect(xs[2]).toBeCloseTo(2.2);
    for (const g of groups) {
      expect(g.position.z).toBeCloseTo(-4); // 4 m al frente (la cámara mira a -Z)
      expect(g.position.y).toBeCloseTo(viewer.getGroundLevel() + 1); // base sobre el suelo (media altura = 1 m)
    }
  });

  it('la fila sigue la dirección horizontal de la cámara', async () => {
    (viewer as any).euler.y = Math.PI / 2; // mirando hacia -X
    await viewer.spawnModelsInFront(items(2));
    const groups = (viewer as any).assetMeshes as THREE.Group[];
    for (const g of groups) expect(g.position.x).toBeCloseTo(-4);
    const zs = groups.map((g) => g.position.z).sort((a, b) => a - b);
    expect(zs[1] - zs[0]).toBeCloseTo(2.2);
  });

  it('cuenta los modelos que no se pudieron cargar y se pueden deshacer uno a uno', async () => {
    let calls = 0;
    (viewer as any).gltfLoader.load = (
      _url: string,
      onLoad: (gltf: { scene: THREE.Group }) => void,
      _p: unknown,
      onError: (e: Error) => void
    ) => {
      calls++;
      if (calls === 2) {
        onError(new Error('404'));
        return;
      }
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
      onLoad({ scene });
    };

    const { ids, failed } = await viewer.spawnModelsInFront(items(3));
    expect(ids).toHaveLength(2);
    expect(failed).toBe(1);
    expect(viewer.listObjects()).toHaveLength(2);

    viewer.undo();
    expect(viewer.listObjects()).toHaveLength(1);
  });

  it('separa los objetos según su tamaño real para que no se solapen y aleja la fila si son grandes', async () => {
    (viewer as any).gltfLoader.load = (_url: string, onLoad: (gltf: { scene: THREE.Group }) => void) => {
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), new THREE.MeshBasicMaterial()));
      onLoad({ scene });
    };

    await viewer.spawnModelsInFront(items(3));
    const groups = (viewer as any).assetMeshes as THREE.Group[];
    const xs = groups.map((g) => g.position.x).sort((a, b) => a - b);

    expect(xs[1] - xs[0]).toBeCloseTo(5.2); // ancho 4 m + hueco 1,2 m
    expect(xs[2] - xs[1]).toBeCloseTo(5.2);
    expect(xs[0] + xs[2]).toBeCloseTo(0); // fila centrada frente a la cámara
    for (const g of groups) {
      expect(g.position.z).toBeCloseTo(-5); // ancho/2 + 3 m > 4 m por defecto
      expect(g.position.y).toBeCloseTo(viewer.getGroundLevel() + 0.5); // base sobre el suelo
    }
  });

  it('con lista vacía no hace nada', async () => {
    expect(await viewer.spawnModelsInFront([])).toEqual({ ids: [], failed: 0 });
  });
});
