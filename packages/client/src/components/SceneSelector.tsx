// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Clapperboard, ChevronDown, Save, FolderOpen, Trash2, RefreshCw } from 'lucide-react';
import type { SceneSummary } from '@wordsmith/shared';
import { listScenes, deleteScene } from '../api/storage.js';

interface SceneSelectorProps {
  /** Nombre sugerido al guardar (última escena o mundo activo). */
  defaultName: string;
  /** Guarda la escena actual; devuelve un mensaje de error o null si todo fue bien. */
  onSave: (name: string) => Promise<string | null>;
  onLoad: (id: string) => void;
}

export const SceneSelector: React.FC<SceneSelectorProps> = ({ defaultName, onSave, onLoad }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [scenes, setScenes] = useState<SceneSummary[]>([]);
  const [name, setName] = useState<string>(defaultName);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const res = await listScenes();
    if (res.ok) setScenes(res.value);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isOpen) refresh();
  }, [isOpen, refresh]);

  useEffect(() => {
    setName(defaultName);
  }, [defaultName]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setFeedback({ kind: 'error', text: 'Enter a name for the scene.' });
      return;
    }
    const error = await onSave(trimmed);
    if (error) {
      setFeedback({ kind: 'error', text: error });
    } else {
      setFeedback({ kind: 'ok', text: `Saved “${trimmed}”` });
      refresh();
    }
  };

  const handleDelete = async (scene: SceneSummary) => {
    if (!window.confirm(`Delete scene “${scene.name}”?`)) return;
    const res = await deleteScene(scene.id);
    setFeedback(res.ok ? { kind: 'ok', text: `Deleted “${scene.name}”` } : { kind: 'error', text: res.error });
    refresh();
  };

  return (
    <div ref={dropdownRef} className="relative z-30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Save and load scenes (world + models + positions)"
        className="flex items-center gap-2 bg-emerald-950/80 hover:bg-emerald-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-emerald-700/60 text-xs text-white shadow-xl transition-all active:scale-95"
      >
        <Clapperboard className="w-3.5 h-3.5 text-emerald-400" />
        <span className="font-medium">Scenes</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-750 rounded-2xl shadow-2xl p-2.5 space-y-2">
          <div className="flex items-center gap-1.5">
            <input
              data-testid="scene-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              maxLength={80}
              placeholder="Scene name"
              className="flex-1 min-w-0 bg-slate-950/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:border-emerald-500/70"
            />
            <button
              data-testid="scene-save"
              onClick={handleSave}
              className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium px-2.5 py-1.5 rounded-lg active:scale-95 transition-all"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
          </div>

          {feedback && (
            <p className={`text-[11px] px-1 ${feedback.kind === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
              {feedback.text}
            </p>
          )}

          <div className="flex items-center justify-between px-1 pt-1 border-t border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Saved scenes ({scenes.length})</span>
            <button onClick={refresh} title="Refresh" className="p-1 rounded hover:bg-slate-800 hover:text-white">
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
            {scenes.length === 0 ? (
              <p className="text-[11px] text-slate-500 text-center py-4">
                No scenes yet. Compose a world and press <b>Save</b>.
              </p>
            ) : (
              scenes.map((scene) => (
                <div
                  key={scene.id}
                  data-testid="scene-row"
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-200 truncate">{scene.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {scene.worldName ?? 'Default ground'} · {scene.modelCount} model{scene.modelCount === 1 ? '' : 's'}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      onLoad(scene.id);
                      setIsOpen(false);
                    }}
                    className="flex items-center gap-1 bg-indigo-600/90 hover:bg-indigo-600 text-white text-[11px] font-medium px-2 py-1 rounded-lg active:scale-95 transition-all"
                  >
                    <FolderOpen className="w-3 h-3" /> Load
                  </button>
                  <button
                    onClick={() => handleDelete(scene)}
                    title="Delete scene"
                    className="p-1 rounded text-slate-500 hover:text-rose-300 hover:bg-rose-950/60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <p className="text-[10px] text-slate-500 px-1">📁 storage/scenes/*.json — a plain JSON file</p>
        </div>
      )}
    </div>
  );
};
