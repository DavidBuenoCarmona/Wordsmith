// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React from 'react';
import { Layers, Box, Check, Loader2, AlertCircle } from 'lucide-react';
import { GenerationJob } from '@wordsmith/shared';

interface AssetInspectorProps {
  job: GenerationJob | null;
  selectedAssetId?: string | null;
  onSelectAsset?: (assetId: string) => void;
}

export const AssetInspector: React.FC<AssetInspectorProps> = ({
  job,
  selectedAssetId,
  onSelectAsset,
}) => {
  if (!job || !job.worldSpec) return null;

  return (
    <div className="absolute right-4 top-20 w-80 bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-2xl p-4 shadow-xl z-20 space-y-4">
      <div className="flex items-center gap-2 text-slate-200 border-b border-slate-800 pb-2">
        <Layers className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold truncate">{job.worldSpec.title}</h3>
      </div>

      {/* Environment */}
      <div className="space-y-1">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Base Environment</span>
        <div className="p-2.5 bg-slate-800/60 rounded-xl border border-slate-700/40 text-xs space-y-1">
          <p className="font-medium text-slate-200">{job.worldSpec.environment.theme}</p>
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Lighting: {job.worldSpec.environment.lighting}</span>
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <Check className="w-3 h-3" /> Ready
            </span>
          </div>
        </div>
      </div>

      {/* 3D Assets */}
      <div className="space-y-1.5">
        <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">
          Props & Assets ({job.worldSpec.assets.length})
        </span>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {job.worldSpec.assets.map((asset) => {
            const state = job.assets?.find((a) => a.id === asset.id);
            const isSelected = selectedAssetId === asset.id;

            return (
              <div
                key={asset.id}
                onClick={() => onSelectAsset?.(asset.id)}
                className={`p-2.5 rounded-xl border text-xs transition-all cursor-pointer space-y-1 ${
                  isSelected
                    ? 'bg-indigo-950/60 border-indigo-500/80 ring-1 ring-indigo-500/50 shadow-md shadow-indigo-950/50'
                    : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium flex items-center gap-1.5 ${isSelected ? 'text-indigo-200 font-semibold' : 'text-slate-200'}`}>
                    <Box className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-300' : 'text-indigo-400'}`} />
                    {asset.name}
                  </span>
                  {state?.status === 'READY' && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                  {state?.status === 'GENERATING' && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />}
                  {state?.status === 'FAILED' && <AlertCircle className="w-3.5 h-3.5 text-rose-400" />}
                </div>
                <p className="text-[11px] text-slate-400 truncate">{asset.prompt}</p>
                <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                  <span>Pos: [{asset.position.x.toFixed(1)}, {asset.position.y.toFixed(1)}, {asset.position.z.toFixed(1)}]</span>
                  <span>Cat: {asset.category}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
