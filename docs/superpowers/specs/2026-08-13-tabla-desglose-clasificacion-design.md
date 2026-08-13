# Diseño: Tabla de desglose de puntos en Clasificación (C2 final)

**Fecha:** 2026-08-13
**Proyecto:** porra-spa

## Contexto

En la pestaña Clasificación, modo post-freeze, cada participante se muestra como una fila con badge de posición, avatar, nombre y, debajo del nombre, el desglose de puntos como texto plano:

```
(145 pronósticos + 181 plantilla + 60 clasificación + 12 eliminatorias)
```

Este texto se construye en `renderClasificacionTab()` (js/main.js:957-977) con `breakdownParts` y se renderiza en `.player-breakdown` (js/main.js:972). El total aparece a la derecha en `.player-points`.

Problema: el desglose en texto es difícil de leer y comparar entre jugadores. Se quiere presentar el desglose y el total como una **tabla con cabecera**: cada usuario una fila con **5 columnas de valores** (Pronósticos, Plantilla, Clasificación, Eliminatorias, Total).

## Objetivos

1. Mostrar el desglose + total en formato tabla: cabecera sticky + 1 fila por usuario con 5 columnas.
2. Cabecera siempre visible al hacer scroll.
3. Badges de color (oro/plata/bronce) para los 3 primeros, como en la clasificación actual (`.rank-1/2/3`).
4. Nombres de usuario largos en 1-2 líneas sin cortarse (`word-break`).
5. Total resaltado en verde (accent) y negrita; resto de valores en gris claro.
6. Mantener: fila clickable → `showUserProfileModal`, resaltado del usuario actual, modo pre-freeze sin cambios.

## Decisiones acordadas

- **Diseño elegido**: C2 final validado en mockups de navegador (docs visuales en `.superpowers/brainstorm/`).
- **Estructura**: cabecera sticky de 6 columnas `Jugador | Pron | Plant | Clas | Elim | Total`, seguida de una fila por usuario con el mismo grid (6 columnas: identidad + 5 valores).
- **Identidad de fila**: badge de posición (círculo) + avatar + nombre (wrap 1-2 líneas).
- **Valores**: siempre se muestran los 5 (0 si no hay puntos aún) para mantener la alineación. El total en `--accent-primary` y `font-weight: 800`; el resto en `--text-secondary`.
- **Badges podio**: reutilizar `.rank-1/2/3` existentes; añadir `.rank-n` (gris neutro) para el resto de posiciones.
- **User actual**: mantener `.current-user` (borde verde izquierdo + fondo sutil).
- **Se elimina** `.player-breakdown` del post-freeze (el desglose pasa a la tabla).
- **Pre-freeze**: sin cambios (solo nombres, no clickable salvo el propio usuario).

## Cambios propuestos

### 1. JavaScript — funciones puras de construcción de HTML (js/main.js)

Nuevas funciones puras (testables con el patrón espejo de `tests/`):

```js
/** Devuelve el class del badge de posición */
function getRankBadgeClass(rank) {
  if (rank === 1) return 'rank-1';
  if (rank === 2) return 'rank-2';
  if (rank === 3) return 'rank-3';
  return 'rank-n';
}

/** Cabecera de la tabla de clasificación (6 columnas) */
function buildClasificacionHeader() {
  return `
    <div class="clasificacion-header">
      <span>Jugador</span><span>Pron</span><span>Plant</span><span>Clas</span><span>Elim</span><span>Total</span>
    </div>`;
}

/** Fila de usuario con desglose: identidad + 5 valores alineados */
function buildClasificacionRow(p, rank, isMe) {
  return `
    <div class="clasificacion-row ${isMe ? 'current-user' : ''}" onclick="showUserProfileModal('${p.name}')">
      <div class="clasificacion-id">
        <div class="rank-pill ${getRankBadgeClass(rank)}">${rank}</div>
        <span class="player-avatar">${p.avatar}</span>
        <span class="clasificacion-name">${p.name}${isMe ? ' <span class="clasificacion-you">(Tu)</span>' : ''}</span>
      </div>
      <span class="clasificacion-val">${p.predictionPoints}</span>
      <span class="clasificacion-val">${p.squadPoints}</span>
      <span class="clasificacion-val">${p.classificationPoints}</span>
      <span class="clasificacion-val">${p.eliminatoriasPoints}</span>
      <span class="clasificacion-val clasificacion-total">${p.realPoints}</span>
    </div>`;
}
```

### 2. JavaScript — template de `renderClasificacionTab` (js/main.js:957-977)

En el bloque post-freeze, sustituir `playersWithPoints.map(...)` por:

```js
container.innerHTML =
  buildClasificacionHeader() +
  playersWithPoints.map((p, i) => {
    const rank = i + 1;
    const isMe = AppState.currentUser && p.name === AppState.currentUser.name;
    return buildClasificacionRow(p, rank, isMe);
  }).join('');
```

