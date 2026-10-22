# Walkthrough — Wordsmith v0.4.0 (Autoría y persistencia de escenas)

## Qué se ha hecho
- **Orden alfabético + pins** en mundos y modelos (servidor y cliente); pins persistentes en `storage/favorites.json`.
- **Outliner** a la derecha con todos los objetos (también los añadidos a mano), selección, renombrar, ocultar, bloquear, borrar y **`F` para centrar la cámara**.
- **Inspector numérico** (posición, rotación en grados, escala) sincronizado con el gizmo, **undo/redo**, **duplicar**.
- **Escenas guardables** (JSON en `storage/scenes/`) con mundo + modelos + posición/rotación/escala + cámara + suelo + iluminación; importaciones persistentes en `storage/`.
- **Floor corregido**: pivote centrado, rayo desde el objeto, colisionador de World Labs, calibración manual.
- **Selector de modo de generación**: *Everything* / *Scenery only* / *Objects only* (añade N objetos Tripo distintos a la escena actual, en fila, sobre el suelo).
- **Extras para la demo**: modo presentación (`H`), captura PNG, presets de iluminación, ayuda de atajos (`?`), atajos estilo Unreal (W/E/R/F).

## Cómo se verificó
| Capa | Resultado |
| --- | --- |
| `@wordsmith/shared` | 13 tests (incluye `SceneFileSchema`, `mode`) |
| `@wordsmith/server` | 41 tests (orden, escenas, subidas, favoritos, rutas, path traversal, modos de generación) |
| `@wordsmith/client` | 49 tests (visor: foco, historial, suelo, serialización, navegación, órbita, `spawnModelsInFront`; componentes React) |
| `tsc` + `vite build` | sin errores |
| E2E en Chrome (CDP) | 23/23 (escenas) + 12/13 (modos; el 13.º era un timing del script con mocks): añadir modelo, pins, editar X/rotación, Floor, F, guardar → recargar → cargar escena, `H`, `?` |
| Mundo real (Parque Infantil) | colisionador descargado (CORS ok) y Floor apoya la base sobre la superficie real (±5 cm) |

## Arrancar y ensayar la demo
1. Reiniciar con `start.cmd` (compila `@wordsmith/shared` si falta; el `dist` ya está recompilado).
2. `http://localhost:3000` → elegir mundo → añadir modelos → `Scenes` → *Save*.
3. Recargar la página → `Scenes` → *Load* → todo vuelve a su sitio. `H` para presentar.

## Limitaciones conocidas
- En Chrome headless sin GPU los Gaussian Splats no se dibujan (no afecta a un navegador con GPU).
- Los modelos Tripo que solo tengan URL firmada de S3 (sin descargar a `storage/models`) caducarán dentro de una escena guardada.
- Objetos con URL `blob:` (importación sin servidor) no se guardan.
