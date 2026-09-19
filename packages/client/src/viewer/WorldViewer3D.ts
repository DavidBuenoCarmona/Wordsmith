// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SparkRenderer, SplatMesh } from '@sparkjsdev/spark';
import { WorldSpec } from '@wordsmith/shared';

export interface WorldViewerOptions {
  onProgress?: (progress: number, detail: string) => void;
  onLoaded?: () => void;
  onError?: (error: string) => void;
}

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
  private assetMeshes: THREE.Group[] = [];
  private gltfLoader = new GLTFLoader();
  private sparkRenderer: InstanceType<typeof SparkRenderer> | null = null;

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

    const width = container.clientWidth || window.innerWidth || 800;
    const height = container.clientHeight || window.innerHeight || 600;

    this.camera = new THREE.PerspectiveCamera(70, width / height, 0.01, 2000);
    // Posición inicial en el origen mirando hacia -Z como en World Labs
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1);
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.tabIndex = 0;
    this.renderer.domElement.style.outline = 'none';
    container.appendChild(this.renderer.domElement);

    // Inicializar SparkRenderer para renderizado de Gaussian Splatting
    try {
      this.sparkRenderer = new SparkRenderer({ renderer: this.renderer });
      this.scene.add(this.sparkRenderer as unknown as THREE.Object3D);
    } catch (e) {
      console.warn('⚠️ [SparkRenderer] Inicialización:', e);
    }

    this.setupLighting();
    this.setupDefaultEnvironment();
    this.setupEventListeners();
    this.startRenderLoop();
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
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.8,
      metalness: 0.2,
    });
    this.defaultGround = new THREE.Mesh(groundGeo, groundMat);
    this.defaultGround.rotation.x = -Math.PI / 2;
    this.defaultGround.receiveShadow = true;
    this.scene.add(this.defaultGround);

    this.gridHelper = new THREE.GridHelper(60, 60, 0x6366f1, 0x1e293b);
    this.gridHelper.position.y = 0.005;
    this.scene.add(this.gridHelper);
  }

  private setupEventListeners(): void {
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  private onPointerDown = (e: PointerEvent): void => {
    this.isPointerDown = true;
    this.prevPointerX = e.clientX;
    this.prevPointerY = e.clientY;
    this.renderer.domElement.focus();
  };

  private onPointerMove = (e: PointerEvent): void => {
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

  private onPointerUp = (): void => {
    this.isPointerDown = false;
  };

  private updateNavigation(deltaTime: number): void {
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
   * Carga el entorno 3D de World Labs (soporta Gaussian Splatting .spz, GLB o Pano 360)
   */
  public async loadEnvironment(url: string): Promise<void> {
    if (this.environmentMesh) {
      this.scene.remove(this.environmentMesh);
      this.environmentMesh = null;
    }

    const isSplat = url.endsWith('.spz') || url.endsWith('.splat') || url.includes('.spz');
    const isPano = url.endsWith('.png') || url.endsWith('.jpg') || url.includes('panos');

    if (isSplat) {
      return this.loadSplatEnvironment(url);
    } else if (isPano) {
      return this.loadPanoEnvironment(url);
    } else {
      return this.loadGlbEnvironment(url);
    }
  }

  /**
   * Carga entorno 3D mediante 3D Gaussian Splatting (@sparkjsdev/spark)
   */
  private async loadSplatEnvironment(url: string): Promise<void> {
    this.options?.onProgress?.(15, 'Descargando Gaussian Splat 3D...');

    return new Promise((resolve, reject) => {
      try {
        const splatMesh = new SplatMesh({
          url,
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
            this.options?.onProgress?.(100, 'Mundo 3D Splat listo');
            this.options?.onLoaded?.();
            resolve();
          },
        });

        // Marble SPZs legacy orientation (OpenCV space, +Y down -> rotar Math.PI en X)
        splatMesh.rotation.x = Math.PI;

        this.environmentMesh = splatMesh as unknown as THREE.Object3D;
        this.scene.add(this.environmentMesh);

        // Ocultar grid genérico
        if (this.gridHelper) this.gridHelper.visible = false;
        if (this.defaultGround) this.defaultGround.visible = false;

        // Posición inicial de cámara
        this.camera.position.set(0, 0, 0);
        this.camera.lookAt(0, 0, -1);
        this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
      } catch (err) {
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

          if (this.gridHelper) this.gridHelper.visible = false;
          if (this.defaultGround) this.defaultGround.visible = false;

          this.options?.onProgress?.(100, 'Mapa 3D listo');
          this.options?.onLoaded?.();
          resolve();
        },
        (event) => {
          if (event.lengthComputable) {
            const pct = Math.min((event.loaded / event.total) * 100, 99);
            const mb = (event.loaded / 1024 / 1024).toFixed(1);
            this.options?.onProgress?.(pct, `Cargando mapa: ${mb} MB`);
          }
        },
        (err) => {
          this.options?.onError?.(`Error al cargar GLB: ${url}`);
          reject(err);
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
          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          if (existingGroup) {
            while (existingGroup.children.length > 0) {
              existingGroup.remove(existingGroup.children[0]);
            }
            existingGroup.add(model);
          } else {
            const group = new THREE.Group();
            group.name = assetId;
            group.position.set(spec.position.x, spec.position.y, spec.position.z);
            group.rotation.set(spec.rotation.x, spec.rotation.y, spec.rotation.z);
            group.scale.set(spec.scale.x, spec.scale.y, spec.scale.z);
            group.add(model);
            this.scene.add(group);
            this.assetMeshes.push(group);
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
   * Si no se especifica posición, se inserta frente a la vista de cámara actual.
   */
  public async spawnModel(
    url: string,
    name?: string,
    customPosition?: { x: number; y: number; z: number }
  ): Promise<string> {
    const assetId = `model-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    this.options?.onProgress?.(20, `Cargando modelo 3D: ${name || 'GLB'}...`);

    // Calcular posición frente a la cámara si no viene definida
    let spawnPos: THREE.Vector3;
    if (customPosition) {
      spawnPos = new THREE.Vector3(customPosition.x, customPosition.y, customPosition.z);
    } else {
      // 2.5 metros en la dirección de la cámara
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      spawnPos = this.camera.position.clone().add(forward.multiplyScalar(2.5));
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
          group.position.copy(spawnPos);
          group.userData = {
            id: assetId,
            name: name || 'Modelo GLB',
            url,
            isUserSpawned: true,
          };
          group.add(model);

          this.scene.add(group);
          this.assetMeshes.push(group);

          this.options?.onProgress?.(100, `Modelo '${name || 'GLB'}' agregado al mundo`);
          setTimeout(() => {
            this.options?.onLoaded?.();
          }, 1200);

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

    // Cargar entorno (Gaussian Splatting SPZ, Pano o GLB)
    const envUrl =
      environmentUrl ||
      'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/5cc52299-dd1e-40dd-b325-4762fce22f4b_ceramic_500k.spz';

    this.loadEnvironment(envUrl).catch(() => {
      if (this.defaultGround) this.defaultGround.visible = true;
      if (this.gridHelper) this.gridHelper.visible = true;
    });

    // Limpiar assets previos
    this.clearAssets();

    // Componer assets en Three.js (únicamente si existe modelo 3D real .glb)
    spec.assets.forEach((asset) => {
      const customModelUrl = assetUrls?.[asset.id];
      if (customModelUrl && customModelUrl.includes('.glb')) {
        const group = new THREE.Group();
        group.name = asset.id;
        group.position.set(asset.position.x, asset.position.y, asset.position.z);
        group.rotation.set(asset.rotation.x, asset.rotation.y, asset.rotation.z);
        group.scale.set(asset.scale.x, asset.scale.y, asset.scale.z);

        this.scene.add(group);
        this.assetMeshes.push(group);
        this.loadAssetGlb(asset.id, customModelUrl, asset);
      }
    });
  }

  public resetCamera(): void {
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1);
    this.euler.set(0, 0, 0);
    this.camera.quaternion.setFromEuler(this.euler);
  }

  private clearAssets(): void {
    for (const group of this.assetMeshes) {
      this.scene.remove(group);
    }
    this.assetMeshes = [];
  }

  private startRenderLoop = (): void => {
    if (this.isDestroyed) return;

    const now = performance.now();
    const deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.1);
    this.lastFrameTime = now;

    // Actualizar navegación WASD
    this.updateNavigation(deltaTime);

    this.renderer.render(this.scene, this.camera);
    this.animationFrameId = requestAnimationFrame(this.startRenderLoop);
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
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);

    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
