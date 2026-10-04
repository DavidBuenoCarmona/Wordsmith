// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { GenerationJob } from '@wordsmith/shared';

interface ProgressOverlayProps {
  job: GenerationJob;
}

const PHASES = [
  { id: 'ANALYZING', label: '1. Prompt Analysis (LLM)' },
  { id: 'GENERATING_WORLD', label: '2. Environment (World Labs)' },
  { id: 'GENERATING_ASSETS', label: '3. 3D Models (Tripo)' },
  { id: 'COMPOSING', label: '4. Three.js Composition' },
];

export const ProgressOverlay: React.FC<ProgressOverlayProps> = ({ job }) => {
  const getPhaseStatus = (phaseId: string) => {
    const order = ['QUEUED', 'ANALYZING', 'GENERATING_WORLD', 'GENERATING_ASSETS', 'COMPOSING', 'COMPLETED'];
    const currentIndex = order.indexOf(job.phase);
    const targetIndex = order.indexOf(phaseId);

    if (job.phase === 'FAILED') return 'failed';
    if (currentIndex > targetIndex || job.phase === 'COMPLETED') return 'done';
    if (currentIndex === targetIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl space-y-3 z-20 animate-in fade-in zoom-in-95 duration-200">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          3D Generation Pipeline
        </span>
        <span className="text-xs font-bold text-slate-300">{job.progress}%</span>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-indigo-500 to-pink-500 h-2 transition-all duration-300 rounded-full"
          style={{ width: `${job.progress}%` }}
        />
      </div>

      <p className="text-xs text-slate-200 leading-relaxed">{job.message}</p>

      {/* Helper Note */}
      <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-800/60 p-2 rounded-xl border border-slate-750/70">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span>
          World Labs generates volumetric Gaussian Splatting (<span className="text-indigo-300 font-mono">.spz</span>). The scene will remain clear until the terrain and 3D assets are ready (~3 to 4 min).
        </span>
      </div>

      {/* Phase List */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
        {PHASES.map((p) => {
          const status = getPhaseStatus(p.id);
          return (
            <div key={p.id} className="flex items-center gap-2 text-[11px]">
              {status === 'done' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
              {status === 'active' && <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin shrink-0" />}
              {status === 'pending' && <div className="w-3.5 h-3.5 rounded-full border border-slate-600 shrink-0" />}
              {status === 'failed' && <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
              <span className={status === 'active' ? 'text-indigo-200 font-medium' : 'text-slate-400'}>
                {p.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
