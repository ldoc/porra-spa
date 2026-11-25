# Selector de vistas del Live v2: Total / Jornada / En juego

**Fecha:** 2026-11-25
**Estado:** Diseño validado con el usuario (mockups en `.superpowers/brainstorm/1339-1795623701/`)
**Ficheros afectados:** `js/live-v2-ui.js`, `css/styles.css`, `index.html`, `tests/` (nuevo test)
**Backend:** sin cambios

## 1. Motivación

El tab Live v2 muestra hoy una única clasificación: puntos consolidados de todo el torneo
(`officialPoints`: pronósticos + plantilla + clasificación + eliminatorias) **más** el delta
provisional de los partidos en juego. El usuario quiere poder ver, además:

- **Jornada**: solo los puntos generados por los partidos de la **ronda en curso**
  (los ya finalizados y subidos a matchStats **más** los que están ahora en juego).
- **En juego**: solo los puntos de los partidos de la **ventana actual** (p. ej. los de
  las 21:00; antes habría contado los de las 18:45).

Decisiones validadas con el usuario durante el brainstorming:

| Decisión | Elección |
|---|---|
| "Jornada" | Toda la ronda en curso (consolidados + en juego), no solo el día natural |
| "En juego" | Solo partidos LIVE/HT de la ventana actual |
| Orden de la tabla | Re-rank por vista (quién está ganando la jornada / la ventana) |
| Ubicación del selector | Variante A: pills icon-only dentro de la barra de desglose ⚡ Pron./Plantilla |
| Vista por defecto | 🏆 Total |
| Título de sección | Dinámico según vista (ver §3.2) |

## 2. Vistas y qué cuenta cada una

| Vista | Pill | Componentes que suman | Partidos incluidos |
|---|---|---|---|
| **Total** | 🏆 | Pronóstico + plantilla + clasificación + eliminatorias consolidados + delta en juego | Todos (es la clasificación actual) |
| **Jornada** | 📅 | Pronóstico + plantilla de la ronda en curso | Partidos de la ronda con matchStats consolidado **+** partidos de la ronda en juego (provisional) |
| **En juego** | ⚡ | Pronóstico + plantilla | Solo partidos con estado LIVE o HT en el momento del render |

Clasificación y eliminatorias **no** cuentan en Jornada/En juego: no son puntos atribuibles
a una ronda ni a un partido en juego.

## 3. UI

### 3.1 Selector (variante A, validada en mockup a tamaño real 390px)

- Contenedor `.livev2-viewseg`: segmented control de 3 botones icon-only
  (`🏆`, `📅`, `⚡`) situado **dentro de la barra `.livev2-breakdown`**, alineado a la
  derecha (`margin-left:auto`). No añade ninguna línea nueva al layout.
- Cada botón: `min-width:36px; min-height:36px`, `title`/`aria-label` descriptivos
  ("Clasificación total", "Solo puntos de la jornada", "Solo partidos en juego"),
  estado activo con gradiente `--accent-primary` (igual que `.seg button.on` del mockup).
- Botón activo = vista seleccionada. Cambiar de pill NO fuerza re-fetch: se re-renderiza
  a partir del último `folded` disponible.

### 3.2 Título de sección dinámico

`.livev2-section-title` cambia con la vista (misma línea, sin altura extra):

- 🏆 → `CLASIFICACIÓN EN VIVO`
- 📅 → `JORNADA EN VIVO`
- ⚡ → `PARTIDOS EN VIVO`

### 3.3 Desglose de cabecera

La barra `⚡ N · 🎯 Pron. X · 👥 Plantilla Y` refleja **mis puntos en la vista activa**:

- Total: delta en juego (como hoy).
- Jornada: mi pronóstico + plantilla de la ronda (consolidado + en juego).
- En juego: mi pronóstico + plantilla de los partidos LIVE/HT.

### 3.4 Flechas ▲▼ y diff de puntos

- Se calculan dentro de la vista activa: el baseline (`st._lastRows`, que alimenta
  `prevRanks`, el diff `+Npts` y las flechas ▲▼) es siempre el de la vista activa.
- Al cambiar de pill NO hay animación FLIP ni saltos falsos: el baseline de la vista
  destino se **resetea en el instante del cambio** (flechas `=`, diff vacío); la
  primera comparación útil llega con el siguiente poll. Cada vista arranca sus
  comparaciones desde cero, sin contaminación entre vistas.
- El diff `+Npts` de cada fila se refiere al último poll dentro de la misma vista.

### 3.5 Estados deshabilitados

- Pill ⚡ deshabilitada (opacidad + `disabled`) si **nunca** ha habido partidos en juego
  en la sesión actual (`folded.states` sin LIVE/HT y `st.events` vacío).
- Pill 📅 deshabilitada si no hay ronda determinable (pre-liga sin matchStats).
- Si la vista activa "pierde" sus datos a mitad de sesión (p. ej. todos los partidos
  terminan), la vista sigue visible con sus últimos valores congelados a 0 delta — sin
  auto-switch a Total.

## 4. Detección de la ronda en curso (vista Jornada)

Orden de resolución (función pura `liveV2CurrentRoundKey()`):

1. **Partidos con eventos**: partidos con estado ≠ NS en `folded.states` → su `ronda`
   (y `fase`) desde `AppState.matches`. Si hay mezcla (no debería), gana la ronda con más
   partidos.
2. **Fallback**: la última ronda (por `fechaTs` máximo de sus partidos) que tenga
   algún matchStats consolidado.
3. **Fallback final**: partidos con `fecha` de hoy → su ronda.