- Eliminar las variables `breakdownParts` / `breakdownStr` (js/main.js:960-965).
- Eliminar el uso de `.player-breakdown` y `.player-points` en esta sección (el total pasa a la 5ª columna).

### 3. CSS — estilos de la tabla (css/styles.css)

Añadir al final de `css/styles.css` (reutilizando variables `:root` existentes):

```css
/* Tabla de desglose en Clasificación (C2) */
.clasificacion-header {
  display: grid;
  grid-template-columns: 1fr repeat(5, 40px);
  gap: 4px;
  align-items: center;
  padding: 8px 10px;
  background: var(--ucl-card);
  border-bottom: 1px solid var(--border-color);
  position: sticky;
  top: 0;
  z-index: 2;
}
.clasificacion-header span {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--text-muted);
  text-align: right;
}
.clasificacion-header span:first-child { text-align: left; }

.clasificacion-row {
  display: grid;
  grid-template-columns: 1fr repeat(5, 40px);
  gap: 4px;
  align-items: center;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-color);
  cursor: pointer;
}
.clasificacion-row:last-child { border-bottom: none; }
.clasificacion-row.current-user {
  background: rgba(16, 185, 129, 0.12);
  border-left: 4px solid var(--accent-primary);
}

.clasificacion-id {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.clasificacion-name {
  font-weight: 600;
  font-size: 10.5px;
  line-height: 1.25;
  overflow-wrap: break-word;
  word-break: break-all;
}
.clasificacion-you { color: var(--accent-primary); }
.clasificacion-val {
  text-align: right;
  font-weight: 700;
  font-size: 11px;
  color: var(--text-secondary);
}
.clasificacion-total {
  color: var(--accent-primary);
  font-weight: 800;
  font-size: 12px;
}

.rank-pill {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 10px;
}
.rank-1 { background: #F59E0B; color: #000; }
.rank-2 { background: #94A3B8; color: #000; }
.rank-3 { background: #B45309; color: #fff; }
.rank-n { background: rgba(148, 163, 184, 0.15); color: var(--text-secondary); }
```

Nota: `.rank-1/2/3` ya existen (css/styles.css:774-776); se mantienen. Se añade `.rank-pill` (base de tamaño) y `.rank-n`.

### 4. Cache-busting

Incrementar versiones en `index.html` (norma de AGENTS.md):
- `css/styles.css?v=51` → `?v=52`
- `js/main.js?v=73` → `?v=74`

### 5. Tests

Nuevo fichero `tests/clasificacionTable.test.js` (patrón de espejo de función pura + assert):

- `getRankBadgeClass(1|2|3|4)` → `rank-1` / `rank-2` / `rank-3` / `rank-n`.
- `buildClasificacionHeader()` incluye las etiquetas `Jugador`, `Pron`, `Plant`, `Clas`, `Elim`, `Total` y la clase `clasificacion-header`.
- `buildClasificacionRow(user, 1, false)` incluye el nombre, los 5 valores y las clases `clasificacion-row`, `clasificacion-total` y `rank-1`; no incluye `current-user`.
- `buildClasificacionRow(user, 2, true)` incluye `current-user` y `(Tu)`.
- Los 5 valores se muestran siempre (con 0 si el jugador no tiene puntos), p.ej. `buildClasificacionRow` con `predictionPoints: 0` incluye un `0` en la columna Pron.

Ejecución: `node tests/clasificacionTable.test.js`.

## Validación manual

1. Abrir `index.html` con vista móvil vertical (o `python3 -m http.server 8000`).
2. Modo post-freeze (fecha actual > `championsFreezeDate`): se ve cabecera sticky `Jugador | Pron | Plant | Clas | Elim | Total`.
3. Los 3 primeros con badge oro/plata/bronce; resto gris.
4. Nombres largos en 1-2 líneas (word-break), sin cortar.
5. Total en verde a la derecha; valores de desglose alineados.
6. Al hacer scroll, la cabecera permanece visible.
7. Clic en cualquier fila abre el modal de perfil del usuario.
8. El usuario actual se resalta (borde verde + fondo sutil).
9. Modo pre-freeze: sigue mostrando solo nombres sin puntos.

## Fuera de alcance

- Cambiar el cálculo de puntos (`calculateUserTotalPoints`, `calculateSquadPoints`, `calculateClassificationPoints`, `calculateEliminatoriasPoints`).
- Cambiar el modal de perfil (`showUserProfileModal`) ni sus pestañas.
- Cambiar la pestaña de Resultados ni `renderLeaderboard` (js/main.js:4259, contenedor sin usar).
- Optimizar el rendimiento del cálculo por usuario (listado en `docs/rendimiento-analisis.md`, acción 9) — tarea separada.
