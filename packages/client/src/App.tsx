// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SCENE_FILE_FORMAT, SCENE_FILE_VERSION, type LightingPreset, type SceneFile } from '@wordsmith/shared';
import {
  WorldViewer3D,
  TransformMode,
  type SceneObjectInfo,
  type FloorInfo,
  type Vec3Like,
} from './viewer/WorldViewer3D.js';
import { useGenerationJob } from './hooks/useGenerationJob.js';
import { useEditorShortcuts } from './hooks/useEditorShortcuts.js';
import { PromptBar } from './components/PromptBar.js';
import { ProgressOverlay } from './components/ProgressOverlay.js';
import { OutlinerPanel } from './components/OutlinerPanel.js';
import { TransformToolbar } from './components/TransformToolbar.js';
import { WorldSelector, SavedWorld } from './components/WorldSelector.js';
import { ModelSelector, SavedModel } from './components/ModelSelector.js';
import { SceneSelector } from './components/SceneSelector.js';
import { ShortcutsHelp } from './components/ShortcutsHelp.js';
import { JupiterSRPanel } from './components/JupiterSRPanel.js';
import { uploadFile, saveScene, loadScene, guessWorldType } from './api/storage.js';
import {
  Compass,
  Sparkles,
  Navigation,
  RotateCcw,
  Upload,
  Globe,
  Box,
  ChevronDown,
  Camera,
  Sun,
  Sunset,
  Moon,
  CloudFog,
  Presentation,
  Keyboard,
} from 'lucide-react';

