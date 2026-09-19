// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import { Box, ChevronDown, Sparkles, Folder, RefreshCw, Plus, Check } from 'lucide-react';

export interface SavedModel {
  id: string;
  name: string;
  description?: string;
  prompt?: string;
  category?: string;
  modelUrl: string;
  source: 'local_file' | 'generation_cache' | 'reference';
  createdAt?: string;
}

interface ModelSelectorProps {
  onSpawnModel: (model: SavedModel) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ onSpawnModel }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [models, setModels] = useState<SavedModel[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchModels = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/storage/models');
      if (res.ok) {
        const data = await res.json();
        setModels(data.models || []);
      }
    } catch {
      // Ignorar error de red puntual
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
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

  const handleSpawn = (model: SavedModel) => {
    onSpawnModel(model);
    setLastAddedId(model.id);
    setTimeout(() => {
      setLastAddedId(null);
    }, 2000);
  };

  // Manejador para cargar archivo GLB local mediante explorador de archivos del navegador
  const handleLocalFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const customModel: SavedModel = {
      id: `blob-${Date.now()}`,
      name: file.name.replace(/\.[^/.]+$/, ''),
      description: `Archivo GLB cargado desde navegador (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      modelUrl: objectUrl,
      source: 'local_file',
    };

    onSpawnModel(customModel);
    setIsOpen(false);
    // Limpiar input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div ref={dropdownRef} className="relative z-30">
      {/* Input oculto para subir archivos GLB directos */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={handleLocalFileUpload}
        className="hidden"
      />

      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-slate-900/85 hover:bg-slate-850 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-750 text-xs text-white shadow-xl transition-all active:scale-95"
      >
        <Box className="w-3.5 h-3.5 text-pink-400" />
        <span className="font-medium">Modelos 3D (GLB)</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 sm:w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-750 rounded-2xl shadow-2xl p-2.5 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span>Modelos Disponibles ({models.length})</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Cargar archivo .glb desde tu equipo"
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-950/70 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-300 text-[10px] transition-colors"
              >
                <Plus className="w-3 h-3" />
                <span>Subir GLB</span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fetchModels();
                }}
                title="Actualizar lista de modelos"
                className="hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto mt-2 space-y-1.5 pr-1 custom-scrollbar">
            {models.length === 0 ? (
              <div className="py-6 px-4 text-center space-y-2">
                <Box className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-300 font-medium">No hay modelos GLB guardados aún</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Colocá tus archivos <code className="text-indigo-400 font-mono">.glb</code> de Tripo 3D en <code className="text-indigo-400 font-mono">storage/models/</code> o hacé clic en <b>Subir GLB</b>.
                </p>
              </div>
            ) : (
              models.map((m) => {
                const isJustAdded = lastAddedId === m.id;
                return (
                  <div
                    key={m.id}
                    className="p-2.5 rounded-xl transition-all flex items-start gap-2.5 bg-slate-850/60 hover:bg-slate-800/80 border border-slate-750/50 group"
                  >
                    <div className="mt-0.5">
                      {m.source === 'local_file' ? (
                        <Folder className="w-4 h-4 text-pink-400" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-amber-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold truncate text-slate-200">
                          {m.name}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase bg-pink-950/80 text-pink-400 border border-pink-800/60">
                          {m.source === 'local_file' ? 'Local GLB' : 'Tripo 3D'}
                        </span>
                      </div>
                      {m.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                          {m.description}
                        </p>
                      )}
                    </div>

                    <button
                      onClick={() => handleSpawn(m)}
                      title="Agregar al mundo en la posición actual"
                      className={`shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        isJustAdded
                          ? 'bg-emerald-600 text-white shadow-md scale-95'
                          : 'bg-indigo-600/90 hover:bg-indigo-600 text-white active:scale-95 shadow'
                      }`}
                    >
                      {isJustAdded ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>¡Agregado!</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-3.5 h-3.5" />
                          <span>Agregar</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-2 mt-1 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span>📁 storage/models/</span>
            <span className="text-pink-400 font-mono">Exportaciones Tripo (.glb)</span>
          </div>
        </div>
      )}
    </div>
  );
};
