# Delta for Transform Gizmo Controls

## ADDED Requirements

### Requirement: Raycast Selection & Visual Feedback
The system MUST support pointer raycast selection of 3D asset props in the viewport. Clicking an asset mesh MUST select the root asset entity and display a visual bounding box helper. Clicking empty space or pressing Escape MUST deselect the asset and remove the helper.

#### Scenario: Selecting an asset via click
- GIVEN loaded 3D asset props in the viewport with no active selection
- WHEN the user clicks on an asset mesh
- THEN the root asset entity MUST become selected
- AND a bounding box helper MUST render around the selected asset

#### Scenario: Deselecting on empty space or Escape
- GIVEN an asset is currently selected with a bounding box helper visible
- WHEN the user clicks on empty viewport space or presses Escape
- THEN the selection MUST be cleared and the bounding box helper MUST be removed

#### Scenario: Switching selection between assets
- GIVEN asset A is currently selected
- WHEN the user clicks on asset B
- THEN asset A MUST be deselected and asset B MUST become selected with its bounding box helper

### Requirement: Transform Gizmo Control
The system MUST attach a 3D transform gizmo to the selected asset. The gizmo MUST support translate mode (axis translation handles) and rotate mode (rotation rings). The gizmo MUST detach immediately when the asset is deselected.

#### Scenario: Gizmo attaches on selection
- GIVEN an unselected asset in the viewport
- WHEN the asset is selected
- THEN the transform gizmo MUST attach to the asset in translate mode

#### Scenario: Switching gizmo mode
- GIVEN an asset selected with the gizmo in translate mode
- WHEN the transform mode is changed to rotate
- THEN the gizmo MUST switch display to rotation rings

#### Scenario: Detaching gizmo on deselection
- GIVEN an active selection with an attached transform gizmo
- WHEN the selection is cleared
- THEN the transform gizmo MUST detach and disappear from the viewport

### Requirement: Input & Camera Disambiguation
The system MUST lock camera navigation controls (WASD movement and mouse look) while a gizmo handle is actively being dragged. Camera controls MUST unlock immediately when the drag interaction ends.

#### Scenario: Camera locked during active drag
- GIVEN an asset selected with active transform gizmo
- WHEN the user drags any gizmo handle
- THEN WASD fly-through navigation and mouse look rotation MUST be locked

#### Scenario: Camera unlocked on drag release
- GIVEN an active gizmo drag with camera controls locked
- WHEN the user releases pointer interaction
- THEN camera fly-through and mouse look controls MUST be restored

#### Scenario: Camera look outside gizmo handles
- GIVEN an asset selected with active transform gizmo
- WHEN the user drags the pointer on empty viewport space
- THEN camera look rotation MUST proceed normally without moving the asset

### Requirement: Contextual UI Controls & Keybindings
The system MUST display a contextual toolbar and support keyboard shortcuts for the selected asset: 'W' for translate mode, 'E' for rotate mode, 'Escape' for deselect, 'Delete'/'Backspace' for asset removal, and a snap-to-ground action.

#### Scenario: Toggling modes via shortcuts and toolbar
- GIVEN an asset selected in translate mode
- WHEN the user presses 'E' or clicks the rotate toolbar button
- THEN the gizmo MUST switch to rotate mode
- AND pressing 'W' or clicking translate MUST switch back to translate mode

#### Scenario: Snapping asset to ground height
- GIVEN an asset selected at an elevated or sunken Y coordinate
- WHEN the user activates the snap-to-ground action
- THEN the base of the asset MUST align with the ground elevation at its (X, Z) coordinate

#### Scenario: Deleting selected asset
- GIVEN an asset is selected in the viewport
- WHEN the user presses Delete/Backspace or clicks the delete toolbar action
- THEN the asset MUST be removed from the scene and selection MUST be cleared

### Requirement: State & Position Synchronization
The system MUST dispatch transform change events when gizmo manipulation completes, synchronizing new position (x, y, z) and Euler rotation values with the active session state, `WorldSpec`, and property inspector UI.

#### Scenario: Synchronizing transform on drag release
- GIVEN an asset translated or rotated via gizmo handles
- WHEN the user releases the gizmo handle
- THEN a transform change event MUST be dispatched with the updated coordinates and rotation
- AND the corresponding `WorldSpec` asset definition MUST update with the new values

#### Scenario: Updating inspector UI
- GIVEN an asset selected with the inspector panel open
- WHEN the asset is transformed via gizmo
- THEN position and rotation inputs in the inspector MUST reflect the updated values