const LIGHTING_CYCLE: LightingPreset[] = ['day', 'sunset', 'night', 'foggy'];
const LIGHTING_ICONS: Record<LightingPreset, React.ReactNode> = {
  day: <Sun className="w-3.5 h-3.5 text-amber-300" />,
  sunset: <Sunset className="w-3.5 h-3.5 text-orange-400" />,
  night: <Moon className="w-3.5 h-3.5 text-indigo-300" />,
  foggy: <CloudFog className="w-3.5 h-3.5 text-slate-300" />,
};

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<WorldViewer3D | null>(null);
  const [viewerInstance, setViewerInstance] = useState<WorldViewer3D | null>(null);
  const mapFileInputRef = useRef<HTMLInputElement>(null);
  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const importDropdownRef = useRef<HTMLDivElement>(null);

  const [mapStatus, setMapStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isImportMenuOpen, setIsImportMenuOpen] = useState<boolean>(false);
  const [activeWorldUrl, setActiveWorldUrl] = useState<string | null>(null);
  const [activeWorld, setActiveWorld] = useState<SavedWorld | null>(null);
  const [sceneTitle, setSceneTitle] = useState<string>('');
  const [refreshToken, setRefreshToken] = useState<number>(0);

  // Estado de Transformación y Selección
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Vec3Like | undefined>();
  const [selectedRotation, setSelectedRotation] = useState<Vec3Like | undefined>();
  const [selectedScale, setSelectedScale] = useState<Vec3Like | undefined>();
  const [transformMode, setTransformMode] = useState<TransformMode>('translate');
  const [objects, setObjects] = useState<SceneObjectInfo[]>([]);
  const [floor, setFloor] = useState<FloorInfo>({ override: null, level: -1.5 });
  const selectedIdRef = useRef<string | null>(null);
  selectedIdRef.current = selectedAssetId;

  // Presentación, ayuda e iluminación
  const [presentation, setPresentation] = useState<boolean>(false);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const [lighting, setLighting] = useState<LightingPreset>('day');

  const { currentJob, isGenerating, error, startGeneration } = useGenerationJob();
  const currentJobRef = useRef<typeof currentJob>(null);
  currentJobRef.current = currentJob;

  const showNotice = useCallback((text: string) => {
    setNotice(text);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const clearSelectionState = () => {
    setSelectedAssetId(null);
    setSelectedPosition(undefined);
    setSelectedRotation(undefined);
    setSelectedScale(undefined);
  };

  const handleStartGeneration = (input: Parameters<typeof startGeneration>[0]) => {
    // Solo el modo completo reemplaza la escena; "world" y "objects" trabajan sobre lo que ya hay
    if (input.mode === 'all') {
      if (
        objects.length > 0 &&
        !window.confirm(
          `Generating everything replaces the current scene (${objects.length} object(s)). ` +
            'Tip: use “Scenery only” or “Objects only” to keep what you have. Continue?'
        )
      ) {
        return;
      }
      clearSelectionState();
      setActiveWorldUrl(null);
      setActiveWorld(null);
      viewerRef.current?.clearScene();
    }
    startGeneration(input);
  };

  useEffect(() => {
    if (containerRef.current && !viewerRef.current) {
      const viewer = new WorldViewer3D(containerRef.current, {
        onProgress: (_pct, detail) => setMapStatus(detail),
        onLoaded: () => setMapStatus(null),
        onError: () => setMapStatus(null),
        onObjectsChanged: (list) => setObjects(list),
        onFloorChanged: (info) => setFloor(info),
        onAssetSelected: (assetId, pos, rot, scl) => {
          setSelectedAssetId(assetId);
          setSelectedPosition(pos ? { x: pos.x, y: pos.y, z: pos.z } : undefined);
          setSelectedRotation(rot ? { x: rot.x, y: rot.y, z: rot.z } : undefined);
          setSelectedScale(scl ? { x: scl.x, y: scl.y, z: scl.z } : undefined);
        },
        onAssetTransformed: (assetId, pos, rot, scl) => {
          // Deshacer/rehacer puede transformar un objeto distinto del seleccionado
          if (assetId === selectedIdRef.current) {
            setSelectedPosition(pos);
            setSelectedRotation(rot);
            if (scl) setSelectedScale(scl);
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
          if (assetId === selectedIdRef.current) {
            clearSelectionState();
          }
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

  const handleTransformMode = useCallback((mode: TransformMode) => {
    setTransformMode(mode);
    viewerRef.current?.setTransformMode(mode);
  }, []);

  const togglePresentation = useCallback(() => setPresentation((p) => !p), []);
  const exitPresentation = useCallback(() => setPresentation(false), []);
  const toggleHelp = useCallback(() => setHelpOpen((h) => !h), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  useEditorShortcuts({
    viewerRef,
    selectedAssetId,
    presentation,
    helpOpen,
    onTransformMode: handleTransformMode,
    onTogglePresentation: togglePresentation,
    onExitPresentation: exitPresentation,
    onToggleHelp: toggleHelp,
    onCloseHelp: closeHelp,
  });

  // Modo presentación: oculta la interfaz y orbita la cámara alrededor de la escena
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    if (presentation) viewer.deselectAsset();
    viewer.setAutoOrbit(presentation);
  }, [presentation, viewerInstance]);

  // El colisionador de World Labs (si está en caché) permite un suelo fiable
  const attachColliderFor = useCallback((sceneUrl: string) => {
    fetch('/api/storage/worlds')
      .then((res) => (res.ok ? res.json() : { worlds: [] }))
      .then((data: { worlds?: SavedWorld[] }) => {
        const match = data.worlds?.find((w) => w.sceneUrl === sceneUrl && w.colliderUrl);
        if (match?.colliderUrl) viewerRef.current?.attachCollider(match.colliderUrl);
      })
      .catch(() => {
        // Sin colisionador se usa la detección clásica de suelo
      });
  }, []);

  // Cada job se aplica a la escena una sola vez
  const appliedJobRef = useRef<string | null>(null);

  // Aplicar el resultado de la generación a la escena 3D cuando el job termina
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!currentJob || isGenerating || !viewer || appliedJobRef.current === currentJob.id) {
      return;
    }

    if (currentJob.phase === 'FAILED') {
      appliedJobRef.current = currentJob.id;
      showNotice(`Generation failed: ${currentJob.error ?? 'unknown error'}`);
      return;
    }
    if (currentJob.phase !== 'COMPLETED' || !currentJob.worldSpec) {
      return;
    }

    appliedJobRef.current = currentJob.id;
    const sceneUrl = currentJob.environment?.sceneUrl;

    if (currentJob.mode === 'objects') {
      // Solo objetos: se añaden a la escena actual, en fila delante de la cámara y sobre el suelo
      const items = currentJob.assets
        .filter((a) => a.status === 'READY' && a.modelUrl)
        .map((a) => ({ url: a.modelUrl as string, name: a.name }));
      const skipped = currentJob.assets.length - items.length;

      viewer.spawnModelsInFront(items).then(({ ids, failed }) => {
        const problems = failed + skipped;
        showNotice(
          `${ids.length} object(s) added to the scene.` +
            (problems > 0 ? ` ${problems} could not be generated or loaded.` : ' Drag the gizmo or use the Outliner to place them.')
        );
      });
      return;
    }

    if (sceneUrl) {
      setActiveWorldUrl(sceneUrl);
      setActiveWorld({
        id: `job-${currentJob.id}`,
        name: currentJob.worldSpec.title,
        sceneUrl,
        type: guessWorldType(sceneUrl),
        source: 'generation_cache',
      });
    }
    setSceneTitle(currentJob.worldSpec.title);

    if (currentJob.mode === 'world') {
      // Solo escenario: se cambia el mundo y se conservan los objetos del usuario
      if (sceneUrl) {
        viewer.loadEnvironment(sceneUrl, undefined, false).catch(() => showNotice('Could not load the generated world.'));
      }
    } else {
      const assetUrlMap: Record<string, string> = {};
      currentJob.assets.forEach((a) => {
        if (a.modelUrl) {
          assetUrlMap[a.id] = a.modelUrl;
        }
      });
      viewer.applyWorldSpec(currentJob.worldSpec, sceneUrl, assetUrlMap);
    }

    if (sceneUrl) attachColliderFor(sceneUrl);
  }, [currentJob, isGenerating, attachColliderFor, showNotice]);

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
    const viewer = viewerRef.current;
    if (!viewer) return;

    if (
      world.sceneUrl !== activeWorldUrl &&
      objects.length > 0 &&
      !window.confirm(`Loading a new world removes the ${objects.length} object(s) in the scene. Continue?`)
    ) {
      return;
    }

    setActiveWorldUrl(world.sceneUrl);
    setActiveWorld(world);
    setSceneTitle(world.name);
    clearSelectionState();
    viewer.loadEnvironment(world.sceneUrl, world.type, true, world.colliderUrl).catch(() => {
      showNotice(`Could not load world “${world.name}”.`);
    });
  };

  const handleSpawnModel = (model: SavedModel) => {
    viewerRef.current?.spawnModel(model.modelUrl, model.name).catch(() => {
      showNotice(`Could not load model “${model.name}”.`);
    });
  };

  // Importar mapa del dispositivo: se sube a storage/worlds para que persista y pueda guardarse en escenas
  const importWorldFile = async (file: File) => {
    setMapStatus(`Importing ${file.name}...`);
    const uploaded = await uploadFile('world', file);
    const type = guessWorldType(file.name);

    if (uploaded.ok) {
      setRefreshToken((t) => t + 1);
      handleSelectWorld({
        id: `local-${uploaded.value.filename}`,
        name: uploaded.value.name,
        sceneUrl: uploaded.value.url,
        type,
        source: 'local_file',
      });
      showNotice(`Map “${uploaded.value.name}” imported and saved to storage/worlds.`);
    } else {
      // Sin servidor se carga solo en memoria (no se podrá incluir en escenas guardadas)
      handleSelectWorld({
        id: `blob-world-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        sceneUrl: `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`,
        type,
        source: 'local_file',
      });
      showNotice(`${uploaded.error} Loaded in memory only — it cannot be saved in scenes.`);
    }
    setMapStatus(null);
  };

  // Importar modelo del dispositivo: igual, persiste en storage/models
  const importModelFile = async (file: File) => {
    setMapStatus(`Importing ${file.name}...`);
    const uploaded = await uploadFile('model', file);

    if (uploaded.ok) {
      setRefreshToken((t) => t + 1);
      handleSpawnModel({
        id: `local-model-${uploaded.value.filename}`,
        name: uploaded.value.name,
        modelUrl: uploaded.value.url,
        source: 'local_file',
      });
      showNotice(`Model “${uploaded.value.name}” imported and saved to storage/models.`);
    } else {
      handleSpawnModel({
        id: `blob-model-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ''),
        modelUrl: `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`,
        source: 'local_file',
      });
      showNotice(`${uploaded.error} Loaded in memory only — it cannot be saved in scenes.`);
    }
    setMapStatus(null);
  };

  const onPickMapFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void importWorldFile(file);
    setIsImportMenuOpen(false);
    if (mapFileInputRef.current) mapFileInputRef.current.value = '';
  };

  const onPickModelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void importModelFile(file);
    setIsImportMenuOpen(false);
    if (modelFileInputRef.current) modelFileInputRef.current.value = '';
  };

  // --- Escenas guardadas ---

  const handleSaveScene = async (name: string): Promise<string | null> => {
    const viewer = viewerRef.current;
    if (!viewer) return 'The 3D viewer is not ready yet.';

    const { models, skipped } = viewer.serializeModels();
    const worldIsPersistent = !!activeWorld && !activeWorld.sceneUrl.startsWith('blob:');
    const scene: SceneFile = {
      format: SCENE_FILE_FORMAT,
      version: SCENE_FILE_VERSION,
      name,
      savedAt: new Date().toISOString(),
      world:
        worldIsPersistent && activeWorld
          ? {
              name: activeWorld.name,
              sceneUrl: activeWorld.sceneUrl,
              type: activeWorld.type,
              ...(activeWorld.colliderUrl ? { colliderUrl: activeWorld.colliderUrl } : {}),
            }
          : null,
      camera: viewer.getCameraPose(),
      floorOverride: viewer.getFloorOverride(),
      lighting: viewer.getLightingPreset(),
      models,
    };

    const res = await saveScene(scene);
    let error: string | null = null;
    if (res.ok) {
      setSceneTitle(name);
      const warnings: string[] = [];
      if (skipped > 0) warnings.push(`${skipped} object(s) without a persistent file were skipped`);
      if (activeWorld && !worldIsPersistent) warnings.push('the world was loaded in memory and was not saved');
      if (warnings.length > 0) showNotice(`Scene saved, but ${warnings.join(' and ')}.`);
    } else {
      error = res.error;
    }
    return error;
  };

  const handleLoadScene = async (id: string) => {
    const viewer = viewerRef.current;
    if (!viewer) return;

    setMapStatus('Loading scene...');
    const res = await loadScene(id);
    if (!res.ok) {
      setMapStatus(null);
      showNotice(res.error);
      return;
    }

    const scene = res.value;
    clearSelectionState();
    viewer.clearAssets();

    if (scene.world) {
      const world: SavedWorld = {
        id: `scene-world-${id}`,
        name: scene.world.name,
        sceneUrl: scene.world.sceneUrl,
        colliderUrl: scene.world.colliderUrl,
        type: scene.world.type,
        source: 'local_file',
      };
      setActiveWorld(world);
      setActiveWorldUrl(world.sceneUrl);
      try {
        await viewer.loadEnvironment(world.sceneUrl, world.type, true, world.colliderUrl);
      } catch {
        showNotice(`The world “${world.name}” could not be loaded; showing the default ground.`);
      }
    } else {
      viewer.clearEnvironment();
      setActiveWorld(null);
      setActiveWorldUrl(null);
    }

    const results = await Promise.allSettled(
      scene.models.map((m) =>
        viewer.spawnModel(m.modelUrl, m.name, m.position, {
          rotation: m.rotation,
          scale: m.scale,
          hidden: m.hidden,
          locked: m.locked,
          select: false,
        })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected').length;

    viewer.setFloorOverride(scene.floorOverride ?? null);
    if (scene.lighting) {
      viewer.setLightingPreset(scene.lighting);
      setLighting(scene.lighting);
    }
    if (scene.camera) viewer.setCameraPose(scene.camera);
    else viewer.resetCamera();
    viewer.clearHistory();

    setSceneTitle(scene.name);
    setMapStatus(null);
    showNotice(
      failed > 0
        ? `Scene “${scene.name}” loaded; ${failed} model(s) could not be loaded.`
        : `Scene “${scene.name}” loaded (${scene.models.length} model${scene.models.length === 1 ? '' : 's'}).`
    );
  };

  const cycleLighting = () => {
    const next = LIGHTING_CYCLE[(LIGHTING_CYCLE.indexOf(lighting) + 1) % LIGHTING_CYCLE.length];
    viewerRef.current?.setLightingPreset(next);
    setLighting(next);
  };

  const handleCapture = () => {
    const dataUrl = viewerRef.current?.captureScreenshot();
    if (!dataUrl) {
      showNotice('Could not capture the scene.');
      return;
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `wordsmith-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    link.click();
    showNotice('Screenshot saved to your downloads.');
  };

  const selectedAssetName = objects.find((o) => o.id === selectedAssetId)?.name;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Hidden inputs for local file loading */}
      <input
        ref={mapFileInputRef}
        type="file"
        accept=".spz,.ply,.splat,.glb,.gltf,.png,.jpg,.jpeg"
        onChange={onPickMapFile}
        className="hidden"
      />
      <input
        ref={modelFileInputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={onPickModelFile}
        className="hidden"
      />

      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {presentation ? (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900/70 backdrop-blur-md border border-slate-700/70 text-slate-300 px-4 py-1.5 rounded-full text-xs shadow-xl pointer-events-none flex items-center gap-2">
          <Presentation className="w-3.5 h-3.5 text-indigo-400" />
          <span>
            Presentation mode — press <b>H</b> or <b>Esc</b> to exit · drag to take control
          </span>
        </div>
      ) : (
        <>
          {/* Top Header */}
          <header className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between gap-3 pointer-events-none z-40">
            <div className="flex items-center gap-2.5 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 pointer-events-auto shadow-xl shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-pink-500 flex items-center justify-center text-white shadow-lg">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  Wordsmith{' '}
                  <span className="text-[10px] text-indigo-400 font-mono px-1.5 py-0.5 bg-indigo-950/60 rounded border border-indigo-800/50">
                    v0.4.0
                  </span>
                </h1>
                <p className="text-[11px] text-slate-400">AI-Native 3D World Director</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pointer-events-auto">
              {mapStatus && (
                <div className="bg-indigo-950/80 border border-indigo-700/60 px-3 py-1.5 rounded-xl text-xs text-indigo-200 backdrop-blur-md animate-pulse shadow-lg flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
                  {mapStatus}
                </div>
              )}

              {/* Scenes: save / load */}
              <SceneSelector
                defaultName={sceneTitle}
                onSave={handleSaveScene}
                onLoad={(id) => void handleLoadScene(id)}
              />

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
                onImportFile={(file) => void importWorldFile(file)}
                refreshToken={refreshToken}
              />

              {/* 3D Model Selector & Spawner (Tripo / GLB) */}
              <ModelSelector
                onSpawnModel={handleSpawnModel}
                onImportFile={(file) => void importModelFile(file)}
                refreshToken={refreshToken}
              />

              {/* JupiterSR Autostereoscopic 3D Panel */}
              <JupiterSRPanel viewer={viewerInstance} />

              <button
                onClick={cycleLighting}
                title={`Lighting: ${lighting} (click to change)`}
                className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-750 text-xs text-slate-300 transition-all shadow-lg active:scale-95"
              >
                {LIGHTING_ICONS[lighting]}
                <span className="hidden xl:inline capitalize">{lighting}</span>
              </button>

              <button
                onClick={handleCapture}
                title="Save a PNG screenshot of the scene"
                className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-750 text-xs text-slate-300 transition-all shadow-lg active:scale-95"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Capture</span>
              </button>

              <button
                onClick={togglePresentation}
                title="Presentation mode: hide the UI and orbit the camera (H)"
                className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-750 text-xs text-slate-300 transition-all shadow-lg active:scale-95"
              >
                <Presentation className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Present</span>
              </button>

              <button
                onClick={() => {
                  viewerRef.current?.resetCamera();
                }}
                title="Reset camera view"
                className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-750 text-xs text-slate-300 transition-all shadow-lg active:scale-95"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Reset View</span>
              </button>

              <button
                onClick={toggleHelp}
                title="Keyboard shortcuts (?)"
                className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 backdrop-blur-md px-2.5 py-2 rounded-xl border border-slate-750 text-xs text-slate-300 transition-all shadow-lg active:scale-95"
              >
                <Keyboard className="w-3.5 h-3.5" />
              </button>

              <div className="hidden 2xl:flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>World Labs + Tripo 3D</span>
              </div>
            </div>
          </header>

          {/* Navigation Hint */}
          <div className="absolute top-28 left-1/2 -translate-x-1/2 max-w-[60vw] bg-slate-900/85 border border-slate-800 text-slate-300 px-4 py-1.5 rounded-full text-xs backdrop-blur-md shadow-xl pointer-events-none z-10 flex items-center gap-2">
            <Navigation className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Drag to look · hold mouse + <b>WASD</b> fly · <b>W/E/R</b> gizmo · <b>F</b> focus · <b>H</b> present · <b>?</b> help
            </span>
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
              onModeChange={handleTransformMode}
              onSnapToGround={() => viewerRef.current?.snapSelectedToGround()}
              onDelete={() => viewerRef.current?.deleteSelectedAsset()}
              onClose={() => viewerRef.current?.deselectAsset()}
            />
          )}

          {/* Overlays */}
          {isGenerating && currentJob && <ProgressOverlay job={currentJob} />}
          <OutlinerPanel
            title={sceneTitle || (currentJob?.mode === 'objects' ? undefined : currentJob?.worldSpec?.title)}
            objects={objects}
            selectedId={selectedAssetId}
            position={selectedPosition}
            rotation={selectedRotation}
            scale={selectedScale}
            floor={floor}
            onSelect={(id) => viewerRef.current?.selectAsset(id)}
            onFocus={(id) => viewerRef.current?.focusAsset(id)}
            onRename={(id, name) => viewerRef.current?.renameAsset(id, name)}
            onToggleVisible={(id, visible) => viewerRef.current?.setAssetVisible(id, visible)}
            onToggleLocked={(id, locked) => viewerRef.current?.setAssetLocked(id, locked)}
            onDelete={(id) => viewerRef.current?.deleteAsset(id)}
            onDuplicate={() => viewerRef.current?.duplicateSelected()}
            onSnapToGround={() => viewerRef.current?.snapSelectedToGround()}
            onTransform={(patch) => selectedAssetId && viewerRef.current?.setAssetTransform(selectedAssetId, patch)}
            onSetFloorFromSelected={() => viewerRef.current?.setFloorFromSelected()}
            onFloorChange={(y) => viewerRef.current?.setFloorOverride(y)}
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
        </>
      )}

      {/* Notices */}
      {notice && (
        <div
          data-testid="notice"
          className="absolute top-40 left-1/2 -translate-x-1/2 max-w-[90vw] bg-slate-900/95 border border-indigo-500/40 text-slate-100 px-4 py-2 rounded-xl text-xs backdrop-blur-md shadow-2xl z-50"
          onClick={() => setNotice(null)}
        >
          {notice}
        </div>
      )}

      {helpOpen && <ShortcutsHelp onClose={closeHelp} />}
    </div>
  );
};
