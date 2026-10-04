// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { WorldViewer3D, TransformMode } from './viewer/WorldViewer3D.js';
import { useGenerationJob } from './hooks/useGenerationJob.js';
import { PromptBar } from './components/PromptBar.js';
import { ProgressOverlay } from './components/ProgressOverlay.js';
import { AssetInspector } from './components/AssetInspector.js';
import { TransformToolbar } from './components/TransformToolbar.js';
import { WorldSelector, SavedWorld } from './components/WorldSelector.js';
import { ModelSelector, SavedModel } from './components/ModelSelector.js';
import { JupiterSRPanel } from './components/JupiterSRPanel.js';
import { Compass, Sparkles, Navigation, RotateCcw, Upload, Globe, Box, ChevronDown } from 'lucide-react';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<WorldViewer3D | null>(null);
  const [viewerInstance, setViewerInstance] = useState<WorldViewer3D | null>(null);
  const mapFileInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const importDropdownRef = useRef<HTMLDivElement>(null);

  const [mapStatus, setMapStatus] = useState<string | null>(null);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState<boolean>(false);
  const [activeWorldUrl, setActiveWorldUrl] = useState<string | null>(null);

  // Estado de Transformación y Selección
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number; z: number } | undefined>();
  const [selectedRotation, setSelectedRotation] = useState<{ x: number; y: number; z: number } | undefined>();
  const [selectedScale, setSelectedScale] = useState<{ x: number; y: number; z: number } | undefined>();
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');

  const { currentJob, isGenerating, error, startGeneration } = useGenerationJob();
  const currentJobRef = useRef<typeof currentJob>(null);
  currentJobRef.current = currentJob;

  const handleStartGeneration = (input: Parameters<typeof startGeneration>[0]) => {
    setSelectedAssetId(null);
    setSelectedPosition(undefined);
    setSelectedRotation(undefined);
    setSelectedScale(undefined);
    setActiveWorldUrl(null);
    if (viewerRef.current) {
      viewerRef.current.clearScene();
    }
    startGeneration(input);
  };

  useEffect(() => {
    if (containerRef.current && !viewerRef.current) {
      const viewer = new WorldViewer3D(containerRef.current, {
        onProgress: (_pct, detail) => setMapStatus(detail),
        onLoaded: () => setMapStatus(null),
        onError: () => setMapStatus(null),
        onAssetSelected: (assetId, pos, rot, scl) => {
          setSelectedAssetId(assetId);
          setSelectedPosition(pos ? { x: pos.x, y: pos.y, z: pos.z } : undefined);
          setSelectedRotation(rot ? { x: rot.x, y: rot.y, z: rot.z } : undefined);
          setSelectedScale(scl ? { x: scl.x, y: scl.y, z: scl.z } : undefined);
        },
        onAssetTransformed: (assetId, pos, rot, scl) => {
          setSelectedPosition(pos);
          setSelectedRotation(rot);
          if (scl) {
            setSelectedScale(scl);
          }
          const activeJob = currentJobRef.current;
          if (activeJob?.worldSpec) {
            const asset = activeJob.worldSpec.assets.find((a) => a.id === assetId);
            if (asset) {
              asset.position = { ...pos };
              asset.rotation = { ...rot };
              if (scl) {
                asset.scale = { ...scl };
              }
            }
          }
        },
        onAssetDeleted: (assetId) => {
          const activeJob = currentJobRef.current;
          if (activeJob?.worldSpec) {
            activeJob.worldSpec.assets = activeJob.worldSpec.assets.filter((a) => a.id !== assetId);
          }
          if (activeJob?.assets) {
            activeJob.assets = activeJob.assets.filter((a) => a.id !== assetId);
          }
          setSelectedAssetId(null);
          setSelectedPosition(undefined);
          setSelectedRotation(undefined);
          setSelectedScale(undefined);
        },
      });
      viewerRef.current = viewer;
      setViewerInstance(viewer);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
        setViewerInstance(null);
      }
    };
  }, []);

  // Manejo de atajos de teclado globales para TransformGizmo (W, E, Escape, Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input o textarea
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (!selectedAssetId || !viewerRef.current) return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        setTransformMode('translate');
        viewerRef.current.setTransformMode('translate');
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        setTransformMode('rotate');
        viewerRef.current.setTransformMode('rotate');
      } else if (e.code === 'KeyC') {
        e.preventDefault();
        setTransformMode('scale');
        viewerRef.current.setTransformMode('scale');
      } else if (e.code === 'Escape') {
        e.preventDefault();
        viewerRef.current.deselectAsset();
        setSelectedAssetId(null);
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        viewerRef.current.deleteSelectedAsset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedAssetId]);

  // Actualizar escena 3D ÚNICAMENTE cuando la generación ha finalizado con éxito (COMPLETED)
  useEffect(() => {
    // Si la generación sigue en curso o falló, la escena se mantiene completamente limpia
    if (isGenerating || currentJob?.phase !== 'COMPLETED') {
      return;
    }

    if (currentJob?.worldSpec && viewerRef.current) {
      const assetUrlMap: Record<string, string> = {};
      currentJob.assets.forEach((a) => {
        if (a.modelUrl) {
          assetUrlMap[a.id] = a.modelUrl;
        }
      });

      if (currentJob.environment?.sceneUrl) {
        setActiveWorldUrl(currentJob.environment.sceneUrl);
      }

      viewerRef.current.applyWorldSpec(
        currentJob.worldSpec,
        currentJob.environment?.sceneUrl,
        assetUrlMap
      );
    }
  }, [currentJob?.worldSpec, currentJob?.environment?.sceneUrl, currentJob?.assets, currentJob?.phase, isGenerating]);

  // Cerrar menú de importar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (importDropdownRef.current && !importDropdownRef.current.contains(e.target as Node)) {
        setIsImportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectWorld = (world: SavedWorld) => {
    setActiveWorldUrl(world.sceneUrl);
    if (viewerRef.current) {
      viewerRef.current.loadEnvironment(world.sceneUrl, world.type);
    }
  };

  const handleSpawnModel = (model: SavedModel) => {
    if (viewerRef.current) {
      viewerRef.current.spawnModel(model.modelUrl, model.name);
    }
  };

  // Cargar mapa / entorno local (.spz, .ply, .glb, .png, .jpg)
  const handleLoadMapFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewerRef.current) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    // Añadimos hash con nombre de archivo al Blob URL para preservar la extensión en Spark / Three
    const objectUrl = `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`;
    const type: SavedWorld['type'] =
      ext === 'png' || ext === 'jpg' || ext === 'jpeg'
        ? 'pano'
        : ext === 'glb' || ext === 'gltf'
        ? 'glb'
        : ext === 'ply'
        ? 'ply'
        : 'spz';

    const customWorld: SavedWorld = {
      id: `blob-world-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ''),
      description: `${ext?.toUpperCase()} map loaded in memory (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      sceneUrl: objectUrl,
      type,
      source: 'local_file',
    };

    handleSelectWorld(customWorld);
    setIsImportMenuOpen(false);
    if (mapFileInputRef.current) mapFileInputRef.current.value = '';
  };

  // Load local 3D model / entity (.glb, .gltf)
  const handleLoadModelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewerRef.current) return;

    const objectUrl = `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`;
    const customModel: SavedModel = {
      id: `blob-model-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ''),
      description: `3D model loaded in memory (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      modelUrl: objectUrl,
      source: 'local_file',
    };

    handleSpawnModel(customModel);
    setIsImportMenuOpen(false);
    if (modelFileInputRef.current) modelFileInputRef.current.value = '';
  };

  const selectedAssetName = currentJob?.worldSpec?.assets.find((a) => a.id === selectedAssetId)?.name;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Hidden inputs for local file loading */}
      <input
        ref={mapFileInputRef}
        type="file"
        accept=".spz,.ply,.splat,.glb,.gltf,.png,.jpg,.jpeg"
        onChange={handleLoadMapFile}
        className="hidden"
      />
      <input
        ref={modelFileInputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={handleLoadModelFile}
        className="hidden"
      />

      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-40">
        <div className="flex items-center gap-2.5 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 pointer-events-auto shadow-xl">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
              Wordsmith <span className="text-[10px] text-indigo-400 font-mono px-1.5 py-0.5 bg-indigo-950/60 rounded border border-indigo-800/50">MVP</span>
            </h1>
            <p className="text-[11px] text-slate-400">AI-Native 3D World Director</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 pointer-events-auto">
          {mapStatus && (
            <div className="bg-indigo-950/80 border border-indigo-700/60 px-3 py-1.5 rounded-xl text-xs text-indigo-200 backdrop-blur-md animate-pulse shadow-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
              {mapStatus}
            </div>
          )}

          {/* Direct Import Dropdown Menu */}
          <div ref={importDropdownRef} className="relative z-50">
            <button
              onClick={() => setIsImportMenuOpen(!isImportMenuOpen)}
              title="Import map or 3D model directly from your device"
              className="flex items-center gap-1.5 bg-indigo-950/85 hover:bg-indigo-900/90 border border-indigo-700/60 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs text-white shadow-xl transition-all active:scale-95"
            >
              <Upload className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold">Import</span>
              <ChevronDown
                className={`w-3 h-3 text-indigo-300 transition-transform duration-200 ${
                  isImportMenuOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isImportMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-750 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-150 space-y-1 z-50">
                <button
                  onClick={() => {
                    mapFileInputRef.current?.click();
                    setIsImportMenuOpen(false);
                  }}
                  className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-800/80 text-left transition-colors group"
                >
                  <div className="p-1.5 rounded-lg bg-indigo-950/70 border border-indigo-800/50 text-indigo-400 group-hover:bg-indigo-900 group-hover:text-white transition-colors mt-0.5">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-100 block">Load Map</span>
                    <span className="text-[10px] text-slate-400 block leading-tight">.spz, .ply, .glb or 360 files</span>
                  </div>
                </button>

                <button
                  onClick={() => {
                    modelFileInputRef.current?.click();
                    setIsImportMenuOpen(false);
                  }}
                  className="w-full flex items-start gap-2.5 p-2 rounded-xl hover:bg-slate-800/80 text-left transition-colors group"
                >
                  <div className="p-1.5 rounded-lg bg-pink-950/70 border border-pink-800/50 text-pink-400 group-hover:bg-pink-900 group-hover:text-white transition-colors mt-0.5">
                    <Box className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-slate-100 block">Load Model</span>
                    <span className="text-[10px] text-slate-400 block leading-tight">3D entity (.glb / .gltf)</span>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Saved World Selector (.spz / .glb) */}
          <WorldSelector
            activeWorldUrl={activeWorldUrl}
            onSelectWorld={handleSelectWorld}
          />

          {/* 3D Model Selector & Spawner (Tripo / GLB) */}
          <ModelSelector onSpawnModel={handleSpawnModel} />

          {/* JupiterSR Autostereoscopic 3D Panel */}
          <JupiterSRPanel viewer={viewerInstance} />

          <button
            onClick={() => viewerRef.current?.resetCamera()}
            title="Reset camera view"
            className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-750 text-xs text-slate-300 transition-all shadow-lg active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset View</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>World Labs + Tripo 3D</span>
          </div>
        </div>
      </header>

      {/* Navigation Hint */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900/85 border border-slate-800 text-slate-300 px-4 py-1.5 rounded-full text-xs backdrop-blur-md shadow-xl pointer-events-none z-10 flex items-center gap-2">
        <Navigation className="w-3.5 h-3.5 text-indigo-400" />
        <span>Drag to look · <b>WASD</b> fly · <b>Shift</b> speed boost</span>
      </div>

      {/* Floating Transform Toolbar when asset is selected */}
      {selectedAssetId && (
        <TransformToolbar
          selectedAssetId={selectedAssetId}
          selectedAssetName={selectedAssetName}
          mode={transformMode}
          position={selectedPosition}
          rotation={selectedRotation}
          scale={selectedScale}
          onModeChange={(m) => {
            setTransformMode(m);
            viewerRef.current?.setTransformMode(m);
          }}
          onSnapToGround={() => viewerRef.current?.snapSelectedToGround()}
          onDelete={() => viewerRef.current?.deleteSelectedAsset()}
          onClose={() => {
            viewerRef.current?.deselectAsset();
            setSelectedAssetId(null);
          }}
        />
      )}

      {/* Overlays */}
      {isGenerating && currentJob && <ProgressOverlay job={currentJob} />}
      <AssetInspector
        job={currentJob}
        selectedAssetId={selectedAssetId}
        onSelectAsset={(id) => viewerRef.current?.selectAsset(id)}
      />

      {/* Error Banner */}
      {error && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-rose-950/80 border border-rose-500/50 text-rose-200 px-4 py-2 rounded-xl text-xs backdrop-blur-md shadow-2xl z-30">
          {error}
        </div>
      )}

      {/* Bottom Prompt Bar */}
      <footer className="absolute bottom-6 left-0 right-0 px-4 z-10">
        <PromptBar onGenerate={handleStartGeneration} isGenerating={isGenerating} />
      </footer>
    </div>
  );
};
