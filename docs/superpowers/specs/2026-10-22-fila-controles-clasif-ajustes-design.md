# Ajustes fila de controles Clasificación (2026-10-22, v2)

## Resumen
Dos ajustes visuales de la fila `#clasif-clas-header-toggle` de la tab Clasificación, tras el combo de orden:

1. **Label del checkbox alineado a la izquierda**: `.clasif-clas-toggle label` tiene `text-align: right` (residual de iteraciones previas) — cuando el texto "Mostrar ptos clasificación temporal" envuelve a 2+ líneas en móvil se ve alineado a la derecha. Cambiar a `text-align: left`. La fila sigue centrada (sin cambio de layout).
2. **Texto "Ordenar por:" para el combo**: nuevo `<span class="clasif-clas-sort-label">Ordenar por:</span>` justo antes del `<select id="clasif-sort-select">` en `syncClasifClasHeaderToggle` (visible siempre que se vea el combo). CSS: `font-size: 10.5px; font-weight: 600; color: var(--text-primary); white-space: nowrap;` — mismo tono/tamaño que el label del checkbox, sin valores estáticos nuevos.

## Validación
- Diseño aprobado en visual companion (mockup `controls-row-v1`, estilos exactos del repo): fila centro, label con wrap de 2 líneas alineado a la izquierda, "Ordenar por:" + select a su derecha.

## Cambios
- `css/styles.css`: `text-align: right` → `left` en `.clasif-clas-toggle label`; nueva regla `.clasif-clas-sort-label` junto a `.clasif-clas-sort` (solo variables existentes).
- `js/main.js` (`syncClasifClasHeaderToggle`): añadir el span antes del select en el `html` (copy literal "Ordenar por:").
- `tests/clasifClasToggle.test.js`: asserts de fuente — `clasif-clas-sort-label` y `Ordenar por:` en `test_toggle_en_header_no_en_tabla`; `text-align: left` en `test_css_compacto`; versiones en `test_cache_busting`.
- Cache-busting: `index.html` línea 19 `styles.css?v=132→133`, línea 333 `main.js?v=180→181`.

## Sin cambios
- Estado, ordenación, trend, fases, checkbox FASE_LIGA-solo: todo intacto.
