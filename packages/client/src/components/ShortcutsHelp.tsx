// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface ShortcutsHelpProps {
  onClose: () => void;
}

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: 'Camera',
    items: [
      ['Drag', 'Look around'],
      ['Hold mouse + W A S D', 'Fly (also with no selection)'],
      ['Hold mouse + Q / E', 'Down / up'],
      ['Shift', 'Speed boost'],
      ['F', 'Focus selected (or frame everything)'],
      ['H', 'Presentation mode (hide UI + auto-orbit)'],
    ],
  },
  {
    title: 'Selected object (Unreal-style)',
    items: [
      ['W', 'Move gizmo'],
      ['E', 'Rotate gizmo'],
      ['R', 'Scale gizmo'],
      ['Ctrl + D', 'Duplicate'],
      ['Del / Backspace', 'Delete'],
      ['Esc', 'Deselect / exit presentation'],
    ],
  },
  {
    title: 'Editing',
    items: [
      ['Ctrl + Z', 'Undo'],
      ['Ctrl + Y / Ctrl + Shift + Z', 'Redo'],
      ['?', 'Show / hide this help'],
    ],
  },
];

export const ShortcutsHelp: React.FC<ShortcutsHelpProps> = ({ onClose }) => (
  <div
    data-testid="shortcuts-help"
    className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="w-[min(34rem,92vw)] bg-slate-900/95 border border-slate-700 rounded-2xl shadow-2xl p-5 space-y-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 text-slate-100">
        <Keyboard className="w-4 h-4 text-indigo-400" />
        <h2 className="text-sm font-semibold flex-1">Keyboard shortcuts</h2>
        <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
          <X className="w-4 h-4" />
        </button>
      </div>

      {GROUPS.map((group) => (
        <div key={group.title} className="space-y-1.5">
          <h3 className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">{group.title}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
            {group.items.map(([keys, action]) => (
              <div key={keys} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-300">{action}</span>
                <kbd className="font-mono text-[10px] text-indigo-200 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 whitespace-nowrap">
                  {keys}
                </kbd>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);
