# Diseño: Cajas de drop slots con ancho fijo y nombre en máx. 3 líneas

**Fecha:** 2026-08-13
**Repositorio:** porra-spa (frontend SPA)

## Problema

En la pantalla **Pronósticos → Eliminatorias** (`renderFinalPredictionsTab`, `js/main.js:5176`), las cajas de drop (`renderDropZone`, `js/main.js:5358`) cambian de tamaño cuando el nombre del equipo es muy largo.

### Causa raíz

- `.drop-zone-slots` usa `grid-template-columns: repeat(2, 1fr)` (`css/styles.css:3881-3885`). En CSS Grid, `1fr` equivale a `minmax(auto, 1fr)`, por lo que el tamaño mínimo de cada columna es el `min-content` de su contenido.
- `.drop-slot-name` usa `white-space: nowrap` + `text-overflow: ellipsis` (`css/styles.css:3920-3932`). Un nombre largo (nowrap) tiene un `min-content` amplio que ensancha la columna del grid.
- `.drop-slot` tiene `aspect-ratio: 1` (`css/styles.css:3889`): al ensancharse la columna, la altura crece igualmente, desalineando las cajas de la fila.

## Alcance

- **Solo drop slots** de Semifinalistas, Cuartos, Octavos y Dieciseisavos (`.drop-slot` / `.drop-slot-name`).
- El podium (campeón/subcampeón, `.podium-slot` / `.podium-team-name`) **queda como está** (decisión del usuario).
- Cambio 100% CSS en `css/styles.css`. Sin cambios en `js/main.js`, `index.html` (salvo cache-busting) ni tests.

## Solución: Enfoque A (CSS-only, unificar clamp en la base)

Reutiliza el patrón ya probado en la vista read-only de eliminatorias (`.eliminatorias-view .drop-slot-name` en `css/styles.css:4528-4536`), que usa `-webkit-line-clamp: 3`.

### Cambio 1 — `.drop-zone-slots` (`css/styles.css:3881-3885`)

`grid-template-columns: repeat(2, 1fr)` → `repeat(2, minmax(0, 1fr))`.

Impide que el `min-content` del contenido ensanche la columna: las dos columnas quedan de ancho fijo e igual.

### Cambio 2 — `.drop-slot` (`css/styles.css:3888-3900`)

Añadir `min-width: 0`.

Defensa adicional del grid item: garantiza que el contenido del slot no fuerce el ancho de la caja (misma protección que ya usa la vista read-only en `css/styles.css:4524-4526`).

### Cambio 3 — `.drop-slot-name` (`css/styles.css:3920-3932`)

Reemplazar:
```css
overflow: hidden;
text-overflow: ellipsis;
white-space: nowrap;
```
por:
```css
white-space: normal;
overflow-wrap: anywhere;
word-break: break-word;
display: -webkit-box;
-webkit-box-orient: vertical;
-webkit-line-clamp: 3;
overflow: hidden;
```

Se mantienen el resto de propiedades (`font-size: 8px`, `font-weight: 600`, `color`, `text-align: center`, `margin-top: 3px`, `max-width: 100%`, `padding: 0 2px`, `line-height: 1.2`).

Efecto: el nombre se muestra en hasta 3 líneas y, si ocupa más, se corta con ellipsis (`-webkit-line-clamp`). Con `aspect-ratio: 1` y ancho fijo (Cambios 1 y 2), todas las cajas de una fila quedan con el mismo tamaño.

### Cambio 4 — Eliminar overrides read-only redundantes (`css/styles.css:4524-4536`)

- `.eliminatorias-view .drop-slot { min-width: 0 }` (4524-4526): ya lo cubre la base (Cambio 2).
- `.eliminatorias-view .drop-slot-name` (4528-4536): ya lo cubre la base (Cambio 3).

Las cuadrículas read-only `repeat(4, 1fr)` (`css/styles.css:4475-4500`) quedan igualmente protegidas contra el blowout gracias al `min-width: 0` de la base. Sin este cambio, ambas reglas quedarían duplicadas con exactamente la misma semántica.

### Cambio 5 — Cache-busting (`index.html:19`)

`css/styles.css?v=46` → `css/styles.css?v=47`.

Obligatorio según `AGENTS.md` al tocar `css/styles.css`. No se modifica `js/main.js` ni su `?v=`.

## Verificación

- No hay lógica JS nueva: `node --check js/main.js` no es necesario (no se toca main.js).
- Los tests del repo son de lógica JS (Node) y no cubren CSS; no se añaden tests.
- Verificación por lectura: confirmar que las reglas de los cambios 1-3 están presentes y que las de la vista read-only (cambio 4) ya no existen.
- Verificación visual manual (usuario): en Pronósticos → Eliminatorias, un equipo con nombre largo (p. ej. el de mayor longitud en `data/teams.json`) debe verse en caja de ancho fijo, con nombre en hasta 3 líneas y cortado con "…" si excede.

## Archivos tocados

| Archivo | Cambio |
|---------|--------|
| `css/styles.css` | Cambios 1-4 |
| `index.html` | Cambio 5 (cache-busting) |
