// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useState } from 'react';
import { Sparkles, Compass, Globe, Box, Layers } from 'lucide-react';
import { WorldPromptInput, GenerationMode } from '@wordsmith/shared';

interface PromptBarProps {
  onGenerate: (input: WorldPromptInput) => void;
  isGenerating: boolean;
}

interface ModeOption {
  id: GenerationMode;
  label: string;
  hint: string;
  placeholder: string;
  icon: React.ReactNode;
  presets: string[];
}

const MODES: ModeOption[] = [
  {
    id: 'all',
    label: 'Everything',
    hint: 'AI builds the world and its objects',
    placeholder: 'Describe the 3D world you want to build (e.g. Pirate island with treasure)...',
    icon: <Layers className="w-3.5 h-3.5" />,
    presets: [
      'Abandoned pirate island with sunken galleon and treasure chest',
      'Cyberpunk space station with android worker and power core',
      'Mystic forest with floating crystals and ancient stone monolith',
    ],
  },
  {
    id: 'world',
    label: 'Scenery only',
    hint: 'Generates only the world (World Labs); keeps your objects',
    placeholder: 'Describe only the environment (e.g. Tropical beach at sunset with palm trees)...',
    icon: <Globe className="w-3.5 h-3.5" />,
    presets: [
      'Tropical pirate beach at sunset with calm turquoise water',
      'Foggy ancient forest with giant mossy trees',
      'Futuristic desert canyon under two moons',
    ],
  },
  {
    id: 'objects',
    label: 'Objects only',
    hint: 'Generates 3D models (Tripo) and adds them to your current scene',
    placeholder: 'Describe the objects to add to your scene (e.g. 5 different pirates with swords)...',
    icon: <Box className="w-3.5 h-3.5" />,
    presets: [
      '5 different pirates with swords and parrots',
      'Wooden barrels, crates and a treasure chest',
      'Three palm trees of different sizes',
    ],
  },
];

export const PromptBar: React.FC<PromptBarProps> = ({ onGenerate, isGenerating }) => {
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState<'stylized' | 'realistic' | 'fantasy'>('stylized');
  const [mode, setMode] = useState<GenerationMode>('all');
  const [count, setCount] = useState<number>(3);

  const current = MODES.find((m) => m.id === mode) ?? MODES[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length >= 5 && !isGenerating) {
      onGenerate({
        prompt: prompt.trim(),
        style,
        mode,
        maxAssets: count,
      });
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      {/* Mode selector: what should the AI generate? */}
      <div className="flex items-center justify-center gap-2">
        <div
          data-testid="mode-selector"
          role="radiogroup"
          aria-label="What should the AI generate?"
          className="flex items-center gap-1 p-1 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-xl shadow-lg"
        >
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={mode === m.id}
              data-testid={`mode-${m.id}`}
              title={m.hint}
              disabled={isGenerating}
              onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50 ${
                mode === m.id
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
              }`}
            >
              {m.icon}
              <span>{m.label}</span>
            </button>
          ))}
        </div>
        <span className="hidden md:inline text-[11px] text-slate-400">{current.hint}</span>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-2 bg-slate-900/80 backdrop-blur-md border border-slate-700/60 rounded-2xl shadow-2xl"
      >
        <div className="pl-3 text-indigo-400">
          <Compass className="w-6 h-6 animate-pulse" />
        </div>
        <input
          type="text"
          data-testid="prompt-input"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          placeholder={current.placeholder}
          disabled={isGenerating}
          className="flex-1 bg-transparent px-3 py-2 text-sm md:text-base text-slate-100 placeholder-slate-400 focus:outline-none disabled:opacity-50"
        />
        {mode !== 'world' && (
          <select
            data-testid="count-select"
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            disabled={isGenerating}
            title="How many objects to generate (each one costs Tripo credits)"
            className="bg-slate-800 text-xs text-slate-300 px-2.5 py-2 rounded-xl border border-slate-700 focus:outline-none"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? 'object' : 'objects'}
              </option>
            ))}
          </select>
        )}
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value as 'stylized' | 'realistic' | 'fantasy')}
          disabled={isGenerating}
          className="bg-slate-800 text-xs text-slate-300 px-3 py-2 rounded-xl border border-slate-700 focus:outline-none"
        >
          <option value="stylized">Stylized</option>
          <option value="fantasy">Fantasy</option>
          <option value="realistic">Realistic</option>
        </select>
        <button
          type="submit"
          data-testid="generate-button"
          disabled={prompt.trim().length < 5 || isGenerating}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium text-sm rounded-xl transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Sparkles className="w-4 h-4" />
          <span>{isGenerating ? 'Generating...' : mode === 'objects' ? 'Add objects' : 'Generate'}</span>
        </button>
      </form>

      {/* Quick suggestions */}
      <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-400">
        <span>Quick ideas:</span>
        {current.presets.map((p, i) => (
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
