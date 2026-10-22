// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { SparkRenderer, SplatMesh, SplatFileType } from '@sparkjsdev/spark';
import { WorldSpec, LightingPreset, SceneModel } from '@wordsmith/shared';
import {
  InterlaceRenderer,
  type Calibration,
  type RenderOptions,
  type Profile,
} from 'jupiter-interlace-sdk';

export interface SceneObjectInfo {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface TransformState {
  position: Vec3Like;
  rotation: Vec3Like;
  scale: Vec3Like;
}

export interface FloorInfo {
  /** Altura de suelo fijada manualmente (null = detección automática). */
  override: number | null;
  /** Altura de suelo base del mundo cargado. */
  level: number;
}

export interface SpawnExtra {
  rotation?: Vec3Like;
  scale?: Vec3Like;
  hidden?: boolean;
  locked?: boolean;
  /** Por defecto el modelo recién añadido queda seleccionado. */
  select?: boolean;
  /** Con posición explícita, ajusta solo la altura para apoyar el modelo sobre el suelo. */
  snapToGround?: boolean;
}

type HistoryEntry =
  | { kind: 'transform'; id: string; before: TransformState; after: TransformState }
  | { kind: 'add'; group: THREE.Group }
  | { kind: 'delete'; group: THREE.Group }
  | { kind: 'rename'; id: string; before: string; after: string };

const HISTORY_LIMIT = 100;
const MIN_SCALE = 0.01;

const LIGHTING_PRESETS: Record<
  LightingPreset,
  {
    ambient: [number, number];
    directional: [number, number, [number, number, number]];
    hemisphere: [number, number, number];
    background: string;
    fog: number | null;
  }
> = {
  day: {
    ambient: [0xffffff, 1.2],
    directional: [0xffffff, 1.5, [20, 35, 20]],
    hemisphere: [0xffffff, 0x1e293b, 0.8],
    background: '#0a0a0a',
    fog: null,
  },
  sunset: {
    ambient: [0xffb27a, 0.7],
    directional: [0xff8a4c, 1.6, [-30, 10, 15]],
    hemisphere: [0xff9966, 0x3b1d2e, 0.6],
    background: '#1f1020',
    fog: null,
  },
  night: {
    ambient: [0x6b7fd7, 0.25],
    directional: [0x9db4ff, 0.5, [10, 30, -10]],
    hemisphere: [0x223355, 0x050510, 0.3],
    background: '#02030a',
    fog: null,
  },
  foggy: {
    ambient: [0xcfd8e3, 1.0],
    directional: [0xffffff, 0.6, [20, 35, 20]],
    hemisphere: [0xdde6ee, 0x778899, 0.9],
    background: '#9aa5b1',
    fog: 0x9aa5b1,
  },
};

export interface WorldViewerOptions {
  onProgress?: (progress: number, detail: string) => void;
  onLoaded?: () => void;
  onError?: (error: string) => void;
  onObjectsChanged?: (objects: SceneObjectInfo[]) => void;
  onFloorChanged?: (floor: FloorInfo) => void;
  onAutoOrbitStopped?: () => void;
  onAssetSelected?: (
    assetId: string | null,
    position?: THREE.Vector3,
    rotation?: THREE.Euler,
    scale?: THREE.Vector3
  ) => void;
  onAssetTransformed?: (
    assetId: string,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number },
    scale?: { x: number; y: number; z: number }
  ) => void;
  onAssetDeleted?: (assetId: string) => void;
  interlaceCalibration?: Partial<Calibration>;
  interlaceRenderOptions?: Partial<RenderOptions>;
}

export type TransformMode = 'translate' | 'rotate' | 'scale';

