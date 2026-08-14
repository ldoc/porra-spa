# Diseño: Menú «Tus puntos» en la pantalla de Inicio

**Fecha:** 2026-08-14
**Proyecto:** porra-spa

## Contexto

Para ver el desglose propio (pronósticos, plantilla, clasificación y eliminatorias) el usuario debía ir a la pestaña Clasificación y pulsar sobre su fila para abrir el modal de perfil. Este flujo es indirecto y nada descubrible desde Inicio.

Se propone un **menú de acceso rápido** situado en la esquina superior izquierda de la pantalla **Inicio** (`#inicio-container`), activado por un botón con la estrella y los puntos del usuario, que despliega las 4 secciones:

- Pronósticos → `navigateToTab('pronosticos')`
- Plantilla → `navigateToTab('plantilla')`
- Clasificación → `navigateToTab('clasificacion')`
- Eliminatorias → `navigateToTab('final-predictions')`

## Objetivos

1. Acceso directo y de un toque a las 4 secciones del usuario desde Inicio.
2. El botón muestra de forma visible los puntos totales del usuario (misma cifra que la columna **Total** de la pestaña Clasificación).
3. Diseño compacto integrado en el header visual de Inicio (esquina superior izquierda).
4. Un **efecto de parpadeo** sutil llama la atención sobre el botón (para que se descubra), que se detiene al desplegarlo.

## Decisiones acordadas (con el usuario)

- **Botón compacto de 2 líneas**: dentro de la misma píldora, arriba la etiqueta pequeña «TUS PUNTOS» en mayúsculas y debajo `⭐ 123 ▾`.
- **Sin la palabra «pts»**: el número de puntos va solo, junto a la estrella y la flecha.
- **Parpadeo de atención**: halo cian pulsante (`box-shadow`) mientras está cerrado; se detiene al abrir.
- **Desplegable en rejilla compacta 2×2** (no lista vertical), cada celda con su **icono representativo** y acento lateral de color:
  - Pronósticos → reloj, verde `#10B981`
  - Plantilla → grupo de personas, púrpura `#8B5CF6`
  - Clasificación → gráfico de barras, cian `#06B6D4`
  - Eliminatorias → trofeo, dorado `#F59E0B`
- **Número de puntos**: total real igual que la clasificación de usuarios (`realPoints` = Pronósticos + Plantilla + Clasificación + Eliminatorias), no el campo `points` de `/api/players`.
- **Pretemporada**: se muestra siempre el número (0 hasta que haya resultados reales). No se oculta.
- Los iconos usan los mismos SVG `stroke` del bottom-nav (el de Eliminatorias es un trofeo nuevo).

## Cambios propuestos

### 1. HTML / JS — Inyección en `renderInicioTab` (js/main.js:2915)

Prepend al `container.innerHTML` del Inicio, **antes** de `.inicio-welcome`:

```html
<div class="points-menu">
  <button class="points-trigger" id="points-trigger" aria-haspopup="true" aria-expanded="false">
    <span class="points-lbl">Tus puntos</span>
    <span class="points-row">
      <span class="points-star">⭐</span>
      <span class="points-num" id="points-num">${totalRealPoints}</span>
      <span class="points-chev"><svg viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg></span>
    </span>
  </button>
  <div class="points-dropdown" id="points-dropdown" hidden>
    <div class="points-grid">
      <div class="points-tile tile-pronosticos" data-tab="pronosticos">…svg…<span>Pronósticos</span></div>
      <div class="points-tile tile-plantilla"   data-tab="plantilla">…svg…<span>Plantilla</span></div>
      <div class="points-tile tile-clasificacion" data-tab="clasificacion">…svg…<span>Clasificación</span></div>
      <div class="points-tile tile-eliminatorias" data-tab="final-predictions">…svg…<span>Eliminatorias</span></div>
    </div>
  </div>
</div>
```

#### Fuente del número (`totalRealPoints`)

Nueva función auxiliar que replica la lógica de `renderClasificacionTab` (js/main.js:951-984) para el usuario actual:

```js
function getUserTotalRealPoints(username) {
  const userData = calculateUserTotalPoints(username);
  let squadPoints = 0;
  const userSquad = AppState.squadsCache?.[username];
  if (userSquad && userSquad.length) {
    squadPoints = calculateSquadPoints(userSquad, AppState.matchStats).totalPoints;
  }
  let classificationPoints = 0;
  if (AppState.matchStats.length > 0) {
    classificationPoints = calculateClassificationPoints(username).totalPoints;
  }
  let eliminatoriasPoints = 0;
  const userFp = AppState.finalPredictionsCache?.[username];
  if (userFp) {
    eliminatoriasPoints = calculateEliminatoriasPoints(userFp, computeReachedPhases(AppState.matches, AppState.matchStats)).totalPoints;
  }
  return userData.totalPoints + squadPoints + classificationPoints + eliminatoriasPoints;
}
```

