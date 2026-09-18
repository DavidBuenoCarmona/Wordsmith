// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import * as THREE from 'three';
import { WorldSpec } from '@wordsmith/shared';

export class WorldViewer3D {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private container: HTMLElement;
  private isDestroyed = false;
  private animationFrameId: number | null = null;
  private assetMeshes: THREE.Group[] = [];

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0d1117');

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.camera.position.set(0, 5, 12);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupDefaultEnvironment();
    this.startRenderLoop();

    window.addEventListener('resize', this.onWindowResize);
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    this.scene.add(dirLight);

    const grid = new THREE.GridHelper(30, 30, 0x4f46e5, 0x1f2937);
    grid.position.y = -0.01;
    this.scene.add(grid);
  }

  private setupDefaultEnvironment(): void {
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.8,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  public applyWorldSpec(spec: WorldSpec): void {
    if (spec.environment?.skyboxColor) {
      this.scene.background = new THREE.Color(spec.environment.skyboxColor);
    }

    // Limpiar assets previos
    this.clearAssets();

    // Componer assets en Three.js
    spec.assets.forEach((asset, idx) => {
      const group = new THREE.Group();
      group.position.set(asset.position.x, asset.position.y, asset.position.z);
      group.rotation.set(asset.rotation.x, asset.rotation.y, asset.rotation.z);
      group.scale.set(asset.scale.x, asset.scale.y, asset.scale.z);

      // Procedural Visual Placeholder mientras carga el GLB o en modo Mock
      const colors = [0x6366f1, 0xec4899, 0x10b981, 0xf59e0b, 0x3b82f6];
      const mat = new THREE.MeshStandardMaterial({
        color: colors[idx % colors.length],
        roughness: 0.3,
        metalness: 0.2,
      });

      let geo: THREE.BufferGeometry;
      if (asset.category === 'prop') {
        geo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
      } else if (asset.category === 'character') {
        geo = new THREE.CapsuleGeometry(0.5, 1.2, 8, 16);
      } else {
        geo = new THREE.CylinderGeometry(0.8, 1.2, 2, 8);
      }

      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = 0.6; // Apoyar en el suelo
      mesh.castShadow = true;
      group.add(mesh);

      this.scene.add(group);
      this.assetMeshes.push(group);
    });
  }

  private clearAssets(): void {
    for (const group of this.assetMeshes) {
      this.scene.remove(group);
    }
    this.assetMeshes = [];
  }

  private startRenderLoop = (): void => {
    if (this.isDestroyed) return;

    // Rotación suave para vista cinematográfica
    for (let i = 0; i < this.assetMeshes.length; i++) {
      this.assetMeshes[i].rotation.y += 0.005;
    }

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
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