export class WorldViewer3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private isDestroyed = false;
  private animationFrameId: number | null = null;
  private lastFrameTime = performance.now();

  private defaultGround: THREE.Mesh | null = null;
  private gridHelper: THREE.GridHelper | null = null;
  private environmentMesh: THREE.Object3D | null = null;
  private currentEnvironmentUrl: string | null = null;
  private isLoadingEnvironment = false;
  private assetMeshes: THREE.Group[] = [];
  private gltfLoader = new GLTFLoader();
  private dracoLoader: DRACOLoader | null = null;
  private ktx2Loader: KTX2Loader | null = null;
  private sparkRenderer: InstanceType<typeof SparkRenderer> | null = null;
  private interlacer: InterlaceRenderer | null = null;
  private isInterlaceActive = false;
  private groundLevelY = -1.5; // Altura estándar del suelo (por defecto -1.5m en Gaussian Splats de World Labs)
  private floorOverride: number | null = null; // Suelo calibrado manualmente (tiene prioridad sobre la detección)
  private colliderMesh: THREE.Object3D | null = null; // Malla de colisión de World Labs (invisible, solo para raycast del suelo)
  private currentColliderUrl: string | null = null;

  // Iluminación (guardada para poder cambiar de preset)
  private ambientLight: THREE.AmbientLight | null = null;
  private dirLight: THREE.DirectionalLight | null = null;
  private hemiLight: THREE.HemisphereLight | null = null;
  private lightingPreset: LightingPreset = 'day';

  // Historial deshacer/rehacer
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  private dragStartState: TransformState | null = null;

  // Cámara: transición suave (F) y órbita automática (modo presentación)
  private cameraTween: {
    fromPos: THREE.Vector3;
    toPos: THREE.Vector3;
    fromQuat: THREE.Quaternion;
    toQuat: THREE.Quaternion;
    elapsed: number;
    duration: number;
  } | null = null;
  private autoOrbit: {
    target: THREE.Vector3 | null;
    radius: number;
    angle: number;
    height: number;
  } | null = null;

  // Gizmo de Transformación & Selección
  private transformControls: TransformControls | null = null;
  private transformControlsHelper: THREE.Object3D | null = null;
  private selectionBoxHelper: THREE.BoxHelper | null = null;
  private selectedAssetId: string | null = null;
  private transformMode: TransformMode = 'translate';
  private isDraggingGizmo = false;
  private pointerDownPos = { x: 0, y: 0 };

  // Controles de Navegación WASD + Mouse Drag (Free-Flight estilo World Labs)
  private keysDown = new Set<string>();
  private isPointerDown = false;
  private prevPointerX = 0;
  private prevPointerY = 0;
  private euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private moveSpeed = 4.0;

  constructor(container: HTMLElement, private readonly options?: WorldViewerOptions) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0a0a0a');

    const width =
      container.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800) || 800;
    const height =
      container.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 600) || 600;

    // FOV y clipping planes optimizados para Gaussian Splatting (mismo perfil de World Labs Marble)
    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    // Posición inicial en el origen mirando hacia -Z como en World Labs
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1);
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

    this.renderer = new THREE.WebGLRenderer({
      antialias: false, // En 3D Gaussian Splatting, antialias debe ser false para máxima nitidez y rendimiento
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(width, height);
    const pixelRatio = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (this.renderer.domElement) {
      this.renderer.domElement.tabIndex = 0;
      if (this.renderer.domElement.style) {
        this.renderer.domElement.style.outline = 'none';
      }
      container.appendChild(this.renderer.domElement);
    }

    // Inicializar decodificadores Draco y KTX2/Basis para GLTFLoader
    try {
      this.dracoLoader = new DRACOLoader();
      this.dracoLoader.setDecoderPath('/jupiter-decoders/draco/');
      this.gltfLoader.setDRACOLoader(this.dracoLoader);

      if (this.renderer.extensions && typeof this.renderer.extensions.has === 'function') {
        this.ktx2Loader = new KTX2Loader();
        this.ktx2Loader.setTranscoderPath('/jupiter-decoders/basis/');
        this.ktx2Loader.detectSupport(this.renderer);
        this.gltfLoader.setKTX2Loader(this.ktx2Loader);
      }
    } catch (e) {
      console.warn('⚠️ [GLTFLoader Decoders] Inicialización:', e);
    }

    // Inicializar SparkRenderer optimizado para máxima fidelidad y fluidez (estilo World Labs Marble)
    try {
      this.sparkRenderer = new SparkRenderer({
        renderer: this.renderer,
        lodSplatScale: 1.5,
        enableLod: true,
        sortRadial: true,
        minSortIntervalMs: 16, // Throttle a 60fps para evitar saturación de la CPU/GPU durante navegación rápida
      });
      this.scene.add(this.sparkRenderer as unknown as THREE.Object3D);
    } catch (e) {
      console.warn('⚠️ [SparkRenderer] Inicialización:', e);
    }

    // Inicializar InterlaceRenderer para soporte de pantallas 3D JupiterSR
    try {
      if (
        this.renderer.capabilities?.isWebGL2 &&
        this.renderer.extensions?.has('EXT_color_buffer_float')
      ) {
        const initialMode = this.options?.interlaceRenderOptions?.mode ?? '2d';
        this.interlacer = new InterlaceRenderer(this.renderer, {
          calibration: this.options?.interlaceCalibration,
          render: {
            mode: initialMode,
            ...this.options?.interlaceRenderOptions,
          },
        });
        this.isInterlaceActive = initialMode !== '2d';
      }
    } catch (e) {
      console.warn('⚠️ [InterlaceRenderer] Inicialización:', e);
    }

    this.setupTransformControls();
    this.setupLighting();
    this.setupDefaultEnvironment();
    this.setupEventListeners();
    this.startRenderLoop();
  }

  private setupTransformControls(): void {
    try {
      if (!this.renderer.domElement) return;
      this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
      this.transformControls.size = 0.85;
      this.transformControls.setMode(this.transformMode);

      this.transformControlsHelper = (this.transformControls as any).getHelper
        ? (this.transformControls as any).getHelper()
        : (this.transformControls as unknown as THREE.Object3D);

      if (this.transformControlsHelper) {
        this.scene.add(this.transformControlsHelper);
      }

      this.transformControls.addEventListener('dragging-changed', (event: { value: unknown }) => {
        this.isDraggingGizmo = !!event.value;
        const group = this.selectedAssetId ? this.getGroup(this.selectedAssetId) : undefined;
        if (!group) return;

        if (event.value) {
          this.cameraTween = null;
          this.dragStartState = this.captureState(group);
        } else {
          const after = this.captureState(group);
          if (this.dragStartState && !this.sameState(this.dragStartState, after)) {
            this.pushHistory({ kind: 'transform', id: group.name, before: this.dragStartState, after });
          }
          this.dragStartState = null;
          this.emitTransformed(group);
        }
      });

      // Mientras se arrastra, el inspector numérico sigue al gizmo en vivo
      this.transformControls.addEventListener('objectChange', () => {
        const group = this.selectedAssetId ? this.getGroup(this.selectedAssetId) : undefined;
        if (group) this.emitTransformed(group);
      });

      this.transformControls.addEventListener('change', () => {
        if (this.selectionBoxHelper) {
          this.selectionBoxHelper.update();
        }
      });
    } catch (e) {
      console.warn('⚠️ [TransformControls] Inicialización:', e);
    }
  }

  private setupLighting(): void {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    this.dirLight.position.set(20, 35, 20);
    this.dirLight.castShadow = true;
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.8);
    this.scene.add(this.hemiLight);
  }

  /** Cambia la iluminación de la escena (afecta a los modelos; los splats son auto-iluminados). */
  public setLightingPreset(preset: LightingPreset): void {
    const cfg = LIGHTING_PRESETS[preset];
    if (!cfg || !this.ambientLight || !this.dirLight || !this.hemiLight) return;

    this.lightingPreset = preset;
    this.ambientLight.color.set(cfg.ambient[0]);
    this.ambientLight.intensity = cfg.ambient[1];
    this.dirLight.color.set(cfg.directional[0]);
    this.dirLight.intensity = cfg.directional[1];
    this.dirLight.position.set(...cfg.directional[2]);
    this.hemiLight.color.set(cfg.hemisphere[0]);
    this.hemiLight.groundColor.set(cfg.hemisphere[1]);
    this.hemiLight.intensity = cfg.hemisphere[2];
    this.scene.background = new THREE.Color(cfg.background);
    this.scene.fog = cfg.fog === null ? null : new THREE.Fog(cfg.fog, 8, 60);
  }

  public getLightingPreset(): LightingPreset {
    return this.lightingPreset;
  }

  private setupDefaultEnvironment(): void {
    this.groundLevelY = -1.5;
    const groundGeo = new THREE.PlaneGeometry(200, 200);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.defaultGround = new THREE.Mesh(groundGeo, groundMat);
    this.defaultGround.rotation.x = -Math.PI / 2;
    this.defaultGround.position.y = -1.5;
    this.defaultGround.receiveShadow = true;
    this.scene.add(this.defaultGround);

    this.gridHelper = new THREE.GridHelper(60, 60, 0x6366f1, 0x1e293b);
    this.gridHelper.position.y = -1.495;
    this.scene.add(this.gridHelper);
  }

  private setupEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize);
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      window.addEventListener('blur', this.onWindowBlur);
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
    }

    const el = this.renderer.domElement;
    if (el) {
      el.addEventListener('pointerdown', this.onPointerDown);
    }
  }

  private onWindowBlur = (): void => {
    this.keysDown.clear();
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    // Ctrl/Cmd + tecla son atajos de edición (deshacer, duplicar...), no movimiento de cámara
    if (e.ctrlKey || e.metaKey) return;
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    this.keysDown.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.cameraTween = null;
    if (this.autoOrbit) {
      this.stopAutoOrbit();
      this.options?.onAutoOrbitStopped?.();
    }
    this.isPointerDown = true;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;
    this.pointerDownPos = { x: e.clientX, y: e.clientY };
    if (this.renderer.domElement && typeof this.renderer.domElement.focus === 'function') {
      this.renderer.domElement.focus();
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.isDraggingGizmo) return;
    if (!this.isPointerDown) return;

    const deltaX = e.clientX - this.prevPointerX;
    const deltaY = e.clientY - this.prevPointerY;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;

    const sensitivity = 0.0028;
    this.euler.y -= deltaX * sensitivity;
    this.euler.x -= deltaY * sensitivity;

    // Limitar cabeceo (pitch) entre -89° y +89°
    this.euler.x = Math.max(-Math.PI / 2 + 0.02, Math.min(Math.PI / 2 - 0.02, this.euler.x));
    this.camera.quaternion.setFromEuler(this.euler);
  };

  private onPointerUp = (e: PointerEvent): void => {
    this.isPointerDown = false;
    if (this.isDraggingGizmo) return;

    const delta = Math.hypot(e.clientX - this.pointerDownPos.x, e.clientY - this.pointerDownPos.y);
    if (delta < 5) {
      this.handlePointerClickSelection(e.clientX, e.clientY);
    }
  };

  private handlePointerClickSelection(clientX: number, clientY: number): void {
    if (!this.renderer.domElement) return;

    const rect =
      typeof this.renderer.domElement.getBoundingClientRect === 'function'
        ? this.renderer.domElement.getBoundingClientRect()
        : { left: 0, top: 0, width: 800, height: 600 };

    if (!rect.width || !rect.height) return;

    const pointer = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, this.camera);

    // Los objetos ocultos o bloqueados no se pueden seleccionar con el ratón (como en Unreal)
    const pickable = this.assetMeshes.filter((g) => g.visible && !g.userData?.locked);
    const hits = raycaster.intersectObjects(pickable, true);
    if (hits.length > 0) {
      // Buscar el Group raíz en assetMeshes
      let hitObj: THREE.Object3D | null = hits[0].object;
      let targetGroup: THREE.Group | undefined;
      while (hitObj) {
        targetGroup = this.assetMeshes.find((g) => g === hitObj);
        if (targetGroup) break;
        hitObj = hitObj.parent;
      }

      if (targetGroup) {
        this.selectAsset(targetGroup.name);
        return;
      }
    }

    this.deselectAsset();
  }

  private updateNavigation(deltaTime: number): void {
    if (this.isDraggingGizmo) return;
    if (this.keysDown.size === 0) return;

    const isSprint = this.keysDown.has('ShiftLeft') || this.keysDown.has('ShiftRight');
    const currentSpeed = this.moveSpeed * (isSprint ? 2.5 : 1.0);
    const distance = currentSpeed * deltaTime;

    const moveVector = new THREE.Vector3(0, 0, 0);

    // Como en Unreal: W/E/R son modos del gizmo cuando hay un objeto seleccionado,
    // así que WASD/QE solo vuelan la cámara con el ratón pulsado o sin selección.
    // Las flechas siempre mueven la cámara.
    const letterNavigation = this.isPointerDown || this.selectedAssetId === null;
    if ((letterNavigation && this.keysDown.has('KeyW')) || this.keysDown.has('ArrowUp')) moveVector.z -= 1;
    if ((letterNavigation && this.keysDown.has('KeyS')) || this.keysDown.has('ArrowDown')) moveVector.z += 1;
    if ((letterNavigation && this.keysDown.has('KeyA')) || this.keysDown.has('ArrowLeft')) moveVector.x -= 1;
    if ((letterNavigation && this.keysDown.has('KeyD')) || this.keysDown.has('ArrowRight')) moveVector.x += 1;
    if (this.keysDown.has('Space') || (letterNavigation && this.keysDown.has('KeyE'))) moveVector.y += 1;
    if (letterNavigation && (this.keysDown.has('KeyC') || this.keysDown.has('KeyQ'))) moveVector.y -= 1;

    if (moveVector.lengthSq() > 0) {
      moveVector.normalize();
      moveVector.applyQuaternion(this.camera.quaternion);
      this.camera.position.addScaledVector(moveVector, distance);
    }
  }

  /**
   * Métodos Públicos de Transformación y Selección
   */
  public selectAsset(assetId: string): void {
    const group = this.getGroup(assetId);
    if (!group || !group.visible) return;

    this.selectedAssetId = assetId;

    if (this.selectionBoxHelper) {
      this.scene.remove(this.selectionBoxHelper);
      this.selectionBoxHelper.dispose();
      this.selectionBoxHelper = null;
    }

    this.selectionBoxHelper = new THREE.BoxHelper(group, group.userData?.locked ? 0xf59e0b : 0x6366f1);
    this.scene.add(this.selectionBoxHelper);

    if (this.transformControls) {
      // Un objeto bloqueado se puede inspeccionar pero no mover
      if (group.userData?.locked) {
        this.transformControls.detach();
      } else {
        this.transformControls.attach(group);
        this.transformControls.enabled = true;
      }
    }

    this.options?.onAssetSelected?.(
      assetId,
      group.position.clone(),
      group.rotation.clone(),
      group.scale.clone()
    );
  }

  public deselectAsset(): void {
    if (!this.selectedAssetId) return;

    this.selectedAssetId = null;

    if (this.selectionBoxHelper) {
      this.scene.remove(this.selectionBoxHelper);
      this.selectionBoxHelper.dispose();
      this.selectionBoxHelper = null;
    }

    if (this.transformControls) {
      this.transformControls.detach();
    }

    this.options?.onAssetSelected?.(null);
  }

  public getSelectedAssetId(): string | null {
    return this.selectedAssetId;
  }

  public setTransformMode(mode: TransformMode): void {
    this.transformMode = mode;
    if (this.transformControls) {
      this.transformControls.setMode(mode);
    }
  }

  /** Mitad de la altura del modelo (el pivote está en su centro); 0,5 m si aún no se conoce. */
  private halfHeightOf(group: THREE.Group): number {
    return typeof group.userData?.halfHeight === 'number' ? group.userData.halfHeight : 0.5;
  }

  /**
   * Distancia desde el pivote (centro del modelo) hasta su base, en metros del mundo.
   * Tiene en cuenta escala y rotación; sin geometría cargada usa la altura estimada.
   */
  private getBottomOffset(group: THREE.Group): number {
    const box = new THREE.Box3().setFromObject(group);
    let offset: number;

    if (group.children.length > 0 && Number.isFinite(box.min.y) && Number.isFinite(box.max.y)) {
      offset = group.position.y - box.min.y;
    } else {
      offset = this.halfHeightOf(group) * group.scale.y;
    }

    return offset;
  }

  /** "Floor" estilo Unreal: deja la base del objeto sobre la primera superficie bajo él. */
  public snapSelectedToGround(): void {
    const group = this.selectedAssetId ? this.getGroup(this.selectedAssetId) : undefined;
    if (!group) return;

    const before = this.captureState(group);
    const box = new THREE.Box3().setFromObject(group);
    const topY = Number.isFinite(box.max.y) ? box.max.y : group.position.y;

    // Se lanza el rayo desde lo alto del propio objeto: así no se "sube" a tejados ni techos
    const groundY = this.getGroundHeightAt(group.position.x, group.position.z, topY);
    group.position.y = groundY + this.getBottomOffset(group);

    if (this.selectionBoxHelper) {
      this.selectionBoxHelper.update();
    }

    this.commitTransform(group, before);
  }

  public deleteSelectedAsset(): void {
    if (!this.selectedAssetId) return;
    this.deleteAsset(this.selectedAssetId);
  }

  public deleteAsset(id: string): void {
    const group = this.getGroup(id);
    if (!group) return;

    this.removeGroup(group);
    this.pushHistory({ kind: 'delete', group });
  }

  /**
   * Quita el grupo de la escena sin liberar su GPU: el borrado se puede deshacer.
   * La memoria se libera en clearAssets().
   */
  private removeGroup(group: THREE.Group): void {
    const wasSelected = this.selectedAssetId === group.name;
    const index = this.assetMeshes.indexOf(group);

    if (wasSelected) this.deselectAsset();
    this.scene.remove(group);
    if (index !== -1) this.assetMeshes.splice(index, 1);

    this.options?.onAssetDeleted?.(group.name);
    this.notifyObjectsChanged();
  }

  private insertGroup(group: THREE.Group): void {
    this.scene.add(group);
    if (!this.assetMeshes.includes(group)) this.assetMeshes.push(group);
    this.notifyObjectsChanged();
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.geometry?.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
  }

  /**
   * Objetos de la escena y utilidades de edición
   */
  private getGroup(id: string): THREE.Group | undefined {
    return this.assetMeshes.find((g) => g.name === id);
  }

  private captureState(group: THREE.Group): TransformState {
    return {
      position: { x: group.position.x, y: group.position.y, z: group.position.z },
      rotation: { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z },
      scale: { x: group.scale.x, y: group.scale.y, z: group.scale.z },
    };
  }

  private applyState(group: THREE.Group, state: TransformState): void {
    group.position.set(state.position.x, state.position.y, state.position.z);
    group.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
    group.scale.set(state.scale.x, state.scale.y, state.scale.z);
    if (this.selectionBoxHelper && this.selectedAssetId === group.name) {
      this.selectionBoxHelper.update();
    }
  }

  private sameState(a: TransformState, b: TransformState): boolean {
    const close = (u: Vec3Like, v: Vec3Like) =>
      Math.abs(u.x - v.x) < 1e-6 && Math.abs(u.y - v.y) < 1e-6 && Math.abs(u.z - v.z) < 1e-6;
    return close(a.position, b.position) && close(a.rotation, b.rotation) && close(a.scale, b.scale);
  }

  private emitTransformed(group: THREE.Group): void {
    const s = this.captureState(group);
    this.options?.onAssetTransformed?.(group.name, s.position, s.rotation, s.scale);
  }

  /** Registra un cambio de transformación ya aplicado al grupo y avisa a la UI. */
  private commitTransform(group: THREE.Group, before: TransformState): void {
    const after = this.captureState(group);
    if (!this.sameState(before, after)) {
      this.pushHistory({ kind: 'transform', id: group.name, before, after });
    }
    this.emitTransformed(group);
  }

  private notifyObjectsChanged(): void {
    this.options?.onObjectsChanged?.(this.listObjects());
  }

  public listObjects(): SceneObjectInfo[] {
    return this.assetMeshes.map((g) => ({
      id: g.name,
      name: (g.userData?.name as string) || g.name,
      visible: g.visible,
      locked: !!g.userData?.locked,
    }));
  }

  /** Aplica valores numéricos (inspector) a un objeto. Rotación en radianes. */
  public setAssetTransform(
    id: string,
    patch: { position?: Partial<Vec3Like>; rotation?: Partial<Vec3Like>; scale?: Partial<Vec3Like> }
  ): void {
    const group = this.getGroup(id);
    if (!group || group.userData?.locked) return;

    const before = this.captureState(group);
    const finite = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v);

    if (patch.position) {
      if (finite(patch.position.x)) group.position.x = patch.position.x;
      if (finite(patch.position.y)) group.position.y = patch.position.y;
      if (finite(patch.position.z)) group.position.z = patch.position.z;
    }
    if (patch.rotation) {
      if (finite(patch.rotation.x)) group.rotation.x = patch.rotation.x;
      if (finite(patch.rotation.y)) group.rotation.y = patch.rotation.y;
      if (finite(patch.rotation.z)) group.rotation.z = patch.rotation.z;
    }
    if (patch.scale) {
      if (finite(patch.scale.x)) group.scale.x = Math.max(MIN_SCALE, patch.scale.x);
      if (finite(patch.scale.y)) group.scale.y = Math.max(MIN_SCALE, patch.scale.y);
      if (finite(patch.scale.z)) group.scale.z = Math.max(MIN_SCALE, patch.scale.z);
    }

    if (this.selectionBoxHelper && this.selectedAssetId === id) {
      this.selectionBoxHelper.update();
    }
    this.commitTransform(group, before);
  }

  private uniqueName(base: string): string {
    const used = new Set(this.assetMeshes.map((g) => g.userData?.name as string));
    if (!used.has(base)) return base;

    const root = base.replace(/\s+\d+$/, '').trim() || 'Object';
    let name = root;
    for (let n = 2; used.has(name); n++) {
      name = `${root} ${n}`;
    }
    return name;
  }

  public renameAsset(id: string, newName: string): void {
    const group = this.getGroup(id);
    const trimmed = newName.trim();
    if (!group || !trimmed || group.userData.name === trimmed) return;

    const before = group.userData.name as string;
    group.userData.name = trimmed;
    this.pushHistory({ kind: 'rename', id, before, after: trimmed });
    this.notifyObjectsChanged();
  }

  public setAssetVisible(id: string, visible: boolean): void {
    const group = this.getGroup(id);
    if (!group) return;

    if (!visible && this.selectedAssetId === id) this.deselectAsset();
    group.visible = visible;
    this.notifyObjectsChanged();
  }

  public setAssetLocked(id: string, locked: boolean): void {
    const group = this.getGroup(id);
    if (!group) return;

    group.userData.locked = locked;
    if (this.selectedAssetId === id) {
      // Re-selecciona para actualizar el gizmo y el color del recuadro
      this.deselectAsset();
      this.selectAsset(id);
    }
    this.notifyObjectsChanged();
  }

  /** Duplica el objeto seleccionado (Ctrl+D). Devuelve el id del duplicado. */
  public duplicateSelected(): string | null {
    const source = this.selectedAssetId ? this.getGroup(this.selectedAssetId) : undefined;
    if (!source) return null;

    const id = `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const clone = source.clone(true);
    clone.name = id;
    clone.visible = true;
    clone.userData = {
      ...source.userData,
      id,
      name: this.uniqueName(source.userData?.name as string),
      locked: false,
      isUserSpawned: true,
    };

    const box = new THREE.Box3().setFromObject(source);
    const width = Number.isFinite(box.min.x) ? Math.max(box.max.x - box.min.x, 0.5) : 1;
    clone.position.x += width * 1.1;

    this.insertGroup(clone);
    this.pushHistory({ kind: 'add', group: clone });
    this.selectAsset(id);
    return id;
  }

  /** Objetos serializables para guardar la escena; los que no tienen URL persistente se omiten. */
  public serializeModels(): { models: SceneModel[]; skipped: number } {
    const models: SceneModel[] = [];
    let skipped = 0;

    for (const group of this.assetMeshes) {
      const url = group.userData?.url as string | undefined;
      if (!url || url.startsWith('blob:')) {
        skipped++;
        continue;
      }
      const s = this.captureState(group);
      models.push({
        name: (group.userData?.name as string) || group.name,
        modelUrl: url,
        position: s.position,
        rotation: s.rotation,
        scale: s.scale,
        hidden: !group.visible,
        locked: !!group.userData?.locked,
      });
    }

    return { models, skipped };
  }

  /**
   * Historial (Ctrl+Z / Ctrl+Y)
   */
  private pushHistory(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }

  public clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.applyHistory(entry, 'undo');
    this.redoStack.push(entry);
    return true;
  }

  public redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.applyHistory(entry, 'redo');
    this.undoStack.push(entry);
    return true;
  }

  private applyHistory(entry: HistoryEntry, direction: 'undo' | 'redo'): void {
    const undoing = direction === 'undo';

    if (entry.kind === 'transform') {
      const group = this.getGroup(entry.id);
      if (group) {
        this.applyState(group, undoing ? entry.before : entry.after);
        this.emitTransformed(group);
      }
    } else if (entry.kind === 'rename') {
      const group = this.getGroup(entry.id);
      if (group) {
        group.userData.name = undoing ? entry.before : entry.after;
        this.notifyObjectsChanged();
      }
    } else if (entry.kind === 'add') {
      if (undoing) this.removeGroup(entry.group);
      else this.insertGroup(entry.group);
    } else if (undoing) {
      this.insertGroup(entry.group);
    } else {
      this.removeGroup(entry.group);
    }
  }

  /**
   * Cámara: enfocar (tecla F) y modo presentación
   */
  private computeBounds(groups: THREE.Group[]): THREE.Box3 | null {
    const union = new THREE.Box3();
    for (const g of groups) {
      const box = new THREE.Box3().setFromObject(g);
      if (Number.isFinite(box.min.x) && Number.isFinite(box.max.x)) {
        union.union(box);
      } else {
        union.expandByPoint(g.position);
      }
    }
    return union.isEmpty() ? null : union;
  }

  /** Centra la cámara en el objeto indicado (o en el seleccionado / en todos si no hay selección). */
  public focusAsset(id?: string): boolean {
    const targetId = id ?? this.selectedAssetId;
    const groups = targetId
      ? [this.getGroup(targetId)].filter((g): g is THREE.Group => !!g)
      : this.assetMeshes.filter((g) => g.visible);
    const bounds = this.computeBounds(groups);
    if (!bounds) return false;

    const center = bounds.getCenter(new THREE.Vector3());
    const radius = Math.max(bounds.getBoundingSphere(new THREE.Sphere()).radius, 0.5);
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const distance = (radius / Math.sin(halfFov)) * 1.25;

    // Mantiene el ángulo de visión actual, ligeramente elevado para no mirar desde debajo del suelo
    const dir = this.camera.position.clone().sub(center);
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.3, 1);
    dir.normalize();
    dir.y = Math.max(dir.y, 0.15);
    dir.normalize();

    const toPos = center.clone().add(dir.multiplyScalar(distance));
    const lookMatrix = new THREE.Matrix4().lookAt(toPos, center, new THREE.Vector3(0, 1, 0));
    const toQuat = new THREE.Quaternion().setFromRotationMatrix(lookMatrix);

    this.autoOrbit = null;
    this.cameraTween = {
      fromPos: this.camera.position.clone(),
      toPos,
      fromQuat: this.camera.quaternion.clone(),
      toQuat,
      elapsed: 0,
      duration: 0.45,
    };
    return true;
  }

  private updateCameraTween(deltaTime: number): void {
    const tween = this.cameraTween;
    if (!tween) return;

    tween.elapsed += deltaTime;
    const t = Math.min(tween.elapsed / tween.duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    this.camera.position.lerpVectors(tween.fromPos, tween.toPos, eased);
    this.camera.quaternion.slerpQuaternions(tween.fromQuat, tween.toQuat, eased);

    if (t >= 1) {
      this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      this.cameraTween = null;
    }
  }

  /** Órbita automática de cámara para presentaciones; con escena vacía gira sobre su eje. */
  public setAutoOrbit(enabled: boolean): void {
    if (!enabled) {
      this.stopAutoOrbit();
      return;
    }

    this.cameraTween = null;
    const bounds = this.computeBounds(this.assetMeshes.filter((g) => g.visible));
    if (bounds) {
      const target = bounds.getCenter(new THREE.Vector3());
      const sphereRadius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
      const radius = Math.max(3.5, sphereRadius * 2.4);
      this.autoOrbit = {
        target,
        radius,
        angle: Math.atan2(this.camera.position.x - target.x, this.camera.position.z - target.z),
        height: target.y + radius * 0.3,
      };
    } else {
      this.autoOrbit = { target: null, radius: 0, angle: 0, height: 0 };
    }
  }

  private stopAutoOrbit(): void {
    if (this.autoOrbit) {
      this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    }
    this.autoOrbit = null;
  }

  public isAutoOrbiting(): boolean {
    return this.autoOrbit !== null;
  }

  private updateAutoOrbit(deltaTime: number): void {
    const orbit = this.autoOrbit;
    if (!orbit) return;

    if (orbit.target) {
      orbit.angle += deltaTime * 0.25;
      this.camera.position.set(
        orbit.target.x + Math.sin(orbit.angle) * orbit.radius,
        orbit.height,
        orbit.target.z + Math.cos(orbit.angle) * orbit.radius
      );
      this.camera.lookAt(orbit.target);
    } else {
      this.euler.y += deltaTime * 0.2;
      this.camera.quaternion.setFromEuler(this.euler);
    }
  }

  public getCameraPose(): { position: Vec3Like; rotation: Vec3Like } {
    return {
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      rotation: { x: this.euler.x, y: this.euler.y, z: this.euler.z },
    };
  }

  public setCameraPose(pose: { position: Vec3Like; rotation: Vec3Like }): void {
    this.cameraTween = null;
    this.camera.position.set(pose.position.x, pose.position.y, pose.position.z);
    this.euler.set(pose.rotation.x, pose.rotation.y, pose.rotation.z, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }

  /** true mientras el usuario mantiene el ratón pulsado o arrastra el gizmo (teclas WASD = vuelo). */
  public isNavigating(): boolean {
    return this.isPointerDown || this.isDraggingGizmo;
  }

  /** Captura PNG del frame actual (se renderiza en la misma tarea para no depender de preserveDrawingBuffer). */
  public captureScreenshot(): string | null {
    let dataUrl: string | null = null;
    try {
      const canvas = this.renderer.domElement as HTMLCanvasElement;
      if (typeof canvas.toDataURL === 'function') {
        this.renderer.render(this.scene, this.camera);
        dataUrl = canvas.toDataURL('image/png');
      }
    } catch (e) {
      console.warn('⚠️ [Screenshot] No se pudo capturar la escena:', e);
    }
    return dataUrl;
  }

  /**
   * Carga el entorno 3D de World Labs (soporta Gaussian Splatting .spz, .ply, GLB o Pano 360)
   */
  public async loadEnvironment(
    url: string,
    hintType?: 'spz' | 'ply' | 'glb' | 'pano',
    clearExistingAssets: boolean = true,
    colliderUrl?: string
  ): Promise<void> {
    if (this.currentEnvironmentUrl === url && (this.environmentMesh || this.isLoadingEnvironment)) {
      return;
    }
    this.currentEnvironmentUrl = url;
    this.isLoadingEnvironment = true;

    // Un suelo calibrado a mano solo vale para el mundo en el que se calibró
    this.setFloorOverride(null);
    this.clearCollider();
    if (colliderUrl) {
      void this.loadCollider(colliderUrl, hintType === 'ply' || url.toLowerCase().includes('.ply'));
    }

    // Limpiar todos los modelos/assets 3D previos solo si se solicita explícitamente
    if (clearExistingAssets) {
      this.clearAssets();
    }

    this.disposeEnvironmentMesh();

    const lowerUrl = url.toLowerCase();
    const isSplat =
      hintType === 'spz' ||
      hintType === 'ply' ||
      lowerUrl.endsWith('.spz') ||
      lowerUrl.endsWith('.splat') ||
      lowerUrl.endsWith('.ply') ||
      lowerUrl.includes('.spz') ||
      lowerUrl.includes('.splat') ||
      lowerUrl.includes('.ply');
    const isPano =
      hintType === 'pano' ||
      lowerUrl.endsWith('.png') ||
      lowerUrl.endsWith('.jpg') ||
      lowerUrl.endsWith('.jpeg') ||
      lowerUrl.includes('.png') ||
      lowerUrl.includes('.jpg') ||
      lowerUrl.includes('panos');

    if (isSplat) {
      return this.loadSplatEnvironment(url, hintType);
    } else if (isPano) {
      return this.loadPanoEnvironment(url);
    } else {
      return this.loadGlbEnvironment(url);
    }
  }

  /**
   * Carga entorno 3D mediante 3D Gaussian Splatting (@sparkjsdev/spark)
   */
  private async loadSplatEnvironment(url: string, hintType?: 'spz' | 'ply' | 'glb' | 'pano'): Promise<void> {
    this.options?.onProgress?.(15, 'Descargando Gaussian Splat 3D...');

    return new Promise((resolve, reject) => {
      try {
        const lowerUrl = url.toLowerCase();
        const isPly = hintType === 'ply' || lowerUrl.endsWith('.ply') || lowerUrl.includes('.ply');
        const splatMesh = new SplatMesh({
          url,
          fileType: isPly ? SplatFileType.PLY : SplatFileType.SPZ,
          lod: true,
          enableLod: true,
          onProgress: (event: ProgressEvent) => {
            let progress = 0;
            if (event.lengthComputable && event.total > 0) {
              progress = event.loaded / event.total;
            } else {
              const MIDPOINT_BYTES = 20 * 1024 * 1024;
              progress = 1 - 1 / (1 + event.loaded / MIDPOINT_BYTES);
            }
            const pct = Math.min(progress * 100, 99);
            const mb = (event.loaded / 1024 / 1024).toFixed(1);
            this.options?.onProgress?.(pct, `Loading 3D Splat: ${mb} MB`);
          },
          onLoad: () => {
            // Initial camera position once 3D splat is loaded
            this.camera.position.set(0, 0, 0);
            this.camera.lookAt(0, 0, -1);
            this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

            // In Gaussian Splats, physical ground relative to camera eye (0,0,0) is at -1.5m
            this.setGroundLevel(-1.5);

            this.isLoadingEnvironment = false;
            this.options?.onProgress?.(100, '3D Splat World Ready');
            this.options?.onLoaded?.();
            resolve();
          },
        });

        // Marble SPZs use OpenCV orientation (+Y down -> rotate Math.PI on X)
        // Standard .ply files already have native orientation (+Y up in Three.js)
        if (!isPly) {
          splatMesh.rotation.x = Math.PI;
        } else {
          splatMesh.rotation.set(0, 0, 0);
        }

        this.environmentMesh = splatMesh as unknown as THREE.Object3D;
        this.scene.add(this.environmentMesh);

        // Hide default grid
        if (this.gridHelper) this.gridHelper.visible = false;
        if (this.defaultGround) this.defaultGround.visible = false;
      } catch (err) {
        this.isLoadingEnvironment = false;
        console.warn('⚠️ [SplatMesh] Error loading Splat:', err);
        this.options?.onError?.(`Error loading Splat: ${err}`);
        reject(err);
      }
    });
  }

  /**
   * Loads 360 equirectangular panoramic environment
   */
  private async loadPanoEnvironment(url: string): Promise<void> {
    this.options?.onProgress?.(25, 'Loading 360 panorama...');

    return new Promise((resolve, reject) => {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.mapping = THREE.EquirectangularReflectionMapping;

          const sphereGeo = new THREE.SphereGeometry(150, 64, 40);
          sphereGeo.scale(-1, 1, 1);
          const sphereMat = new THREE.MeshBasicMaterial({ map: texture });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);

          this.environmentMesh = sphere;
          this.scene.add(this.environmentMesh);

          this.setGroundLevel(-1.5);

          this.isLoadingEnvironment = false;
          this.options?.onProgress?.(100, '360 Panorama Ready');
          this.options?.onLoaded?.();
          resolve();
        },
        (event) => {
          if (event.lengthComputable) {
            const pct = Math.min((event.loaded / event.total) * 100, 99);
            this.options?.onProgress?.(pct, `Loading 360: ${pct.toFixed(0)}%`);
          }
        },
        (err) => {
          this.isLoadingEnvironment = false;
          this.options?.onError?.('Error loading panoramic texture');
          reject(err);
        }
      );
    });
  }

  /**
   * Loads GLTF / GLB environment mesh
   */
  private async loadGlbEnvironment(url: string): Promise<void> {
    this.options?.onProgress?.(15, 'Downloading GLB map...');

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          this.environmentMesh = gltf.scene;

          this.environmentMesh.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              mesh.castShadow = true;
              mesh.receiveShadow = true;
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach((m) => {
                    m.side = THREE.DoubleSide;
                  });
                } else {
                  mesh.material.side = THREE.DoubleSide;
                }
              }
            }
          });

          this.scene.add(this.environmentMesh);

          const box = new THREE.Box3().setFromObject(this.environmentMesh);
          const center = box.getCenter(new THREE.Vector3());

          this.camera.position.set(center.x, Math.max(center.y + 1.8, 1.8), center.z + 4);
          this.camera.lookAt(center.x, center.y + 1.0, center.z);
          this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

          this.setGroundLevel(box.min.y);

          this.isLoadingEnvironment = false;
          this.options?.onProgress?.(100, '3D Map Ready');
          this.options?.onLoaded?.();
          resolve();
        },
        (event) => {
          if (event.lengthComputable) {
            const pct = Math.min((event.loaded / event.total) * 100, 99);
            const mb = (event.loaded / 1024 / 1024).toFixed(1);
            this.options?.onProgress?.(pct, `Loading GLB map: ${mb} MB`);
          }
        },
        (err) => {
          this.isLoadingEnvironment = false;
          this.options?.onError?.('Error loading GLB map');
          reject(err);
        }
      );
    });
  }

  /**
   * Permite calibrar dinámicamente la altura del suelo y actualiza todos los objetos.
   * El pivote de cada modelo está en su centro, por eso se apoya con la mitad de su altura.
   */
  public setGroundLevel(height: number): void {
    this.groundLevelY = height;
    if (this.defaultGround) {
      this.defaultGround.position.y = this.groundLevelY;
    }
    if (this.gridHelper) {
      this.gridHelper.position.y = this.groundLevelY + 0.005;
    }
    for (const group of this.assetMeshes) {
      group.position.y = this.groundLevelY + this.halfHeightOf(group) * group.scale.y;
    }
    if (this.selectionBoxHelper) {
      this.selectionBoxHelper.update();
    }
    this.notifyFloorChanged();
  }

  public getGroundLevel(): number {
    return this.groundLevelY;
  }

  /** Fija (o libera con null) una altura de suelo manual; tiene prioridad sobre la detección automática. */
  public setFloorOverride(y: number | null): void {
    const next = y !== null && Number.isFinite(y) ? y : null;
    if (next === this.floorOverride) return;
    this.floorOverride = next;
    this.notifyFloorChanged();
  }

  public getFloorOverride(): number | null {
    return this.floorOverride;
  }

  /** Usa la base del objeto seleccionado como suelo de referencia para el resto de "Floor". */
  public setFloorFromSelected(): void {
    const group = this.selectedAssetId ? this.getGroup(this.selectedAssetId) : undefined;
    if (!group) return;
    const box = new THREE.Box3().setFromObject(group);
    if (Number.isFinite(box.min.y)) this.setFloorOverride(box.min.y);
  }

  private notifyFloorChanged(): void {
    this.options?.onFloorChanged?.({ override: this.floorOverride, level: this.groundLevelY });
  }

  /**
   * Altura Y del suelo en (x, z). Prioridad: suelo manual > malla de colisión de World Labs >
   * malla del entorno (GLB / splat) > suelo base del mundo.
   * Con `fromY` el rayo parte de esa altura (primera superficie hacia arriba bajo el objeto);
   * si no encuentra nada, reintenta desde arriba del todo.
   */
  public getGroundHeightAt(x: number, z: number, fromY?: number): number {
    if (this.floorOverride !== null) return this.floorOverride;

    let found: number | null = null;
    if (fromY !== undefined) found = this.raycastFloor(x, z, fromY);
    if (found === null) found = this.raycastFloor(x, z, 150);

    return found ?? this.groundLevelY;
  }

  private raycastFloor(x: number, z: number, startY: number): number | null {
    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(x, startY, z), new THREE.Vector3(0, -1, 0));
    raycaster.far = 400;

    // Si hay colisionador se usa solo él: raycast sobre un splat no tiene triángulos y da golpes erráticos
    const colliders: THREE.Object3D[] = [];
    if (this.colliderMesh) {
      colliders.push(this.colliderMesh);
    } else if (this.environmentMesh) {
      colliders.push(this.environmentMesh);
    }
    if (this.defaultGround) {
      colliders.push(this.defaultGround);
    }

    let result: number | null = null;
    const hits = raycaster.intersectObjects(colliders, true);
    for (const hit of hits) {
      if (typeof hit.point?.y !== 'number') continue;
      if (!hit.face || !hit.face.normal) {
        result = hit.point.y;
        break;
      }
      const worldNormal = hit.face.normal
        .clone()
        .applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion()));
      // Solo superficies que miran hacia arriba cuentan como suelo (ignora techos y caras inferiores)
      if (worldNormal.y > 0.1) {
        result = hit.point.y;
        break;
      }
    }

    return result;
  }

  /** Asocia una malla de colisión al mundo ya cargado (p. ej. tras generar un mundo nuevo). */
  public attachCollider(url: string, isPly: boolean = false): void {
    if (this.currentColliderUrl === url) return;
    this.clearCollider();
    void this.loadCollider(url, isPly);
  }

  private clearCollider(): void {
    this.currentColliderUrl = null;
    if (this.colliderMesh) {
      this.scene.remove(this.colliderMesh);
      this.disposeGroup(this.colliderMesh as THREE.Group);
      this.colliderMesh = null;
    }
  }

  /**
   * Carga la malla de colisión de World Labs (invisible) para obtener un suelo fiable.
   * Si falla (CORS, red) o no encaja con el mundo se descarta y se usa la detección clásica.
   */
  private async loadCollider(url: string, isPly: boolean): Promise<void> {
    this.currentColliderUrl = url;

    return new Promise((resolve) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          if (this.currentColliderUrl !== url) {
            resolve();
            return;
          }

          const root = gltf.scene;
          root.traverse((child) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh && mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((m) => {
                m.side = THREE.DoubleSide;
              });
            }
          });
          root.visible = false;

          // El colisionador comparte sistema de coordenadas con el splat (OpenCV en Marble SPZ).
          // Se elige la orientación en la que la caja envolvente contiene el origen de la cámara.
          const orientations = isPly ? [0] : [Math.PI, 0];
          const origin = new THREE.Vector3(0, 0, 0);
          let fits = false;
          for (const rotX of orientations) {
            root.rotation.set(rotX, 0, 0);
            root.updateMatrixWorld(true);
            const box = new THREE.Box3().setFromObject(root).expandByScalar(1.5);
            if (isPly || box.containsPoint(origin)) {
              fits = true;
              break;
            }
          }

          if (fits) {
            this.colliderMesh = root;
            this.scene.add(root);
          } else {
            console.warn('⚠️ [Collider] La malla de colisión no encaja con el mundo; se ignora.');
          }
          resolve();
        },
        undefined,
        (err) => {
          console.warn('⚠️ [Collider] No se pudo cargar la malla de colisión:', err);
          resolve();
        }
      );
    });
  }

  /**
   * Carga un modelo 3D generado por Tripo
   */
  public async loadAssetGlb(
    assetId: string,
    url: string,
    spec: WorldSpec['assets'][number]
  ): Promise<void> {
    const existingGroup = this.assetMeshes.find((g) => g.name === assetId);

    return new Promise((resolve) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          // Auto-escalar / normalizar si es gigantesco o minúsculo
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          let scale = 1.0;
          if (maxDim > 5.0) {
            scale = 2.0 / maxDim;
          } else if (maxDim < 0.2 && maxDim > 0) {
            scale = 1.0 / maxDim;
          }
          model.scale.set(scale, scale, scale);

          // Centrar la geometría interna en (0, 0, 0) del grupo para que el pivote y las flechas del gizmo salgan exactamente del centro visual del modelo
          const scaledBox = new THREE.Box3().setFromObject(model);
          const center = scaledBox.getCenter(new THREE.Vector3());
          const entityHeight = Math.max(scaledBox.max.y - scaledBox.min.y, 0.5);
          const halfHeight = entityHeight / 2;
          model.position.sub(center);

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              const mesh = child as THREE.Mesh;
              if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                  mesh.material.forEach((m) => {
                    m.side = THREE.DoubleSide;
                  });
                } else {
                  mesh.material.side = THREE.DoubleSide;
                }
              }
            }
          });

          const groundY = this.getGroundHeightAt(spec.position.x, spec.position.z);
          const baseGround = spec.anchorToGround !== false ? groundY : this.groundLevelY;
          // El pivote está en el centro del modelo: la base queda sobre el suelo con la mitad de la altura
          const groupPosY = baseGround + halfHeight + (spec.position.y || 0);

          if (existingGroup) {
            while (existingGroup.children.length > 0) {
              existingGroup.remove(existingGroup.children[0]);
            }
            existingGroup.userData = {
              id: assetId,
              name: spec.name,
              url,
              entityHeight,
              halfHeight,
            };
            existingGroup.position.set(spec.position.x, groupPosY, spec.position.z);
            existingGroup.add(model);
          } else {
            const group = new THREE.Group();
            group.name = assetId;
            group.userData = {
              id: assetId,
              name: spec.name,
              url,
              entityHeight,
              halfHeight,
            };
            group.position.set(spec.position.x, groupPosY, spec.position.z);
            group.rotation.set(spec.rotation.x, spec.rotation.y, spec.rotation.z);
            group.scale.set(spec.scale.x, spec.scale.y, spec.scale.z);
            group.add(model);
            this.scene.add(group);
            this.assetMeshes.push(group);
          }

          if (this.selectedAssetId === assetId && this.selectionBoxHelper) {
            this.selectionBoxHelper.update();
          }

          this.notifyObjectsChanged();
          resolve();
        },
        undefined,
        (err) => {
          console.warn(`⚠️ [GLTFLoader] No se pudo cargar asset '${assetId}':`, err);
          resolve();
        }
      );
    });
  }

  /**
   * Spawnea un modelo GLB (de Tripo o local de storage/models) en el mundo cargado.
   * El modelo se posiciona sobre el plano de suelo del mundo en frente a la cámara.
   */
  public async spawnModel(
    url: string,
    name?: string,
    customPosition?: { x: number; y: number; z: number },
    extra?: SpawnExtra
  ): Promise<string> {
    const assetId = `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.options?.onProgress?.(20, `Loading 3D model: ${name || 'GLB'}...`);

    // Horizontal position (x, z) in front of camera
    let targetX: number;
    let targetZ: number;
    let targetY: number;

    if (customPosition) {
      targetX = customPosition.x;
      targetY = customPosition.y;
      targetZ = customPosition.z;
    } else {
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      if (forward.lengthSq() > 0.001) {
        forward.normalize();
      } else {
        forward.set(0, 0, -1);
      }

      const spawnPos = this.camera.position.clone().add(forward.multiplyScalar(3.0));
      targetX = spawnPos.x;
      targetY = spawnPos.y;
      targetZ = spawnPos.z;
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;

          // Auto-scale / normalize dimensions
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);

          let scale = 1.0;
          if (maxDim > 5.0) {
            scale = 2.0 / maxDim;
          } else if (maxDim < 0.2 && maxDim > 0) {
            scale = 1.0 / maxDim;
          }

          model.scale.set(scale, scale, scale);

          // Center internal geometry at (0, 0, 0)
          const scaledBox = new THREE.Box3().setFromObject(model);
          const center = scaledBox.getCenter(new THREE.Vector3());
          const entityHeight = Math.max(scaledBox.max.y - scaledBox.min.y, 0.5);
          const halfHeight = entityHeight / 2;
          model.position.sub(center);

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const m = child as THREE.Mesh;
              m.castShadow = true;
              m.receiveShadow = true;
              if (m.material) {
                if (Array.isArray(m.material)) {
                  m.material.forEach((mat) => {
                    mat.side = THREE.DoubleSide;
                  });
                } else {
                  m.material.side = THREE.DoubleSide;
                }
              }
            }
          });

          if (!customPosition || extra?.snapToGround) {
            // El rayo parte de la altura de la cámara hacia abajo; pivote en el centro => base sobre el suelo
            const groundY = this.getGroundHeightAt(targetX, targetZ, this.camera.position.y);
            targetY = groundY + halfHeight * (extra?.scale?.y ?? 1);
          }

          const group = new THREE.Group();
          group.name = assetId;
          group.position.set(targetX, targetY, targetZ);
          group.userData = {
            id: assetId,
            name: this.uniqueName(name || 'GLB Model'),
            url,
            isUserSpawned: true,
            locked: !!extra?.locked,
            entityHeight,
            halfHeight,
          };
          if (extra?.rotation) group.rotation.set(extra.rotation.x, extra.rotation.y, extra.rotation.z);
          if (extra?.scale) group.scale.set(extra.scale.x, extra.scale.y, extra.scale.z);
          group.visible = !extra?.hidden;
          group.add(model);

          this.insertGroup(group);
          this.pushHistory({ kind: 'add', group });

          // Auto-select newly spawned model
          if (extra?.select !== false) {
            this.selectAsset(assetId);
          }

          this.options?.onProgress?.(100, `Model '${name || 'GLB'}' added to scene`);
          if (typeof setTimeout !== 'undefined') {
            setTimeout(() => {
              this.options?.onLoaded?.();
            }, 1200);
          } else {
            this.options?.onLoaded?.();
          }

          resolve(assetId);
        },
        (progress) => {
          if (progress.lengthComputable) {
            const pct = Math.min((progress.loaded / progress.total) * 100, 99);
            this.options?.onProgress?.(pct, `Loading model: ${pct.toFixed(0)}%`);
          }
        },
        (err) => {
          console.warn(`⚠️ [GLTFLoader] Error spawning model '${url}':`, err);
          this.options?.onError?.(`Error loading model: ${name || url}`);
          reject(err);
        }
      );
    });
  }

  /**
   * Añade varios modelos a la escena actual en una fila delante de la cámara, cada uno
   * apoyado sobre el suelo. Devuelve los ids creados y cuántos fallaron al cargar.
   */
  public async spawnModelsInFront(
    items: { url: string; name: string }[],
    gap: number = 1.2,
    distance: number = 4
  ): Promise<{ ids: string[]; failed: number }> {
    // Se usa solo el giro horizontal de la cámara (yaw) para que la fila quede nivelada
    const yaw = this.euler.y;
    const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const origin = this.camera.position.clone();

    // 1) Se cargan todos (en la posición central) para conocer su tamaño real
    const results = await Promise.allSettled(
      items.map((item) =>
        this.spawnModel(
          item.url,
          item.name,
          { x: origin.x + forward.x * distance, y: 0, z: origin.z + forward.z * distance },
          { snapToGround: true, select: false }
        )
      )
    );
    const ids = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));

    // 2) Se reparten en fila separándolos según su ancho, y se apoyan de nuevo en el suelo
    const groups = ids.map((id) => this.getGroup(id)).filter((g): g is THREE.Group => !!g);
    const sizes = groups.map((g) => new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3()));
    const widths = sizes.map((s) => Math.max(s.x, s.z, 0.5));
    const rowWidth = widths.reduce((sum, w) => sum + w, 0) + gap * Math.max(groups.length - 1, 0);
    const rowDistance = Math.max(distance, Math.max(0, ...widths) / 2 + 3);

    let cursor = -rowWidth / 2;
    groups.forEach((group, i) => {
      const offset = cursor + widths[i] / 2;
      cursor += widths[i] + gap;
      const x = origin.x + forward.x * rowDistance + right.x * offset;
      const z = origin.z + forward.z * rowDistance + right.z * offset;
      group.position.set(x, this.getGroundHeightAt(x, z, origin.y) + this.halfHeightOf(group) * group.scale.y, z);
    });
    // Las posiciones definitivas quedan en el historial de "añadir" tal cual (no es un paso aparte)

    return { ids, failed: results.length - ids.length };
  }

  public applyWorldSpec(
    spec: WorldSpec,
    environmentUrl?: string,
    assetUrls?: Record<string, string>
  ): void {
    if (spec.environment?.skyboxColor) {
      this.scene.background = new THREE.Color(spec.environment.skyboxColor);
    }

    // Cargar entorno sólo si se especifica URL y no está ya cargado ni en proceso
    if (environmentUrl) {
      if (this.currentEnvironmentUrl !== environmentUrl || (!this.environmentMesh && !this.isLoadingEnvironment)) {
        this.loadEnvironment(environmentUrl, undefined, false).catch(() => {
          if (this.defaultGround) this.defaultGround.visible = true;
          if (this.gridHelper) this.gridHelper.visible = true;
        });
      }
    } else if (!this.environmentMesh && !this.isLoadingEnvironment) {
      if (this.defaultGround) this.defaultGround.visible = true;
      if (this.gridHelper) this.gridHelper.visible = true;
    }

    // Reconciliar assets en Three.js sin recrear los existentes
    spec.assets.forEach((asset) => {
      let group = this.assetMeshes.find((g) => g.name === asset.id);
      const customModelUrl = assetUrls?.[asset.id];

      if (!group) {
        const groundY = this.getGroundHeightAt(asset.position.x, asset.position.z);
        const estimatedHeight = 1.0;
        // Pivote en el centro: la base del marcador provisional queda sobre el suelo
        const posY =
          asset.anchorToGround !== false ? groundY + estimatedHeight / 2 + asset.position.y : asset.position.y;

        group = new THREE.Group();
        group.name = asset.id;
        group.userData = {
          id: asset.id,
          name: asset.name,
          url: customModelUrl,
          entityHeight: estimatedHeight,
          halfHeight: estimatedHeight / 2,
        };
        group.position.set(asset.position.x, posY, asset.position.z);
        group.rotation.set(asset.rotation.x, asset.rotation.y, asset.rotation.z);
        group.scale.set(asset.scale.x, asset.scale.y, asset.scale.z);

        this.scene.add(group);
        this.assetMeshes.push(group);
      }

      if (customModelUrl && group.userData?.loadedUrl !== customModelUrl) {
        group.userData.loadedUrl = customModelUrl;
        group.userData.url = customModelUrl;
        this.loadAssetGlb(asset.id, customModelUrl, asset);
      }
    });

    // Limpiar assets removidos
    const validIds = new Set(spec.assets.map((a) => a.id));
    this.assetMeshes = this.assetMeshes.filter((group) => {
      if (!validIds.has(group.name) && !group.userData?.isUserSpawned) {
        this.scene.remove(group);
        return false;
      }
      return true;
    });

    this.clearHistory();
    this.notifyObjectsChanged();
  }

  public resetCamera(): void {
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1);
    this.euler.set(0, 0, 0);
    this.camera.quaternion.setFromEuler(this.euler);
  }

  /** Retira el entorno actual de la escena y libera sus recursos (los SplatMesh exponen dispose()). */
  private disposeEnvironmentMesh(): void {
    const mesh = this.environmentMesh as (THREE.Object3D & { dispose?: () => void }) | null;
    if (!mesh) return;

    this.scene.remove(mesh);
    if (typeof mesh.dispose === 'function') mesh.dispose();
    this.environmentMesh = null;
  }

  public clearEnvironment(): void {
    this.disposeEnvironmentMesh();
    this.currentEnvironmentUrl = null;
    this.clearCollider();
    this.setFloorOverride(null);
    if (this.defaultGround) this.defaultGround.visible = true;
    if (this.gridHelper) this.gridHelper.visible = true;
  }

  public clearScene(): void {
    this.clearAssets();
    this.clearEnvironment();
  }

  public clearAssets(): void {
    this.deselectAsset();
    for (const group of this.assetMeshes) {
      this.scene.remove(group);
      this.disposeGroup(group);
    }
    this.assetMeshes = [];
    // Los grupos retenidos por el historial (borrados deshacibles) también se liberan
    for (const entry of [...this.undoStack, ...this.redoStack]) {
      if (entry.kind === 'delete' || entry.kind === 'add') this.disposeGroup(entry.group);
    }
    this.clearHistory();
    this.notifyObjectsChanged();
  }

  /**
   * Métodos Públicos de Interlace / JupiterSR
   */
  public setInterlaceMode(mode: '2d' | 'interlaced' | 'view'): void {
    if (this.interlacer) {
      this.interlacer.setOptions({ mode });
      this.isInterlaceActive = mode !== '2d';
    }
  }

  public getInterlaceProfile(): Profile | null {
    return this.interlacer ? this.interlacer.getProfile() : null;
  }

  public setInterlaceCalibration(calibration: Partial<Calibration>): void {
    if (this.interlacer) {
      this.interlacer.setCalibration(calibration);
    }
  }

  public setInterlaceOptions(options: Partial<RenderOptions>): void {
    if (this.interlacer) {
      this.interlacer.setOptions(options);
      if (options.mode !== undefined) {
        this.isInterlaceActive = options.mode !== '2d';
      }
    }
  }

  public exportInterlaceProfile(): string | null {
    return this.interlacer ? this.interlacer.exportProfile() : null;
  }

  public importInterlaceProfile(profile: string | object): void {
    if (this.interlacer) {
      this.interlacer.importProfile(profile);
      const current = this.interlacer.getProfile();
      this.isInterlaceActive = current.render.mode !== '2d';
    }
  }

  public subscribeInterlaceProfile(listener: (profile: Profile) => void): (() => void) | undefined {
    return this.interlacer ? this.interlacer.subscribe(listener) : undefined;
  }

  private startRenderLoop = (): void => {
    if (this.isDestroyed) return;

    const now = performance.now();
    const deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    // Actualizar navegación WASD, transición de foco (F) y órbita de presentación
    this.updateCameraTween(deltaTime);
    this.updateAutoOrbit(deltaTime);
    this.updateNavigation(deltaTime);

    if (this.interlacer && this.isInterlaceActive) {
      this.interlacer.render(this.scene, this.camera);
    } else {
      if (this.renderer.getRenderTarget && this.renderer.getRenderTarget() !== null) {
        this.renderer.setRenderTarget(null);
      }
      this.renderer.render(this.scene, this.camera);
    }

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animationFrameId = requestAnimationFrame(this.startRenderLoop);
    }
  };

  private onWindowResize = (): void => {
    if (this.isDestroyed || !this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
    }

    this.deselectAsset();

    if (this.transformControls) {
      this.transformControls.dispose();
      this.transformControls = null;
    }
    if (this.transformControlsHelper) {
      this.scene.remove(this.transformControlsHelper);
      this.transformControlsHelper = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.onWindowResize);
      window.removeEventListener('keydown', this.onKeyDown);
      window.removeEventListener('keyup', this.onKeyUp);
      window.removeEventListener('blur', this.onWindowBlur);
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
    }

    const el = this.renderer.domElement;
    if (el) {
      el.removeEventListener('pointerdown', this.onPointerDown);
    }

    if (this.interlacer) {
      this.interlacer.dispose();
      this.interlacer = null;
    }

    if (this.dracoLoader) {
      this.dracoLoader.dispose();
      this.dracoLoader = null;
    }

    if (this.ktx2Loader) {
      this.ktx2Loader.dispose();
      this.ktx2Loader = null;
    }

    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}