La ronda se representa como clave `{ fase, ronda }` para que funcione igual en liga
(J1-J8) y en eliminatorias (16/8/4/semis/final). El título de sección siempre es
"JORNADA EN VIVO" (no incluye el número de jornada).

## 5. Cálculo de métricas

### 5.1 Extensión de `liveV2Rows(folded)`

Cada fila pasa a llevar:

```
{
  name, avatar, isMe,
  officialPoints,     // como hoy (liveOfficialRows)
  delta,              // como hoy: partidos no-finalizados con estado ≠ NS (incluye FT sin consolidar)
  deltaInPlay,        // solo partidos con estado LIVE o HT
  jornadaOfficial,    // pronóstico+plantilla consolidados de la ronda en curso (cacheado)
  // métrica activa (según st.viewMode) → livePoints, usada por rankRows
}
```

- **Total**: `livePoints = officialPoints + delta` (comportamiento actual).
- **Jornada**: `livePoints = jornadaOfficial + deltaRonda` (delta limitado a partidos
  de la ronda en curso).
- **En juego**: `livePoints = deltaInPlay`.

`rankRows` sigue ordenando por `livePoints` (la métrica activa ya está volcada ahí),
con desempate alfabético como hoy.

### 5.2 `jornadaOfficial` (cálculo + caché)

- Para cada jugador: puntos de pronóstico de los matchStats cuyo `eventId` pertenece a
  partidos de la ronda en curso (`calculateMatchPoints` por partido, con `preds`) +
  puntos de plantilla (`calculateSquadPoints(squad, subset)` con el subset de matchStats
  de la ronda, ≤18 partidos → barato).
- Caché en `AppState.live` (junto a `officialRows`), invalidada por cambio de:
  clave de ronda, referencia de `AppState.matchStats`, `AppState._allPredictionsTime`
  o `AppState.squadsCache` (patrón idéntico a `liveOfficialRows`).
- NO usa `computeRankingForStats` (hace swap de `AppState.matchStats` y calcula
  clasificación/eliminatorias que aquí no aplican); se calcula directamente sobre el
  subset, sin efectos secundarios.

### 5.3 Vista "En juego" (ventana)

`deltaInPlay` agrega `liveUserMatchPoints` solo de partidos con `status === 'LIVE' || 'HT'`.
Un partido que pasa a FT (aún sin consolidar) sale de esta vista pero sigue contando
en Total/Jornada vía `delta`.

## 6. Estado

```javascript
AppState.liveV2.viewMode   // 'total' (default) | 'jornada' | 'enjuego'
```

- `viewMode` vive en memoria (sobrevive polls y navegación entre tabs, NO persiste en
  localStorage ni en la caché del Live; `AppState.liveV2 = null` en el logout lo resetea).
- El baseline de comparación (`st._lastRows`) es el de la vista activa y se resetea al
  cambiar de pill y en los mismos puntos donde hoy se resetea `st.prevRanks`
  (entrada autoritativa al tab, logout).

## 7. Render e interacción

- `renderLiveV2Html` añade el `.livev2-viewseg` dentro de `.livev2-breakdown` y usa
  `liveV2SectionTitle(viewMode)` para el título.
- `bindLiveV2Views(container)` (delegado, `dataset.view`): cambia `st.viewMode`,
  re-renderiza filas con el último `folded` + título + desglose propio, sin fetch.
- `updateLiveV2Dom` (poll incremental) y la animación FLIP/"elevar 3D" + cartel de
  motivo operan sobre el orden de la vista activa, sin cambios de lógica.
- Sonido de rank: sigue ligado a la fila propia en la vista activa.
- Modo pantalla completa, skeletons, SR (`aria-live`) y sonidos de chip: sin cambios.

## 8. Edge cases

- **Sin partidos en juego** (se abre el Live fuera de horario): Total y Jornada siguen
  funcionando (Jornada muestra lo de la última ronda con matchStats por el fallback);
  ⚡ deshabilitada si nunca hubo eventos en la sesión.
- **Ronda a caballo entre días** (martes/miércoles): consolidados del martes + en juego
  del miércoles, todo dentro de "Jornada".
- **Fase knockout**: misma lógica con clave `{ fase, ronda }`; el delta de eliminatorias
  ya se calcula con `liveUserMatchPoints` (pronóstico incluye tanda de penaltis si el
  backend la envía en el estado).
- **Invitados**: `visiblePlayers()` ya filtra; ninguna vista cambia la política de
  visibilidad.
- **`prefers-reduced-motion`**: sin animaciones nuevas, se hereda el comportamiento.

## 9. Testing

- Nuevo `tests/liveV2Views.test.js` (patrón de `tests/liveV2Ui.test.js`, `node --test`):
  - Selección de métrica por vista (total/jornada/enjuego) con fixtures de
    matchStats/estados/squads.
  - `liveV2CurrentRound()`: ronda desde estados, fallbacks.
  - `prevRanksByView`: flechas por vista sin contaminación cruzada al cambiar de pill.
  - Título y desglose de cabecera por vista.
- Verificación completa: `node --test tests/*.test.js`.

## 10. Cache-busting

`index.html` (regla de AGENTS.md):

- `js/live-v2-ui.js?v=32` → `v=33`
- `css/styles.css?v=140` → `v=141`
- `js/main.js` → solo si se toca (no está previsto).

## 11. Fuera de alcance

- Cambios de backend / nuevos endpoints.
- Persistencia de la vista entre sesiones (localStorage).
- Desglose por ventana horaria (18:45 vs 21:00) como cuarta vista.
