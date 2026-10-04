# Tasks: Transform Gizmo Controls

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 320–380 lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Gizmo integration, raycast selection & viewer API | PR 1 | `npm run test -- packages/client/tests/viewer.test.ts` | Local browser on `http://localhost:5173`, click on spawned asset | `packages/client/src/viewer/WorldViewer3D.ts` |
| 2 | TransformToolbar, AssetInspector & App state sync | PR 1 | `npm run build` | Local browser, toggle W/E modes, snap to ground, inspect coordinates | `packages/client/src/components/TransformToolbar.tsx`, `AssetInspector.tsx`, `App.tsx` |

## Phase 1: Three.js Gizmo & Raycast Selection Foundation

- [x] 1.1 Add `TransformControls` and `THREE.BoxHelper` initialization, attachment lifecycle, and disposal in `packages/client/src/viewer/WorldViewer3D.ts`.
- [x] 1.2 Implement pointer click raycasting with `<5px` delta threshold in `packages/client/src/viewer/WorldViewer3D.ts` to select root asset entities in `assetMeshes`.
- [x] 1.3 Add transform mode switching (`translate` / `rotate`), `snapSelectedToGround()`, and `deleteSelectedAsset()` methods to `packages/client/src/viewer/WorldViewer3D.ts`.
- [x] 1.4 Wire `TransformControls` event listeners: lock camera controls during active drag (`dragging-changed: true`), unlock on release (`dragging-changed: false`), and emit `onAssetTransformed` and `onAssetSelected` callbacks.

## Phase 2: Contextual Toolbar & React State Integration

- [x] 2.1 Create `packages/client/src/components/TransformToolbar.tsx` with translate/rotate toggles, ground snap, delete action, coordinate readout, and close button.
- [x] 2.2 Update `packages/client/src/components/AssetInspector.tsx` to highlight the selected asset and reflect updated position/rotation values.
- [x] 2.3 Update `packages/client/src/App.tsx` with selected asset state, `WorldViewer3D` callback handlers (`onAssetSelected`, `onAssetTransformed`, `onAssetDeleted`), and `worldSpec` asset synchronization.
- [x] 2.4 Add keyboard shortcut listeners in `packages/client/src/App.tsx` for 'W' (translate), 'E' (rotate), 'Escape' (deselect), and 'Delete'/'Backspace' (remove asset).

## Phase 3: Testing & Verification

- [x] 3.1 Add unit tests in `packages/client/tests/viewer.test.ts` for `selectAsset()`, `deselectAsset()`, and gizmo attachment/detachment.
- [x] 3.2 Add unit tests in `packages/client/tests/viewer.test.ts` for `setTransformMode('translate' | 'rotate')` and `snapSelectedToGround()` elevation calculations.
- [x] 3.3 Add unit tests in `packages/client/tests/viewer.test.ts` verifying `onAssetTransformed` and `onAssetDeleted` callbacks with updated positions and rotations.
- [x] 3.4 Run workspace tests and typecheck via `npm test` and `npm run build` to verify end-to-end client integrity.
