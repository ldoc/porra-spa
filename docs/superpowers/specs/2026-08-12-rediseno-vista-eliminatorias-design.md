# Rediseño de la vista Eliminatorias en Resultados

**Fecha**: 2026-08-12
**Estado**: Aprobado

## Resumen

Rediseñar el layout de la sub-tab **Eliminatorias** dentro de la pantalla de **Resultados** (vista read-only). El objetivo es reducir el espacio vertical que ocupan las cajas de equipos y mejorar la jerarquía visual del cuadro final.

## Alcance

- **Solo la vista read-only** de Resultados (`.eliminatorias-view`, generada por `renderEliminatoriasView()` en `js/main.js`).
- **No cambia** la pantalla interactiva de Predicciones de Eliminatorias (tap-to-place, `tab-final-predictions`).
- **No cambia** la lógica de negocio ni los tests.

## Requisitos visuales

### 1. Zonas de 16avos, 8avos y cuartos — 4 cajas por fila

Las zonas `roundOf32` (8 equipos), `roundOf16` (8 equipos) y `quarterFinalists` (4 equipos) deben mostrar sus cajas a **4 por fila** en lugar de 2.

- `grid-template-columns: repeat(4, 1fr)` en `.drop-zone-slots` para esas tres zonas (dentro de `.eliminatorias-view`).
- Escudo reducido de `28px` a `20px`; nombre a `8px` (existente).
- Resultado: cajas de ~100px de ancho en móvil de 480px (validado con mockup).

### 2. Zonas de semifinales — 2 cajas centradas

Las 2 cajas de `semiFinalists` se centran en la fila en lugar de ocupar todo el ancho.

- Flex centrado (`justify-content: center`) o grid de 2 columnas con ancho contenido.
- Cajas de ~100px de ancho (mismo tamaño que las anteriores), escudo `22px`.

### 3. Final — Subcampeón y Campeón en la misma fila

Subcampeón (izquierda) y Campeón (derecha) se muestran en la **misma fila**, lado a lado.

- Envolver las dos llamadas a `renderElimZona` (Subcampeón + Campeón) en `renderEliminatoriasView()` en un contenedor `<div class="eliminatorias-final-row">`.
- `.eliminatorias-final-row`: `display: flex; flex-direction: row; gap: 6px;`.
- Cada tarjeta `flex: 1`, manteniendo los estilos existentes de `.drop-zone` y sus bordes laterales (`--accent-silver` para Subcampeón, `--accent-gold` para Campeón).

## Implementación

### `css/styles.css`

Añadir al final del archivo (junto a los estilos actuales de eliminatorias, ~línea 4472):

```css
/* Rediseño vista Eliminatorias en Resultados (read-only) */
.eliminatorias-view .drop-zone[data-zone="roundOf32"] .drop-zone-slots,
.eliminatorias-view .drop-zone[data-zone="roundOf16"] .drop-zone-slots,
.eliminatorias-view .drop-zone[data-zone="quarterFinalists"] .drop-zone-slots {
  grid-template-columns: repeat(4, 1fr);
}

.eliminatorias-view .drop-zone[data-zone="roundOf32"] .drop-slot-img,
.eliminatorias-view .drop-zone[data-zone="roundOf16"] .drop-slot-img,
.eliminatorias-view .drop-zone[data-zone="quarterFinalists"] .drop-slot-img {
  width: 20px;
  height: 20px;
}

.eliminatorias-view .drop-zone[data-zone="semiFinalists"] .drop-zone-slots {
  display: flex;
  justify-content: center;
  gap: 6px;
}

.eliminatorias-view .drop-zone[data-zone="semiFinalists"] .drop-slot {
  flex: 0 1 100px;
}

.eliminatorias-view .drop-zone[data-zone="semiFinalists"] .drop-slot-img {
  width: 22px;
  height: 22px;
}

.eliminatorias-final-row {
  display: flex;
  flex-direction: row;
  gap: 6px;
}

.eliminatorias-final-row .drop-zone {
  flex: 1;
  min-width: 0;
}
```

### `js/main.js`

En `renderEliminatoriasView()` (~línea 1654), envolver las dos zonas de la final:

```js
if (result.rondasResueltas.includes('final')) {
  html += '<div class="eliminatorias-final-row">';
  html += renderElimZona('Subcampeón', '🥈', 'runnerUp', result.final.subcampeon ? [result.final.subcampeon] : [], 1);
  html += renderElimZona('Campeón', '🏆', 'champion', result.final.campeon ? [result.final.campeon] : [], 1);
  html += '</div>';
}
```

### `index.html` — cache-busting

- `css/styles.css?v=42` → `v=43`
- `js/main.js?v=59` → `v=60`

## Verificación

- No hay lógica nueva que testear (solo layout/CSS + wrapper HTML). Los 70 tests existentes deben seguir pasando.
- Verificación manual en navegador: vista Eliminatorias en Resultados con datos de ejemplo (snippet del plan anterior) — 4 cajas por fila en 16avos/8avos/cuartos, semis centradas, final en fila.
- La pantalla de Predicciones de Eliminatorias debe mantener su layout actual (2 columnas, sin cambios).
