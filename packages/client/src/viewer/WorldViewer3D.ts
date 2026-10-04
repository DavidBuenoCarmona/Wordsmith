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
import { WorldSpec } from '@wordsmith/shared';
import {
  InterlaceRenderer,
  type Calibration,
  type RenderOptions,
  type Profile,
} from 'jupiter-interlace-sdk';

export interface WorldViewerOptions {
  onProgress?: (progress: number, detail: string) => void;
  onLoaded?: () => void;
  onError?: (error: string) => void;
  onAssetSelected?: (assetId: string | null, position?: THREE.Vector3, rotation?: THREE.Euler) => void;
  onAssetTransformed?: (
    assetId: string,
    position: { x: number; y: number; z: number },
    rotation: { x: number; y: number; z: number }
  ) => void;
  onAssetDeleted?: (assetId: string) => void;
  interlaceCalibration?: Partial<Calibration>;
  interlaceRenderOptions?: Partial<RenderOptions>;
}

export type TransformMode = 'translate' | 'rotate';

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

      this.transformControls.addEventListener('dragging-changed', (event: any) => {
        this.isDraggingGizmo = !!event.value;
        if (!event.value && this.selectedAssetId) {
          const group = this.assetMeshes.find((g) => g.name === this.selectedAssetId);
          if (group) {
            this.options?.onAssetTransformed?.(
              this.selectedAssetId,
              { x: group.position.x, y: group.position.y, z: group.position.z },
              { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z }
            );
          }
        }
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    this.scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight1.position.set(20, 35, 20);
    dirLight1.castShadow = true;
    this.scene.add(dirLight1);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1e293b, 0.8);
    this.scene.add(hemiLight);
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
      window.addEventListener('pointermove', this.onPointerMove);
      window.addEventListener('pointerup', this.onPointerUp);
    }

    const el = this.renderer.domElement;
    if (el) {
      el.addEventListener('pointerdown', this.onPointerDown);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
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

    const hits = raycaster.intersectObjects(this.assetMeshes, true);
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

    if (this.keysDown.has('KeyW') || this.keysDown.has('ArrowUp')) moveVector.z -= 1;
    if (this.keysDown.has('KeyS') || this.keysDown.has('ArrowDown')) moveVector.z += 1;
    if (this.keysDown.has('KeyA') || this.keysDown.has('ArrowLeft')) moveVector.x -= 1;
    if (this.keysDown.has('KeyD') || this.keysDown.has('ArrowRight')) moveVector.x += 1;
    if (this.keysDown.has('Space') || this.keysDown.has('KeyE')) moveVector.y += 1;
    if (this.keysDown.has('KeyC') || this.keysDown.has('KeyQ')) moveVector.y -= 1;

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
    const group = this.assetMeshes.find((g) => g.name === assetId);
    if (!group) return;

    this.selectedAssetId = assetId;

    if (this.selectionBoxHelper) {
      this.scene.remove(this.selectionBoxHelper);
      this.selectionBoxHelper.dispose();
      this.selectionBoxHelper = null;
    }

    this.selectionBoxHelper = new THREE.BoxHelper(group, 0x6366f1);
    this.scene.add(this.selectionBoxHelper);

    if (this.transformControls) {
      this.transformControls.attach(group);
      this.transformControls.enabled = true;
    }

    this.options?.onAssetSelected?.(
      assetId,
      group.position.clone(),
      group.rotation.clone()
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

  public snapSelectedToGround(): void {
    if (!this.selectedAssetId) return;
    const group = this.assetMeshes.find((g) => g.name === this.selectedAssetId);
    if (!group) return;

    // Calcular la mitad de la altura de la caja delimitadora del grupo para que la base quede sobre el suelo
    let halfHeight = 0;
    if (group.children.length > 0) {
      const box = new THREE.Box3().setFromObject(group);
      if (Number.isFinite(box.min.y) && Number.isFinite(box.max.y)) {
        halfHeight = (box.max.y - box.min.y) / 2;
      }
    }

    const groundY = this.getGroundHeightAt(group.position.x, group.position.z);
    group.position.y = groundY + halfHeight;

    if (this.selectionBoxHelper) {
      this.selectionBoxHelper.update();
    }

    this.options?.onAssetTransformed?.(
      this.selectedAssetId,
      { x: group.position.x, y: group.position.y, z: group.position.z },
      { x: group.rotation.x, y: group.rotation.y, z: group.rotation.z }
    );
  }

  public deleteSelectedAsset(): void {
    if (!this.selectedAssetId) return;
    const id = this.selectedAssetId;
    const groupIndex = this.assetMeshes.findIndex((g) => g.name === id);

    if (groupIndex !== -1) {
      const group = this.assetMeshes[groupIndex];
      this.scene.remove(group);
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
      this.assetMeshes.splice(groupIndex, 1);
    }

    this.deselectAsset();
    this.options?.onAssetDeleted?.(id);
  }

  /**
   * Carga el entorno 3D de World Labs (soporta Gaussian Splatting .spz, .ply, GLB o Pano 360)
   */
  public async loadEnvironment(
    url: string,
    hintType?: 'spz' | 'ply' | 'glb' | 'pano',
    clearExistingAssets: boolean = true
  ): Promise<void> {
    if (this.currentEnvironmentUrl === url && (this.environmentMesh || this.isLoadingEnvironment)) {
      return;
    }
    this.currentEnvironmentUrl = url;
    this.isLoadingEnvironment = true;

    // Limpiar todos los modelos/assets 3D previos solo si se solicita explícitamente
    if (clearExistingAssets) {
      this.clearAssets();
    }

    if (this.environmentMesh) {
      this.scene.remove(this.environmentMesh);
      if ('dispose' in this.environmentMesh && typeof (this.environmentMesh as any).dispose === 'function') {
        (this.environmentMesh as any).dispose();
      }
      this.environmentMesh = null;
    }

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
            this.options?.onProgress?.(pct, `Cargando splat 3D: ${mb} MB`);
          },
          onLoad: () => {
            // Posición inicial de cámara una vez cargado el splat 3D
            this.camera.position.set(0, 0, 0);
            this.camera.lookAt(0, 0, -1);
            this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

            // En Gaussian Splats, el suelo físico respecto al ojo de cámara (0,0,0) está en -1.5m
            this.setGroundLevel(-1.5);

            this.isLoadingEnvironment = false;
            this.options?.onProgress?.(100, 'Mundo 3D Splat listo');
            this.options?.onLoaded?.();
            resolve();
          },
        });

        // Marble SPZs usan orientación OpenCV (+Y down -> rotar Math.PI en X)
        // Archivos .ply estándar ya tienen orientación nativa (+Y up en Three.js)
        if (!isPly) {
          splatMesh.rotation.x = Math.PI;
        } else {
          splatMesh.rotation.set(0, 0, 0);
        }

        this.environmentMesh = splatMesh as unknown as THREE.Object3D;
        this.scene.add(this.environmentMesh);

        // Ocultar grid genérico
        if (this.gridHelper) this.gridHelper.visible = false;
        if (this.defaultGround) this.defaultGround.visible = false;
      } catch (err) {
        this.isLoadingEnvironment = false;
        console.warn('⚠️ [SplatMesh] Error cargando Splat:', err);
        this.options?.onError?.(`Error al cargar Splat: ${err}`);
        reject(err);
      }
    });
  }

  /**
   * Carga entorno mediante Panorama 360 esférico inmersivo
   */
  private async loadPanoEnvironment(url: string): Promise<void> {
    this.options?.onProgress?.(25, 'Cargando panorama 360...');

    return new Promise((resolve, reject) => {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(
        url,
        (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.mapping = THREE.EquirectangularReflectionMapping;

          const sphereGeo = new THREE.SphereGeometry(150, 64, 40);
          sphereGeo.scale(-1, 1, 1); // Invertir caras hacia el interior
          const sphereMat = new THREE.MeshBasicMaterial({ map: texture });
          const sphere = new THREE.Mesh(sphereGeo, sphereMat);

          this.environmentMesh = sphere;
          this.scene.add(this.environmentMesh);

          this.setGroundLevel(-1.5);

          this.isLoadingEnvironment = false;
          this.options?.onProgress?.(100, 'Panorama 360 listo');
          this.options?.onLoaded?.();
          resolve();
        },
        (event) => {
          if (event.lengthComputable) {
            const pct = Math.min((event.loaded / event.total) * 100, 99);
            this.options?.onProgress?.(pct, `Cargando 360: ${pct.toFixed(0)}%`);
          }
        },
        (err) => {
          this.isLoadingEnvironment = false;
          this.options?.onError?.('Error al cargar textura panorámica');
          reject(err);
        }
      );
    });
  }

  /**
   * Carga entorno mediante GLTF / GLB Mesh
   */
  private async loadGlbEnvironment(url: string): Promise<void> {
    this.options?.onProgress?.(15, 'Descargando mapa GLB...');

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

          // En mallas GLB el suelo es la base mínima de la geometría
          this.setGroundLevel(box.min.y);

          this.isLoadingEnvironment = false;
          this.options?.onProgress?.(100, 'Mapa 3D listo');
          this.options?.onLoaded?.();
          resolve();
        },
        (event) => {
          if (event.lengthComputable) {
            const pct = Math.min((event.loaded / event.total) * 100, 99);
            const mb = (event.loaded / 1024 / 1024).toFixed(1);
            this.options?.onProgress?.(pct, `Cargando mapa GLB: ${mb} MB`);
          }
        },
        (err) => {
          this.isLoadingEnvironment = false;
          this.options?.onError?.('Error al cargar mapa GLB');
          reject(err);
        }
      );
    });
  }

  /**
   * Permite calibrar dinámicamente la altura del suelo y actualiza todos los objetos.
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
      group.position.y = this.groundLevelY;
    }
    if (this.selectionBoxHelper) {
      this.selectionBoxHelper.update();
    }
  }

  public getGroundLevel(): number {
    return this.groundLevelY;
  }

  /**
   * Detecta la altura Y del suelo en una coordenada horizontal (x, z)
   * utilizando Raycasting vertical hacia abajo sobre el entorno 3D y el plano base.
   */
  public getGroundHeightAt(x: number, z: number): number {
    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(x, 150, z), new THREE.Vector3(0, -1, 0));
    raycaster.far = 400;

    const colliders: THREE.Object3D[] = [];
    if (this.environmentMesh) {
      colliders.push(this.environmentMesh);
    }
    if (this.defaultGround) {
      colliders.push(this.defaultGround);
    }

    if (colliders.length > 0) {
      const hits = raycaster.intersectObjects(colliders, true);
      for (const hit of hits) {
        if (typeof hit.point?.y === 'number') {
          if (hit.face && hit.face.normal) {
            const worldNormal = hit.face.normal
              .clone()
              .applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion()));
            if (worldNormal.y > 0.1) {
              return hit.point.y;
            }
          } else {
            return hit.point.y;
          }
        }
      }
    }

    return this.groundLevelY;
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
    const posY = this.groundLevelY + (spec.position.y || 0);

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
          const halfHeight = (scaledBox.max.y - scaledBox.min.y) / 2;
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

          const groupPosY = posY + halfHeight;

          if (existingGroup) {
            while (existingGroup.children.length > 0) {
              existingGroup.remove(existingGroup.children[0]);
            }
            existingGroup.userData = {
              id: assetId,
              name: spec.name,
              url,
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
    customPosition?: { x: number; y: number; z: number }
  ): Promise<string> {
    const assetId = `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.options?.onProgress?.(20, `Cargando modelo 3D: ${name || 'GLB'}...`);

    // Posición horizontal (x, z) delante de la cámara
    let targetX: number;
    let targetZ: number;
    let targetY: number;

    if (customPosition) {
      targetX = customPosition.x;
      targetY = customPosition.y;
      targetZ = customPosition.z;
    } else {
      // Vector de dirección de la cámara en el espacio 3D
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      if (forward.lengthSq() > 0.001) {
        forward.normalize();
      } else {
        forward.set(0, 0, -1);
      }

      // Spawnear a 3 metros directamente delante de la cámara y a la misma altura de la vista del usuario
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

          const group = new THREE.Group();
          group.name = assetId;
          group.position.set(targetX, targetY, targetZ);
          group.userData = {
            id: assetId,
            name: name || 'Modelo GLB',
            url,
            isUserSpawned: true,
          };
          group.add(model);

          this.scene.add(group);
          this.assetMeshes.push(group);

          // Auto-seleccionar el modelo recién spawneado
          this.selectAsset(assetId);

          this.options?.onProgress?.(100, `Modelo '${name || 'GLB'}' agregado sobre el plano de suelo`);
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
            this.options?.onProgress?.(pct, `Cargando modelo: ${pct.toFixed(0)}%`);
          }
        },
        (err) => {
          console.warn(`⚠️ [GLTFLoader] Error al spawnear modelo '${url}':`, err);
          this.options?.onError?.(`Error al cargar modelo: ${name || url}`);
          reject(err);
        }
      );
    });
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
        const posY = asset.anchorToGround !== false ? groundY + asset.position.y : asset.position.y;

        group = new THREE.Group();
        group.name = asset.id;
        group.userData = {
          id: asset.id,
          name: asset.name,
          url: customModelUrl,
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
  }

  public resetCamera(): void {
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1);
    this.euler.set(0, 0, 0);
    this.camera.quaternion.setFromEuler(this.euler);
  }

  public clearEnvironment(): void {
    if (this.environmentMesh) {
      this.scene.remove(this.environmentMesh);
      if ('dispose' in this.environmentMesh && typeof (this.environmentMesh as any).dispose === 'function') {
        (this.environmentMesh as any).dispose();
      }
      this.environmentMesh = null;
    }
    this.currentEnvironmentUrl = null;
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
    this.assetMeshes = [];
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

    // Actualizar navegación WASD
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

