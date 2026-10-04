# Design: Transform Gizmo Controls

## Technical Approach

Integrate Three.js `TransformControls` and `BoxHelper` into `WorldViewer3D` to enable interactive translation and rotation of GLB asset groups. Disambiguate pointer clicks from camera drag-orbit using pixel-distance thresholds. Expose transform lifecycle methods and callback hooks to synchronize transforms with React state (`App.tsx`), `TransformToolbar.tsx`, and `worldSpec`.

## Architecture Decisions

| Area | Option | Tradeoffs | Decision |
|------|--------|-----------|----------|
| **Gizmo Integration** | Three.js `TransformControls` vs Custom Overlay | Custom overlay requires custom ray-plane projection math; `TransformControls` is battle-tested in Three.js ecosystem. | Use standard `TransformControls` attached to selected `THREE.Group`. |
| **Pointer Interaction** | Direct `click` event vs pointerdown/pointerup drag threshold | Pointerdown/up allows distinguishing camera orbit drags (>5px delta) from explicit selection clicks (<5px). | Pointerdown/up delta threshold (<5px) on canvas. |
| **Selection Visuals** | Emissive mesh outline shader vs `THREE.BoxHelper` | Shaders require modifying GLTF sub-materials; `BoxHelper` is non-destructive, fast, and auto-wraps hierarchies. | Use `THREE.BoxHelper` with accent color (`#6366f1`) updated on object changes. |
| **State Sync** | Continuous per-frame React state dispatch vs drag-release commit | Continuous React updates trigger excessive re-renders during 60fps drag; drag-release keeps UI responsive. | Update local gizmo/box at 60fps; dispatch `onAssetTransformed` only on `dragging-changed: false`. |

## Data Flow

```
User Click (<5px) ──→ Raycaster Hit ──→ selectAsset(id) ──→ BoxHelper + TransformControls Attached
                                                                  │
                                                        onAssetSelected Callback
                                                                  ▼
                                                      React State (selectedAsset)
                                                                  │
┌─────────────────────────────────────────────────────────────────┴────────────────────────────────┐
│ TransformToolbar (W/E Mode, Snap, Delete) & Keyboard Hotkeys (W, E, Esc, Del)                    │
└─────────────────────────────────────────────────────────────────┬────────────────────────────────┘
                                                                  ▼
User Drags Gizmo ──→ dragging-changed: true (Lock WASD/Orbit) ──→ Object Moves
                                                                  │
User Releases ──→ dragging-changed: false (Unlock WASD) ──→ onAssetTransformed(id, pos, rot)
                                                                  ▼
                                                       Update worldSpec & UI
```

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `packages/client/src/viewer/WorldViewer3D.ts` | Modify | Add `TransformControls`, `BoxHelper`, selection raycasting, camera locking, ground snap, and public control methods. |
| `packages/client/src/components/TransformToolbar.tsx` | Create | Floating badge toolbar for mode toggle (Translate/Rotate), ground snap, position inspector, and delete. |
| `packages/client/src/components/AssetInspector.tsx` | Modify | Highlight currently selected asset and sync coordinate readouts. |
| `packages/client/src/App.tsx` | Modify | Manage selection state, hotkeys (`W`, `E`, `Escape`, `Delete`), toolbar rendering, and `worldSpec` asset sync. |
| `packages/client/tests/viewer.test.ts` | Modify | Unit/integration tests for asset selection, transform modes, and ground snap. |

## Interfaces / Contracts

```typescript
// WorldViewer3D Types & Callbacks
export interface WorldViewerOptions {
  onProgress?: (progress: number, detail: string) => void;
  onLoaded?: () => void;
  onError?: (error: string) => void;
  onAssetSelected?: (assetId: string | null, position?: THREE.Vector3, rotation?: THREE.Euler) => void;
  onAssetTransformed?: (assetId: string, position: { x: number; y: number; z: number }, rotation: { x: number; y: number; z: number }) => void;
  onAssetDeleted?: (assetId: string) => void;
}

export type TransformMode = 'translate' | 'rotate';

// Public API added to WorldViewer3D
export class WorldViewer3D {
  public selectAsset(assetId: string): void;
  public deselectAsset(): void;
  public setTransformMode(mode: TransformMode): void;
  public snapSelectedToGround(): void;
  public deleteSelectedAsset(): void;
  public getSelectedAssetId(): string | null;
}
```

```typescript
// TransformToolbar Component Props
export interface TransformToolbarProps {
  selectedAssetId: string;
  selectedAssetName?: string;
  mode: 'translate' | 'rotate';
  position?: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  onModeChange: (mode: 'translate' | 'rotate') => void;
  onSnapToGround: () => void;
  onDelete: () => void;
  onClose: () => void;
}
```

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit / Integration | Selection & Gizmo attachment | Test `selectAsset(id)` attaches controls, creates `BoxHelper`, and fires `onAssetSelected`. |
| Unit / Integration | Transform Mode toggle | Verify `setTransformMode('rotate')` updates `transformControls.setMode`. |
| Unit / Integration | Snap to ground | Verify `snapSelectedToGround()` repositions asset Y to `getGroundHeightAt(x, z)`. |
| Unit / Integration | Deselect and Delete | Verify `deselectAsset()` and `deleteSelectedAsset()` remove helpers and clean scene meshes. |
| Component (Manual/UI) | Keyboard shortcuts & Toolbar | Validate `W`, `E`, `Escape`, `Delete` trigger corresponding viewer actions and update React UI. |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Non-breaking extension to `WorldViewer3D` public API and client overlay UI.

## Open Questions

None.