- `AppState.squadsCache[currentUser.name]` y `AppState.finalPredictionsCache[currentUser.name]` ya se rellenan (js/main.js:4188 y 5645, y vía `fetchAllPredictions` en js/apiData.js).
- Sin resultados reales (pretemporada), `matchStats` está vacío → devuelve 0, que es el valor mostrado (decisión acordada).
- Como `renderInicioTab` se vuelve a llamar al cambiar de fase (js/main.js:2582) y al navegar a Inicio, el número se refresca con los datos ya cargados sin llamadas extra.

#### Comportamiento (JS)

- **Toggle**: click en `#points-trigger` → alterna `.open`, `aria-expanded`, y `hidden` de `#points-dropdown`.
- **Cerrar al hacer clic fuera**: listener `document` que cierra si el clic no está dentro de `.points-menu`.
- **Cerrar con `Escape`**: listener `keydown`.
- **Navegación**: click en `.points-tile` → `navigateToTab(dataset.tab)` y cerrar el menú. El guard existente de `final-predictions` (js/main.js:2622, «Debes confirmar tus pronósticos de liga primero») se mantiene intacto.
- **Al salir de Inicio** el menú se considera cerrado (estado no persistente; al volver, `renderInicioTab` lo renderiza cerrado).

### 2. CSS (css/styles.css)

Usar las variables del sistema de diseño (`--ucl-card`, `--ucl-surface`, `--ucl-card-hover`, `--accent-cyan`, `--text-secondary`, etc.).

```css
.points-menu { position: relative; align-self: flex-start; }

.points-trigger {
  display: inline-flex; flex-direction: column; align-items: center;
  background: linear-gradient(135deg, var(--ucl-card) 0%, var(--ucl-surface) 100%);
  border: 1px solid rgba(6, 182, 212, 0.4);
  padding: 5px 16px 6px;
  border-radius: var(--radius-full);
  cursor: pointer;
  animation: attentionPulse 2s ease-in-out infinite;
}
@keyframes attentionPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.35), 0 0 18px rgba(6, 182, 212, 0.35); transform: scale(1); }
  50%      { box-shadow: 0 0 0 10px rgba(6, 182, 212, 0), 0 0 4px rgba(6, 182, 212, 0.15); transform: scale(0.99); }
}
.points-trigger.open { animation: none; }

.points-lbl {
  font-size: 0.5rem; font-weight: 700; color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 1.3px; line-height: 1; margin-bottom: 3px;
}
.points-row { display: flex; align-items: center; gap: 7px; font-size: 0.82rem; font-weight: 800; }
.points-num { color: var(--accent-cyan); font-weight: 800; }
.points-chev { color: var(--text-secondary); display: inline-flex; }
.points-chev svg { width: 11px; height: 11px; stroke: currentColor; fill: none; stroke-width: 2.4; transition: transform var(--transition-normal); }
.points-trigger.open .points-chev svg { transform: rotate(180deg); }

.points-dropdown {
  margin-top: 8px; background: var(--ucl-card);
  border: 1px solid var(--border-color); border-radius: var(--radius-md);
  padding: 8px; box-shadow: var(--shadow-card);
  animation: pointsPopIn 0.25s ease-out;
}
@keyframes pointsPopIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

.points-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.points-tile {
  display: flex; align-items: center; gap: 8px;
  background: var(--ucl-surface); border-radius: 10px;
  padding: 9px 8px; min-height: 44px; cursor: pointer;
  border-left: 3px solid transparent;
  transition: background var(--transition-fast);
}
.points-tile:active { background: var(--ucl-card-hover); }
.points-tile svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2; flex-shrink: 0; }
.points-tile span { font-size: 0.66rem; font-weight: 700; line-height: 1.1; }

/* Colores por sección */
.tile-pronosticos   { color: #10B981; border-left-color: #10B981; }
.tile-plantilla     { color: #8B5CF6; border-left-color: #8B5CF6; }
.tile-clasificacion { color: #06B6D4; border-left-color: #06B6D4; }
.tile-eliminatorias { color: #F59E0B; border-left-color: #F59E0B; }
```

> **Nota de toque**: `min-height: 44px` en las celdas respeta la guía de área mínima táctil (AGENTS.md §2) manteniendo la rejilla compacta.

## Accesibilidad

- El gatillo es un `<button>` con `aria-haspopup="true"` y `aria-expanded` sincronizado.
- El desplegable usa `hidden` cuando está cerrado (fuera del tab-order y del AT).
- Las celdas son clicables (div con `data-tab` + listeners); texto mínimo de 0.66rem en contraste suficiente sobre `--ucl-surface`.

## Verificación

1. **Manual**:
   - En Inicio, el botón aparece arriba-izquierda parpadeando y muestra los mismos puntos que la columna Total de la pestaña Clasificación para el propio usuario.
   - Click en el botón → se despliega la rejilla 2×2; la flecha gira 180°; el parpadeo se detiene.
   - Click fuera o `Escape` → se cierra.
   - Cada celda navega a su pestaña correcta (Eliminatorias respeta el guard de confirmación).
   - En pretemporada muestra 0.
   - En escritorio (anchura ≤ 480px) no rompe el layout vertical; sin scroll horizontal.
2. **Cache-busting**: al tocar `css/styles.css` o `js/main.js`, incrementar `v=` en `index.html` (AGENTS.md).
3. **Consola**: sin excepciones al renderizar Inicio ni al navegar.
