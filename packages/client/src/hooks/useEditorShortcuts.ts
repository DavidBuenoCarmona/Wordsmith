// =============================================================================
// Wordsmith — AI-native 3D world generator
// Copyright (c) 2026 David Bueno Carmona · https://github.com/davidbuenov
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { useEffect, MutableRefObject } from 'react';
import type { WorldViewer3D, TransformMode } from '../viewer/WorldViewer3D.js';

interface EditorShortcutsArgs {
  viewerRef: MutableRefObject<WorldViewer3D | null>;
  selectedAssetId: string | null;
  presentation: boolean;
  helpOpen: boolean;
  onTransformMode: (mode: TransformMode) => void;
  onTogglePresentation: () => void;
  onExitPresentation: () => void;
  onToggleHelp: () => void;
  onCloseHelp: () => void;
}

/**
 * Atajos globales alineados con Unreal Engine:
 * W mover · E rotar · R escalar · F enfocar · Supr borrar · Ctrl+Z/Y deshacer/rehacer ·
 * Ctrl+D duplicar · H presentación · ? ayuda · Esc deseleccionar.
 */
export function useEditorShortcuts({
  viewerRef,
  selectedAssetId,
  presentation,
  helpOpen,
  onTransformMode,
  onTogglePresentation,
  onExitPresentation,
  onToggleHelp,
  onCloseHelp,
}: EditorShortcutsArgs): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en un input o textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      const viewer = viewerRef.current;
      if (!viewer) return;

      const ctrl = e.ctrlKey || e.metaKey;

      if (ctrl) {
        if (e.code === 'KeyZ') {
          e.preventDefault();
          if (e.shiftKey) viewer.redo();
          else viewer.undo();
        } else if (e.code === 'KeyY') {
          e.preventDefault();
          viewer.redo();
        } else if (e.code === 'KeyD' && selectedAssetId) {
          e.preventDefault();
          viewer.duplicateSelected();
        }
        return;
      }
      if (e.altKey) return;

      if (e.key === '?' || e.code === 'F1') {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        if (helpOpen) onCloseHelp();
        else if (presentation) onExitPresentation();
        else if (selectedAssetId) viewer.deselectAsset();
        return;
      }

      if (e.code === 'KeyH') {
        e.preventDefault();
        onTogglePresentation();
        return;
      }

      // Con el ratón pulsado, W/E/Q... son vuelo de cámara (como Unreal), no modos del gizmo
      if (viewer.isNavigating() || presentation) return;

      if (e.code === 'KeyF') {
        e.preventDefault();
        viewer.focusAsset();
      } else if (!selectedAssetId) {
        // El resto de atajos operan sobre el objeto seleccionado
      } else if (e.code === 'KeyW') {
        e.preventDefault();
        onTransformMode('translate');
      } else if (e.code === 'KeyE') {
        e.preventDefault();
        onTransformMode('rotate');
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        onTransformMode('scale');
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        e.preventDefault();
        viewer.deleteSelectedAsset();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewerRef,
    selectedAssetId,
    presentation,
    helpOpen,
    onTransformMode,
    onTogglePresentation,
    onExitPresentation,
    onToggleHelp,
    onCloseHelp,
  ]);
}
