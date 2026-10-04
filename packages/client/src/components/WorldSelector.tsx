// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Globe, ChevronDown, Check, Sparkles, Folder, RefreshCw, FolderOpen } from 'lucide-react';

export interface SavedWorld {
  id: string;
  name: string;
  description?: string;
  theme?: string;
  sceneUrl: string;
  previewUrl?: string;
  type: 'spz' | 'ply' | 'glb' | 'pano';
  source: 'local_file' | 'generation_cache' | 'reference';
}

interface WorldSelectorProps {
  activeWorldUrl: string | null;
  onSelectWorld: (world: SavedWorld) => void;
}

export const WorldSelector: React.FC<WorldSelectorProps> = ({
  activeWorldUrl,
  onSelectWorld,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [worlds, setWorlds] = useState<SavedWorld[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchWorlds = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/storage/worlds');
      if (res.ok) {
        const data = await res.json();
        setWorlds(data.worlds || []);
      }
    } catch {
      // Ignorar error de red puntual
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorlds();
  }, []);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Manejador para abrir archivo de mapa local (.spz, .ply, .glb, .png, .jpg) sin persistir en servidor
  const handleLocalWorldUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    const objectUrl = `${URL.createObjectURL(file)}#${encodeURIComponent(file.name)}`;
    const type: SavedWorld['type'] =
      ext === 'glb' || ext === 'gltf'
        ? 'glb'
        : ext === 'png' || ext === 'jpg' || ext === 'jpeg'
        ? 'pano'
        : ext === 'ply'
        ? 'ply'
        : 'spz';

    const customWorld: SavedWorld = {
      id: `blob-world-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ''),
      description: `${ext?.toUpperCase()} file opened in browser (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      sceneUrl: objectUrl,
      type,
      source: 'local_file',
    };

    onSelectWorld(customWorld);
    setIsOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeWorld = activeWorldUrl ? worlds.find((w) => w.sceneUrl === activeWorldUrl) : null;

  return (
    <div ref={dropdownRef} className="relative z-30">
      {/* Hidden input for local maps */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".spz,.ply,.splat,.glb,.gltf,.png,.jpg,.jpeg"
        onChange={handleLocalWorldUpload}
        className="hidden"
      />

      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-900/85 hover:bg-slate-850 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-750 text-xs text-white shadow-xl transition-all active:scale-95"
      >
        <Globe className="w-3.5 h-3.5 text-indigo-400" />
        <span className="font-medium max-w-[150px] sm:max-w-[200px] truncate">
          {activeWorld?.name || 'Select Map'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-750 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Worlds ({worlds.length})</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Open map from your device (.spz, .ply, .glb)"
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-300 text-[10px] transition-colors"
              >
                <FolderOpen className="w-3 h-3" />
                <span>Open Map</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchWorlds();
                }}
                title="Refresh worlds list"
                className="hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto mt-1 space-y-1 pr-1 custom-scrollbar">
            {worlds.map((w) => {
              const isSelected = w.sceneUrl === activeWorldUrl;
              return (
                <button
                  key={w.id}
                  onClick={() => {
                    onSelectWorld(w);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 ${
                    isSelected
                      ? 'bg-indigo-950/70 border border-indigo-500/40 text-white'
                      : 'hover:bg-slate-800/80 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="mt-0.5">
                    {w.source === 'local_file' ? (
                      <Folder className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-amber-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-semibold truncate text-slate-200">
                        {w.name}
                      </span>
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-mono uppercase ${
                          w.type === 'spz'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                            : 'bg-indigo-950/80 text-indigo-400 border border-indigo-800/60'
                        }`}
                      >
                        {w.type}
                      </span>
                    </div>
                    {w.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {w.description}
                      </p>
                    )}
                  </div>

                  {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>

          <div className="p-2 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span>📁 storage/worlds/</span>
            <span className="text-indigo-400 font-mono">Supports .spz, .ply and .glb</span>
          </div>
        </div>
      )}
    </div>
  );
};
