// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { WorldViewer3D } from './viewer/WorldViewer3D.js';
import { useGenerationJob } from './hooks/useGenerationJob.js';
import { PromptBar } from './components/PromptBar.js';
import { ProgressOverlay } from './components/ProgressOverlay.js';
import { AssetInspector } from './components/AssetInspector.js';
import { WorldSelector, SavedWorld } from './components/WorldSelector.js';
import { ModelSelector, SavedModel } from './components/ModelSelector.js';
import { Compass, Sparkles, Navigation, RotateCcw } from 'lucide-react';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<WorldViewer3D | null>(null);
  const [mapStatus, setMapStatus] = useState<string | null>(null);
  const [activeWorldUrl, setActiveWorldUrl] = useState<string | null>(
    'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/5cc52299-dd1e-40dd-b325-4762fce22f4b_ceramic_500k.spz'
  );
  const { currentJob, isGenerating, error, startGeneration } = useGenerationJob();

  // Cargar escenario de referencia por defecto
  const loadReferencePlayground = () => {
    fetch('/api/storage/reference')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const sceneUrl =
          data?.environment?.sceneUrl ||
          'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/5cc52299-dd1e-40dd-b325-4762fce22f4b_ceramic_500k.spz';
        setActiveWorldUrl(sceneUrl);
        if (data?.worldSpec && viewerRef.current) {
          viewerRef.current.applyWorldSpec(data.worldSpec, sceneUrl);
        }
      })
      .catch(() => {
        const defaultUrl =
          'https://cdn.marble.worldlabs.ai/43956d0c-f28e-44d8-9832-df6f0133e97a/5cc52299-dd1e-40dd-b325-4762fce22f4b_ceramic_500k.spz';
        setActiveWorldUrl(defaultUrl);
        if (viewerRef.current) {
          viewerRef.current.loadEnvironment(defaultUrl);
        }
      });
  };

  useEffect(() => {
    if (containerRef.current && !viewerRef.current) {
      viewerRef.current = new WorldViewer3D(containerRef.current, {
        onProgress: (_pct, detail) => setMapStatus(detail),
        onLoaded: () => setMapStatus(null),
        onError: () => setMapStatus(null),
      });

      // Cargar mapa del parque por defecto al iniciar
      loadReferencePlayground();
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Actualizar escena 3D cuando se recibe el worldSpec completado o el environmentUrl
  useEffect(() => {
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
  }, [currentJob?.worldSpec, currentJob?.environment?.sceneUrl, currentJob?.assets]);

  const handleSelectWorld = (world: SavedWorld) => {
    setActiveWorldUrl(world.sceneUrl);
    if (viewerRef.current) {
      viewerRef.current.loadEnvironment(world.sceneUrl);
    }
  };

  const handleSpawnModel = (model: SavedModel) => {
    if (viewerRef.current) {
      viewerRef.current.spawnModel(model.modelUrl, model.name);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-10">
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

          {/* Selector de Mundos Guardados (.spz / .glb) */}
          <WorldSelector
            activeWorldUrl={activeWorldUrl}
            onSelectWorld={handleSelectWorld}
          />

          {/* Selector e Inserción de Modelos GLB / Tripo 3D */}
          <ModelSelector onSpawnModel={handleSpawnModel} />

          <button
            onClick={() => viewerRef.current?.resetCamera()}
            title="Resetear vista de cámara"
            className="flex items-center gap-1.5 bg-slate-900/80 hover:bg-slate-850 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-750 text-xs text-slate-300 transition-all shadow-lg active:scale-95"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset Vista</span>
          </button>

          <div className="hidden lg:flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 text-xs text-slate-300">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>World Labs + Tripo 3D</span>
          </div>
        </div>
      </header>

      {/* Navigation Hint (World Labs Developer Style) */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-900/85 border border-slate-800 text-slate-300 px-4 py-1.5 rounded-full text-xs backdrop-blur-md shadow-xl pointer-events-none z-10 flex items-center gap-2">
        <Navigation className="w-3.5 h-3.5 text-indigo-400" />
        <span>Arrastrá para mirar · <b>WASD</b> volar · <b>Shift</b> acelerar</span>
      </div>

      {/* Overlays */}
      {isGenerating && currentJob && <ProgressOverlay job={currentJob} />}
      <AssetInspector job={currentJob} />

      {/* Error Banner */}
      {error && (
        <div className="absolute top-28 left-1/2 -translate-x-1/2 bg-rose-950/80 border border-rose-500/50 text-rose-200 px-4 py-2 rounded-xl text-xs backdrop-blur-md shadow-2xl z-30">
          {error}
        </div>
      )}

      {/* Bottom Prompt Bar */}
      <footer className="absolute bottom-6 left-0 right-0 px-4 z-10">
        <PromptBar onGenerate={startGeneration} isGenerating={isGenerating} />
      </footer>
    </div>
  );
};
