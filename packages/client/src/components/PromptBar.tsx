// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useState } from 'react';
import { Sparkles, Compass } from 'lucide-react';
import { WorldPromptInput } from '@wordsmith/shared';

interface PromptBarProps {
  onGenerate: (input: WorldPromptInput) => void;
  isGenerating: boolean;
}

const PRESET_PROMPTS = [
  'Isla pirata abandonada con galeón hundido y cofre de oro',
  'Estación espacial cyberpunk con androide y módulo de energía',
  'Bosque místico con cristales flotantes y monolito antiguo',
];

export const PromptBar: React.FC<PromptBarProps> = ({ onGenerate, isGenerating }) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'stylized' | 'realistic' | 'fantasy'>('stylized');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length >= 5 && !isGenerating) {
      onGenerate({
        prompt: prompt.trim(),
        style,
        maxAssets: 3,
      });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl"
      >
        <div className="pl-3 text-indigo-400">
          <Compass className="w-6 h-6 animate-pulse" />
        </div>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe el mundo 3D que querés crear (ej: Isla pirata con tesoro)..."
          disabled={isGenerating}
          className="flex-1 bg-transparent px-3 py-2 text-sm md:text-base text-slate-100 placeholder-slate-400 focus:outline-none disabled:opacity-50"
        />
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as any)}
          disabled={isGenerating}
          className="bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-xl border border-slate-700 focus:outline-none"
        >
          <option value="stylized">Estilizado</option>
          <option value="fantasy">Fantasía</option>
          <option value="realistic">Realista</option>
        </select>
        <button
          type="submit"
          disabled={prompt.trim().length < 5 || isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-sm rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isGenerating ? 'Generando...' : 'Generar'}</span>
        </button>
      </form>

      {/* Sugerencias rápidas */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
        <span>Ideas rápidas:</span>
        {PRESET_PROMPTS.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setPrompt(p)}
            disabled={isGenerating}
            className="px-2.5 py-1 bg-slate-800/60 hover:bg-slate-700/80 text-slate-300 rounded-lg border border-slate-700/40 transition-colors disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
};
