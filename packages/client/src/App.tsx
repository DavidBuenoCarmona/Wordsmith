// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useEffect, useRef } from 'react';
import { WorldViewer3D } from './viewer/WorldViewer3D.js';
import { useGenerationJob } from './hooks/useGenerationJob.js';
import { PromptBar } from './components/PromptBar.js';
import { ProgressOverlay } from './components/ProgressOverlay.js';
import { AssetInspector } from './components/AssetInspector.js';
import { Compass, Sparkles } from 'lucide-react';

export const App: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<WorldViewer3D | null>(null);
  const { currentJob, isGenerating, error, startGeneration } = useGenerationJob();

  useEffect(() => {
    if (containerRef.current && !viewerRef.current) {
      viewerRef.current = new WorldViewer3D(containerRef.current);
    }

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  // Actualizar escena 3D cuando se recibe el worldSpec completado
  useEffect(() => {
    if (currentJob?.worldSpec && viewerRef.current) {
      viewerRef.current.applyWorldSpec(currentJob.worldSpec);
    }
  }, [currentJob?.worldSpec]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing" />

      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2.5 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 pointer-events-auto">
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

        <div className="hidden md:flex items-center gap-2 bg-slate-900/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800/80 text-xs text-slate-300 pointer-events-auto">
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>World Labs + Tripo 3D Orquestados</span>
        </div>
      </header>

      {/* Overlays */}
      {isGenerating && currentJob && <ProgressOverlay job={currentJob} />}
      <AssetInspector job={currentJob} />

      {/* Error Banner */}
      {error && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-rose-950/80 border border-rose-500/50 text-rose-200 px-4 py-2 rounded-xl text-xs backdrop-blur-md shadow-2xl z-30">
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
