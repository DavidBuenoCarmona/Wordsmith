---
dependencies:
  - "@wordsmith/shared (nuevo schemas/scene.ts: SceneFileSchema, FavoritesBodySchema) debe compilarse antes que server/client"
  - "three TransformControls / Raycaster (ya presentes); GLTFLoader para la malla de colisión de World Labs"
  - "Fastify content-type parser application/octet-stream para importaciones (límite 500 MB)"
risks:
  - "Colisionador de World Labs con orientación distinta a la del splat -> se elige orientación por caja envolvente (contiene el origen de cámara) y se descarta si no encaja"
  - "Escenas con URLs blob: (importación sin servidor) no son persistentes -> se omiten y se avisa al usuario"
  - "Subidas de ficheros: extensión en lista blanca, nombre por hash, ids de escena con regex de slug (sin path traversal)"
  - "Borrado deshacible retiene geometrías en memoria -> se liberan en clearAssets()"
rollback_strategy: "Cambios aditivos: los endpoints nuevos y SceneFile no alteran contratos existentes. Revertir App.tsx/WorldViewer3D.ts restaura la UI 0.3.0; storage/scenes y storage/favorites.json son ficheros independientes."
---

# Plan de implementación v0.4.0 — Autoría y persistencia de escenas

## Revisión arquitectónica adversarial

```xml
<architect_review>
  <builder>Guardar escena como JSON (mundo + modelos con transformación) en storage/scenes, con Outliner leyendo del visor (no del job) y Floor basado en el colisionador de World Labs.</builder>
  <adversary>Riesgo específico: los modelos añadidos desde "3D Models (GLB)" y los importados con blob: no forman parte del WorldSpec, por lo que un outliner basado en el job (como el AssetInspector) nunca los vería y una escena guardada perdería el "Parque Infantil" o los GLB importados. Además, el raycast sobre un SplatMesh no tiene triángulos y la malla de colisión podría venir en otro sistema de coordenadas: Floor podría colocar el modelo bajo tierra.</adversary>
  <builder>Resolución: el visor es la fuente de verdad (listObjects/serializeModels). Las importaciones se suben a storage/ y se referencian por URL persistente; los blob: se omiten con aviso. El colisionador se valida por caja envolvente contra el origen de cámara y si no encaja se ignora; además existe suelo manual calibrable como válvula de escape.</builder>
  <adversary>¿Qué pasa si el WorldSpec de un job existente y la escena restaurada discrepan, o si el borrado deshacible deja objetos huérfanos en el WorldSpec?</adversary>
  <builder>Resolución: la escena restaurada no usa WorldSpec (solo modelUrl + transformación); el historial se limpia al aplicar un WorldSpec nuevo o cargar escena (clearHistory). Aceptado: tras deshacer un borrado el WorldSpec del job no recupera el asset (no se usa para guardar).</builder>
</architect_review>
```

## Slices

1. `@wordsmith/shared`: `scene.ts` + tests.
2. `@wordsmith/server`: orden alfabético, `saveScene/getScene/listScenes/deleteScene`, `saveUpload`, favoritos, rutas y tests.
3. Visor: foco (F), edición numérica, historial, duplicar, ocultar/bloquear/renombrar, suelo (raycast desde el objeto + colisionador + calibración), iluminación, órbita, captura, atajos Unreal.
4. UI: `OutlinerPanel`, `NumberField`, `SceneSelector`, `FavoriteStar`, `ShortcutsHelp`, selectores con pins, hook `useEditorShortcuts`, importaciones persistentes.
5. Verificación: tests unitarios + E2E en Chrome (CDP) + docs/versionado.
