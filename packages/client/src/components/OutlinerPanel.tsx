// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useMemo, useState } from 'react';
import {
  Layers,
  Box,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Crosshair,
  Trash2,
  Copy,
  ArrowDownToLine,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { SceneObjectInfo, FloorInfo, Vec3Like } from '../viewer/WorldViewer3D.js';
import { compareNames } from '../utils/sort.js';
import { NumberField } from './NumberField.js';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export interface OutlinerPanelProps {
  title?: string;
  objects: SceneObjectInfo[];
  selectedId: string | null;
  position?: Vec3Like;
  rotation?: Vec3Like;
  scale?: Vec3Like;
  floor: FloorInfo;
  onSelect: (id: string) => void;
  onFocus: (id?: string) => void;
  onRename: (id: string, name: string) => void;
  onToggleVisible: (id: string, visible: boolean) => void;
  onToggleLocked: (id: string, locked: boolean) => void;
  onDelete: (id: string) => void;
  onDuplicate: () => void;
  onSnapToGround: () => void;
  onTransform: (patch: { position?: Partial<Vec3Like>; rotation?: Partial<Vec3Like>; scale?: Partial<Vec3Like> }) => void;
  onSetFloorFromSelected: () => void;
  onFloorChange: (y: number | null) => void;
}

const AXES = ['x', 'y', 'z'] as const;

export const OutlinerPanel: React.FC<OutlinerPanelProps> = ({
  title,
  objects,
  selectedId,
  position,
  rotation,
  scale,
  floor,
  onSelect,
  onFocus,
  onRename,
  onToggleVisible,
  onToggleLocked,
  onDelete,
  onDuplicate,
  onSnapToGround,
  onTransform,
  onSetFloorFromSelected,
  onFloorChange,
}) => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState<string>('');

  const sorted = useMemo(() => [...objects].sort(compareNames), [objects]);
  const selected = objects.find((o) => o.id === selectedId);
  const locked = !!selected?.locked;

  const startRename = (obj: SceneObjectInfo) => {
    setRenamingId(obj.id);
    setRenameText(obj.name);
  };

  const finishRename = () => {
    if (renamingId) onRename(renamingId, renameText);
    setRenamingId(null);
  };

  const effectiveFloor = floor.override ?? floor.level;

  return (
    <div
      data-testid="outliner-panel"
      className="absolute right-4 top-28 w-80 max-h-[calc(100vh-13rem)] flex flex-col bg-slate-900/85 backdrop-blur-md border border-slate-800 rounded-2xl shadow-xl z-20 select-none"
    >
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 px-4 py-3 text-slate-200 border-b border-slate-800 text-left"
      >
        <Layers className="w-4 h-4 text-indigo-400 shrink-0" />
        <h3 className="text-sm font-semibold truncate flex-1">{title || 'Scene'}</h3>
        <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 rounded px-1.5 py-0.5">
          {objects.length}
        </span>
        {collapsed ? <ChevronRight className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {/* Object list */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Objects (A–Z)</span>
              <span className="text-[10px] text-slate-500">
                Click select · <b>F</b> focus · dbl-click rename
              </span>
            </div>

            {sorted.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-3 text-center">
                No objects yet. Add one from <b>3D Models</b>.
              </p>
            ) : (
              <div className="space-y-1 max-h-52 overflow-y-auto pr-1 custom-scrollbar">
                {sorted.map((obj) => {
                  const isSelected = obj.id === selectedId;
                  return (
                    <div
                      key={obj.id}
                      data-testid="outliner-row"
                      onClick={() => onSelect(obj.id)}
                      onDoubleClick={() => startRename(obj)}
                      className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500/80 ring-1 ring-indigo-500/40'
                          : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/30'
                      } ${obj.visible ? '' : 'opacity-50'}`}
                    >
                      <Box className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-indigo-300' : 'text-indigo-400'}`} />

                      {renamingId === obj.id ? (
                        <input
                          autoFocus
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onBlur={finishRename}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') finishRename();
                            if (e.key === 'Escape') setRenamingId(null);
                          }}
                          className="flex-1 min-w-0 bg-slate-950 border border-indigo-500/70 rounded px-1 py-0.5 text-xs text-slate-100 outline-none"
                        />
                      ) : (
                        <span className={`flex-1 truncate ${isSelected ? 'text-indigo-100 font-semibold' : 'text-slate-200'}`}>
                          {obj.name}
                        </span>
                      )}

                      <button
                        title="Focus camera on this object (F)"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelect(obj.id);
                          onFocus(obj.id);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/70"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                      </button>
                      <button
                        title={obj.visible ? 'Hide' : 'Show'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleVisible(obj.id, !obj.visible);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/70"
                      >
                        {obj.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        title={obj.locked ? 'Unlock' : 'Lock (cannot be moved or clicked)'}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleLocked(obj.id, !obj.locked);
                        }}
                        className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/70"
                      >
                        {obj.locked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        title="Delete (Del)"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(obj.id);
                        }}
                        className="p-1 rounded text-slate-500 hover:text-rose-300 hover:bg-rose-950/60"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Inspector */}
          {selected && (
            <div data-testid="inspector" className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold truncate">
                  {selected.name}
                </span>
                {locked && <span className="text-[10px] text-amber-400 font-mono">LOCKED</span>}
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold">Position (m)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {AXES.map((axis) => (
                    <NumberField
                      key={`p${axis}`}
                      testId={`pos-${axis}`}
                      label={axis.toUpperCase()}
                      value={position?.[axis]}
                      disabled={locked}
                      onCommit={(v) => onTransform({ position: { [axis]: v } })}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold">Rotation (°)</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {AXES.map((axis) => (
                    <NumberField
                      key={`r${axis}`}
                      testId={`rot-${axis}`}
                      label={axis.toUpperCase()}
                      decimals={1}
                      step={5}
                      value={rotation ? rotation[axis] * RAD_TO_DEG : undefined}
                      disabled={locked}
                      onCommit={(v) => onTransform({ rotation: { [axis]: v * DEG_TO_RAD } })}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-semibold">Scale</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {AXES.map((axis) => (
                    <NumberField
                      key={`s${axis}`}
                      testId={`scale-${axis}`}
                      label={axis.toUpperCase()}
                      step={0.1}
                      value={scale?.[axis]}
                      disabled={locked}
                      onCommit={(v) => onTransform({ scale: { [axis]: v } })}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <button
                  onClick={() => onFocus(selected.id)}
                  className="flex-1 flex items-center justify-center gap-1 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-[11px] px-2 py-1.5 rounded-lg border border-slate-700 transition-colors"
                  title="Center the camera on this object (F)"
                >
                  <Crosshair className="w-3.5 h-3.5 text-indigo-400" /> Focus
                </button>
                <button
                  onClick={onSnapToGround}
                  disabled={locked}
                  className="flex-1 flex items-center justify-center gap-1 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-[11px] px-2 py-1.5 rounded-lg border border-slate-700 transition-colors disabled:opacity-40"
                  title="Drop the base of the object onto the floor"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5 text-indigo-400" /> Floor
                </button>
                <button
                  onClick={onDuplicate}
                  className="flex-1 flex items-center justify-center gap-1 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-[11px] px-2 py-1.5 rounded-lg border border-slate-700 transition-colors"
                  title="Duplicate (Ctrl+D)"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-400" /> Copy
                </button>
              </div>
            </div>
          )}

          {/* Floor calibration */}
          <div data-testid="floor-calibration" className="space-y-1.5 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold">Floor level</span>
              <span className={`text-[10px] font-mono ${floor.override === null ? 'text-emerald-400' : 'text-amber-400'}`}>
                {floor.override === null ? 'AUTO' : 'MANUAL'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-24">
                <NumberField
                  testId="floor-y"
                  label="Y"
                  value={effectiveFloor}
                  onCommit={(v) => onFloorChange(v)}
                />
              </div>
              <button
                onClick={onSetFloorFromSelected}
                disabled={!selected}
                title="Use the base of the selected object as the floor"
                className="flex-1 bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-[10px] px-2 py-1.5 rounded-lg border border-slate-700 transition-colors disabled:opacity-40"
              >
                From selected
              </button>
              <button
                onClick={() => onFloorChange(null)}
                disabled={floor.override === null}
                title="Back to automatic floor detection"
                className="bg-slate-800/80 hover:bg-slate-750 text-slate-200 text-[10px] px-2 py-1.5 rounded-lg border border-slate-700 transition-colors disabled:opacity-40"
              >
                Auto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
