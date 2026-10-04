// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React from 'react';
import { Move, RotateCw, Maximize2, ArrowDownToLine, Trash2, X, Box } from 'lucide-react';

export interface TransformToolbarProps {
  selectedAssetId: string;
  selectedAssetName?: string;
  mode: 'translate' | 'rotate' | 'scale';
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  onModeChange: (mode: 'translate' | 'rotate' | 'scale') => void;
  onSnapToGround: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export const TransformToolbar: React.FC<TransformToolbarProps> = ({
  selectedAssetId,
  selectedAssetName,
  mode,
  position,
  rotation,
  scale,
  onModeChange,
  onSnapToGround,
  onDelete,
  onClose,
}) => {
  const formatCoord = (val?: number) => (typeof val === 'number' ? val.toFixed(2) : '0.00');

  return (
    <div
      data-testid="transform-toolbar"
      className="absolute bottom-28 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 bg-slate-900/90 backdrop-blur-md border border-slate-750 px-4 py-2.5 rounded-2xl shadow-2xl text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-150"
    >
      {/* Asset Identifier Badge */}
      <div className="flex items-center gap-1.5 pr-2 border-r border-slate-750 max-w-[140px]">
        <Box className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="font-semibold text-slate-100 truncate text-[11px]" title={selectedAssetName || selectedAssetId}>
          {selectedAssetName || 'Selected Asset'}
        </span>
      </div>

      {/* Mode Switches */}
      <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800">
        <button
          onClick={() => onModeChange('translate')}
          title="Translate / Move Mode (Key M)"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
            mode === 'translate'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Move className="w-3.5 h-3.5" />
          <span>Move</span>
          <span className="text-[10px] opacity-75 font-mono ml-0.5 px-1 py-0.2 bg-black/30 rounded">M</span>
        </button>

        <button
          onClick={() => onModeChange('rotate')}
          title="Rotate Mode (Key R)"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
            mode === 'rotate'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Rotate</span>
          <span className="text-[10px] opacity-75 font-mono ml-0.5 px-1 py-0.2 bg-black/30 rounded">R</span>
        </button>

        <button
          onClick={() => onModeChange('scale')}
          title="Scale Mode (Key C)"
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium transition-all ${
            mode === 'scale'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Scale</span>
          <span className="text-[10px] opacity-75 font-mono ml-0.5 px-1 py-0.2 bg-black/30 rounded">C</span>
        </button>
      </div>

      {/* Coordinates / Rotation / Scale Readout */}
      {(position || rotation || scale) && (
        <div className="hidden sm:flex items-center gap-2 px-2 text-[10px] font-mono text-slate-400 border-x border-slate-750">
          {mode === 'translate' && position && (
            <>
              <div>
                <span className="text-slate-500 font-bold">X: </span>
                <span className="text-slate-300">{formatCoord(position.x)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Y: </span>
                <span className="text-slate-300">{formatCoord(position.y)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">Z: </span>
                <span className="text-slate-300">{formatCoord(position.z)}</span>
              </div>
            </>
          )}
          {mode === 'rotate' && rotation && (
            <>
              <div>
                <span className="text-slate-500 font-bold">RX: </span>
                <span className="text-slate-300">{formatCoord(rotation.x)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">RY: </span>
                <span className="text-slate-300">{formatCoord(rotation.y)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">RZ: </span>
                <span className="text-slate-300">{formatCoord(rotation.z)}</span>
              </div>
            </>
          )}
          {mode === 'scale' && scale && (
            <>
              <div>
                <span className="text-slate-500 font-bold">SX: </span>
                <span className="text-slate-300">{formatCoord(scale.x)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">SY: </span>
                <span className="text-slate-300">{formatCoord(scale.y)}</span>
              </div>
              <div>
                <span className="text-slate-500 font-bold">SZ: </span>
                <span className="text-slate-300">{formatCoord(scale.z)}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onSnapToGround}
          title="Snap model base to ground terrain"
          className="flex items-center gap-1 bg-slate-800/80 hover:bg-slate-750 active:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-xl border border-slate-700 transition-colors"
        >
          <ArrowDownToLine className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden md:inline">Ground</span>
        </button>

        <button
          onClick={onDelete}
          title="Delete selected asset (Delete / Backspace key)"
          className="flex items-center gap-1 bg-rose-950/60 hover:bg-rose-900/80 active:bg-rose-800 text-rose-300 px-2.5 py-1.5 rounded-xl border border-rose-800/50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          <span className="hidden md:inline">Delete</span>
        </button>

        <button
          onClick={onClose}
          title="Deselect asset (Escape key)"
          className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
