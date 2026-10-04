// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  Sliders,
  Eye,
  Layers,
  Download,
  Upload,
  RotateCcw,
  X,
  Sparkles,
  Maximize2,
} from 'lucide-react';
import { type Profile, type Calibration, type RenderOptions } from 'jupiter-interlace-sdk';
import { WorldViewer3D } from '../viewer/WorldViewer3D.js';

const STORAGE_KEY = 'wordsmith_jupiter_profile';

const DEFAULT_PROFILE: Profile = {
  schemaVersion: 1,
  algorithm: 'jupiter-30-v1',
  calibration: {
    pitch: 0.27777,
    tan: 10,
    offset: 2,
    order: 'forward',
    subpixelOrder: 'RGB',
    rotation: 0,
  },
  render: {
    views: 9,
    viewWidth: 640,
    viewSpacing: 0.006,
    focusDistance: 3,
    mode: '2d',
    previewView: 14,
    toneMapping: 'aces',
    exposure: 1,
  },
};

interface JupiterSRPanelProps {
  viewer: WorldViewer3D | null;
}

export const JupiterSRPanel: React.FC<JupiterSRPanelProps> = ({ viewer }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [profile, setProfile] = useState<Profile>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          return JSON.parse(saved) as Profile;
        } catch {
          // ignore error
        }
      }
    }
    return DEFAULT_PROFILE;
  });

  const [activeTab, setActiveTab] = useState<'render' | 'calibration'>('render');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Sincronizar con el visor cuando se inicialice o cambie
  useEffect(() => {
    if (!viewer) return;

    // Cargar perfil guardado inicialmente si existe
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        viewer.importInterlaceProfile(saved);
      } catch (err) {
        console.warn('⚠️ Error al cargar perfil guardado de Jupiter:', err);
      }
    }

    // Suscribirse a cambios en el perfil del viewer
    const unsubscribe = viewer.subscribeInterlaceProfile((updatedProfile) => {
      setProfile(updatedProfile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProfile));
    });

    const current = viewer.getInterlaceProfile();
    if (current) {
      setProfile(current);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [viewer]);

  const handleModeChange = (mode: '2d' | 'interlaced' | 'view') => {
    if (!viewer) return;
    viewer.setInterlaceMode(mode);
    const updated = { ...profile, render: { ...profile.render, mode } };
    setProfile(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleRenderOptionChange = <K extends keyof RenderOptions>(key: K, value: RenderOptions[K]) => {
    if (!viewer) return;
    viewer.setInterlaceOptions({ [key]: value });
  };

  const handleCalibrationChange = <K extends keyof Calibration>(key: K, value: Calibration[K]) => {
    if (!viewer) return;
    viewer.setInterlaceCalibration({ [key]: value });
  };

  const handleExportProfile = () => {
    if (!viewer) return;
    const jsonStr = viewer.exportInterlaceProfile() || JSON.stringify(profile, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `jupiter-sr-profile-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportProfile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewer) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        viewer.importInterlaceProfile(content);
        const parsed = JSON.parse(content) as Profile;
        setProfile(parsed);
        localStorage.setItem(STORAGE_KEY, content);
      } catch (err) {
        alert('Error importing JupiterSR JSON profile. Please check file format.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleResetDefaults = () => {
    if (!viewer) return;
    viewer.importInterlaceProfile(DEFAULT_PROFILE);
    setProfile(DEFAULT_PROFILE);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleToggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const isInterlaced = profile.render.mode === 'interlaced';

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportProfile}
        className="hidden"
      />

      <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-750 shadow-lg">
        {/* Quick Toggle 2D / 3D Interlaced */}
        <button
          onClick={() => handleModeChange(isInterlaced ? '2d' : 'interlaced')}
          title={isInterlaced ? 'Switch to standard 2D mode' : 'Enable 3D interlacing for JupiterSR display'}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
            isInterlaced
              ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-950/50'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-750 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isInterlaced ? 'Jupiter 3D: ON' : 'Jupiter 3D: OFF'}</span>
        </button>

        {/* Calibration / Settings Button */}
        <button
          onClick={() => setIsOpen(true)}
          title="JupiterSR Optical Calibration & Render Settings"
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Calibration & Parameter Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            ref={modalRef}
            className="w-full max-w-lg bg-slate-900 border border-slate-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-tr from-teal-500 to-emerald-500 text-white shadow-lg">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                    JupiterSR · 3D Settings
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">
                      v1.0.0
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Optical Subpixel Interlacing for Autostereoscopic Displays
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 bg-slate-900/60 px-4 pt-2 gap-2">
              <button
                onClick={() => setActiveTab('render')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'render'
                    ? 'border-emerald-400 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Render & Parallax
              </button>
              <button
                onClick={() => setActiveTab('calibration')}
                className={`px-3 py-2 text-xs font-semibold rounded-t-xl transition-colors border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'calibration'
                    ? 'border-emerald-400 text-emerald-400 bg-slate-800/60'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                Optical Calibration
              </button>
            </div>

            {/* Form Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              {activeTab === 'render' && (
                <div className="space-y-3.5">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2.5">
                    <label className="block text-slate-300 font-semibold">Display Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['interlaced', '2d', 'view'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => handleModeChange(mode)}
                          className={`py-2 px-3 rounded-lg border font-medium text-center transition-all ${
                            profile.render.mode === mode
                              ? 'bg-emerald-950 border-emerald-600 text-emerald-300 font-semibold'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-850'
                          }`}
                        >
                          {mode === 'interlaced' ? '3D Interlaced' : mode === '2d' ? 'Standard 2D' : 'Single View'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Rendered Views (1-30)</label>
                      <input
                        type="number"
                        min="1"
                        max="30"
                        value={profile.render.views}
                        onChange={(e) => handleRenderOptionChange('views', parseInt(e.target.value, 10) || 9)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-slate-500">9 = Fast / 30 = Max Smoothness</span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">View Width (px)</label>
                      <input
                        type="number"
                        min="100"
                        max="1920"
                        step="10"
                        value={profile.render.viewWidth}
                        onChange={(e) => handleRenderOptionChange('viewWidth', parseInt(e.target.value, 10) || 640)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-slate-500">Buffer resolution per view</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Camera Spacing (Baseline)</label>
                      <input
                        type="number"
                        min="0"
                        max="0.1"
                        step="0.001"
                        value={profile.render.viewSpacing}
                        onChange={(e) => handleRenderOptionChange('viewSpacing', parseFloat(e.target.value) || 0.006)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-slate-500">3D depth and parallax intensity</span>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Focus Distance (Zero-Parallax)</label>
                      <input
                        type="number"
                        min="0.1"
                        max="50"
                        step="0.5"
                        value={profile.render.focusDistance}
                        onChange={(e) => handleRenderOptionChange('focusDistance', parseFloat(e.target.value) || 3)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-slate-500">Plane where image converges</span>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'calibration' && (
                <div className="space-y-3.5">
                  <div className="bg-amber-950/30 border border-amber-800/50 p-2.5 rounded-xl text-[11px] text-amber-200/90 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      Adjust Pitch, Tan, and Offset while observing the JupiterSR display (ideally in Fullscreen).
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Pitch</label>
                      <input
                        type="number"
                        step="0.00001"
                        value={profile.calibration.pitch}
                        onChange={(e) => handleCalibrationChange('pitch', parseFloat(e.target.value) || 0.27777)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Tan</label>
                      <input
                        type="number"
                        step="0.01"
                        value={profile.calibration.tan}
                        onChange={(e) => handleCalibrationChange('tan', parseFloat(e.target.value) || 10)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Offset</label>
                      <input
                        type="number"
                        step="0.1"
                        value={profile.calibration.offset}
                        onChange={(e) => handleCalibrationChange('offset', parseFloat(e.target.value) || 2)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-slate-300 font-medium mb-1">View Order</label>
                      <select
                        value={profile.calibration.order}
                        onChange={(e) => handleCalibrationChange('order', e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="forward">Forward</option>
                        <option value="reverse">Reverse</option>
                        <option value="pingpong">Ping-pong</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Subpixels</label>
                      <select
                        value={profile.calibration.subpixelOrder}
                        onChange={(e) => handleCalibrationChange('subpixelOrder', e.target.value as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="RGB">RGB</option>
                        <option value="BGR">BGR</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-medium mb-1">Rotation</label>
                      <select
                        value={profile.calibration.rotation}
                        onChange={(e) => handleCalibrationChange('rotation', parseInt(e.target.value, 10) as any)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="0">0°</option>
                        <option value="90">90°</option>
                        <option value="180">180°</option>
                        <option value="270">270°</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer with Actions */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportProfile}
                  title="Export current profile to a .json file"
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="Import profile from a .json file"
                  className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-750 text-slate-300 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Import</span>
                </button>

                <button
                  onClick={handleResetDefaults}
                  title="Reset to default settings"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleFullscreen}
                  title="Fullscreen mode (required for physical subpixel alignment)"
                  className="flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900/90 text-indigo-300 border border-indigo-750 px-3 py-1.5 rounded-lg font-medium transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Fullscreen</span>
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-1.5 rounded-lg transition-colors shadow-lg shadow-emerald-950/50"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
