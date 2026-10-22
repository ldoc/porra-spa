# Toggle de clasificación en la fila del título (2026-10-22)

## Resumen

Mover el switch "Incluir puntos por clasificación" de la tab Clasificación desde su bloque sobre la tabla hasta la fila del título, alineado a la derecha. Eliminar el hint visible; la info de variabilidad sigue en el notice del modal de perfil (y se añade `title` al label).

## Cambios

1. **`js/main.js` — `renderClasificacionTab`:** el bloque `toggleHtml` ya no se concatena al `container.innerHTML`. En su lugar, la función gestiona un nodo aparte:
   - Si `getFaseJuego() === 'FASE_LIGA'`: inyectar (idempotente) `<div class="clasif-clas-toggle" id="clasif-clas-header-toggle"><label title="Los puntos por clasificación varían según la clasificación real después de cada partido"><input type="checkbox" id="clasif-clas-check" ${estado} onchange="toggleClasificacionClas()"><span>Clasif.</span></label></div>` dentro de `#tab-clasificacion .section-header` (después del `<h2>`, queda a la derecha por `justify-content: space-between`).
   - Si no: `remove()` del nodo si existe.
   - Handler `toggleClasificacionClas`, estado `AppState.clasificacionClasOn` y paso del flag a `computeUserRealPoints`/`getClasificacionTrendMap`: sin cambios.
2. **`css/styles.css`:** `.clasif-clas-toggle` compacto inline: `min-height: 44px` para zona táctil en el propio header, sin `flex-wrap`/`small`, sin fondo ni borde (vive en el header).
3. **Tests:** `tests/clasifClasToggle.test.js` ampliado con checks de fuente: `renderClasificacionTab` ya no concatena `toggleHtml`, existe `clasif-clas-header-toggle` con inyección/remove en el header, label con `title` y texto `Clasif.`
4. **Cache-busting:** `main.js?v=174→175`, `styles.css?v=126→127` en `index.html`.

## Sin cambios

Columnas/orden/trend, reset en `navigateToTab`, alcance (header "Tus puntos", perfil, estadísticas), comportamiento post-liga.
