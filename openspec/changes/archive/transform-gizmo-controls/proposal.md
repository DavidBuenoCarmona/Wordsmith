# Proposal: Transform Gizmo Controls

## Intent

Enable interactive direct-manipulation of 3D asset props in the WorldViewer3D viewport using Three.js TransformControls. Creators need to select, translate, rotate, snap to ground, and fine-tune spawned and generated GLB models directly in the 3D scene without manual numeric entry.

## Scope

### In Scope
- Raycast-based object selection for loaded GLB asset groups in `WorldViewer3D`.
- Visual selection feedback using bounding box/outline helpers (`BoxHelper`).
- Three.js `TransformControls` integration supporting `translate` (3D axis arrows) and `rotate` (axis rings) modes.
- Camera navigation locking during active gizmo drag (`dragging-changed` event).
- Contextual viewport toolbar for switching gizmo modes (Translate/Rotate), snapping asset to ground level, and deselecting/deleting.
- State synchronization callback (`onAssetTransformChange`) to update `worldSpec` asset positions/rotations and UI state.

### Out of Scope
- Multi-object group selection or multi-transform.
- Non-uniform / freeform vertex deformation or mesh scaling gizmos.
- Undo/redo history tree (persisting transforms directly to active session state).

## Capabilities

### New Capabilities
- `transform-gizmo-controls`: Interactive 3D prop selection, transform gizmo manipulation (translate/rotate), camera lock, and state synchronization in WorldViewer3D.

### Modified Capabilities
- None

## Approach

- Integrate `TransformControls` from `three/examples/jsm/controls/TransformControls.js` inside `WorldViewer3D`.
- Add raycasting on pointer clicks targeting `assetMeshes` to select or deselect the active object.
- Attach `TransformControls` and a dynamic `BoxHelper` to the selected `THREE.Group`.
- Intercept `dragging-changed` on `TransformControls` to disable WASD/mouse look navigation while manipulating gizmo handles.
- Fire `onAssetTransform` callback upon drag release, syncing transformed coordinates (`x, y, z`, Euler rotation) with client state and `WorldSpec`.
- Build a floating contextual control bar in React (`TransformToolbar.tsx`) offering mode toggles (Translate/Rotate), ground snap button, and deselect/delete actions.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `packages/client/src/viewer/WorldViewer3D.ts` | Modified | Add TransformControls, raycast selection, BoxHelper, and event callbacks |
| `packages/client/src/components/TransformToolbar.tsx` | New | Contextual overlay UI for transform mode, snapping, and selection actions |
| `packages/client/src/App.tsx` | Modified | Wire selected asset state, toolbar rendering, and spec sync |
| `packages/client/src/components/AssetInspector.tsx` | Modified | Highlight selected asset and reflect transform changes |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Gizmo drag conflicts with free-flight camera navigation | Med | Strict camera input lock via `dragging-changed` event listener |
| Raycaster selecting internal GLB sub-meshes instead of parent asset group | Med | Traverse upward from intersection hit until reaching root `assetMeshes` group |
| Ground clipping after free translation | Low | Provide ground-snap utility action and calculate `getGroundHeightAt(x, z)` |

## Rollback Plan

Revert `WorldViewer3D.ts`, `App.tsx`, and remove `TransformToolbar.tsx` to restore previous read-only/spawn-only asset viewing.

## Dependencies

- `three/examples/jsm/controls/TransformControls.js` (available in Three.js dependency)

## Success Criteria

- [ ] Clicking a 3D asset selects it and attaches the TransformControls gizmo and selection box helper.
- [ ] Dragging gizmo handles translates/rotates the asset while camera movement remains locked.
- [ ] Contextual toolbar switches modes between Translate and Rotate, snaps asset to ground, or deselects.
- [ ] Completed transforms update the asset's position and rotation in the client session state.
