# Cajas fijas con nombre en varias líneas — vista Eliminatorias en Resultados

**Fecha**: 2026-08-12
**Estado**: Aprobado

## Resumen

En la vista read-only de Eliminatorias (Resultados), los nombres de equipo largos empujan la caja (slot) y la hacen más ancha/alta, desalineando el resto de la fila. Se fija el tamaño de todas las cajas y se permite que el nombre haga wrap en varias líneas dentro de la caja, cortando con `…` como último recurso.

## Alcance

- **Solo la vista read-only** de Resultados (`.eliminatorias-view`, `renderEliminatoriasView()` en `js/main.js`).
- **No cambia** la pantalla interactiva de Predicciones de Eliminatorias (tap-to-place), que conserva su `nowrap` + ellipsis de una línea.
- **No cambia** la lógica JS ni los tests.

## Problema raíz

`.drop-slot-name` (`css/styles.css:3920-3932`) usa `white-space: nowrap`. Al ser contenido dentro de una caja flex, un nombre largo fuerza el ancho de la caja; con `aspect-ratio: 1` (`css/styles.css:3889`) también crece su altura, desalineando la fila.

## Diseño

Añadir al final de `css/styles.css`, dentro del bloque del rediseño de eliminatorias (tras las reglas de `.eliminatorias-final-row`):

### 1. Caja fija

```css
.eliminatorias-view .drop-slot {
  min-width: 0;
}
```

`min-width: 0` permite que la caja encoga hasta el ancho de su columna de grid (`repeat(4, 1fr)`) en lugar de ser empujada por el contenido.

### 2. Nombre con wrap (máx 3 líneas)

```css
.eliminatorias-view .drop-slot-name {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
```

- `white-space: normal`: permite varias líneas.
- `overflow-wrap: anywhere` + `word-break: break-word`: palabras muy largas (p.ej. "Mönchengladbach") parten si no caben.
- `-webkit-line-clamp: 3`: máximo 3 líneas; si el nombre las supera, se corta con `…`.
- `overflow: hidden`: la caja nunca crece por el contenido.

### 3. Igual tamaño garantizado

Con `overflow: hidden` en la caja y clamp en el nombre, el contenido ya no puede agrandar la caja: todas quedan cuadradas idénticas (~100px en móvil 480px), coherente con el mockup aprobado del rediseño previo.

## Verificación

- No hay lógica nueva que testear (solo CSS). La suite existente (7 ficheros de test) debe seguir pasando.
- Verificación manual en navegador: vista Eliminatorias en Resultados — todas las cajas del mismo tamaño aunque haya nombres largos; el nombre ocupa 2-3 líneas dentro de la caja y, si no cabe, termina en `…`.
- La pantalla de Predicciones de Eliminatorias mantiene su comportamiento actual (nombre a una línea con ellipsis).
