// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React from 'react';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GenerationJob } from '@wordsmith/shared';

interface ProgressOverlayProps {
  job: GenerationJob;
}

const PHASES = [
  { id: 'ANALYZING', label: '1. Análisis Prompt (LLM)' },
  { id: 'GENERATING_WORLD', label: '2. Entorno (World Labs)' },
  { id: 'GENERATING_ASSETS', label: '3. Modelos 3D (Tripo)' },
  { id: 'COMPOSING', label: '4. Composición Three.js' },
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
    <div className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-md bg-slate-900/90 backdrop-blur-lg border border-slate-700/80 rounded-2xl p-4 shadow-2xl space-y-3 z-20">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
          Pipeline de Generación 3D
        </span>
        <span className="text-xs font-bold text-slate-300">{job.progress}%</span>
      </div>

      {/* Barra de progreso */}
      <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
        <div
          className="bg-gradient-to-r from-indigo-500 to-pink-500 h-2 transition-all duration-300 rounded-full"
          style={{ width: `${job.progress}%` }}
        />
      </div>

      <p className="text-xs text-slate-300 truncate">{job.message}</p>

      {/* Lista de Fases */}
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
