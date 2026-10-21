# Design: Live v2 — desglose de otro jugador al pulsar su fila

**Fecha:** 2026-10-21
**Rama:** `main` en `porra-spa`
**Estado:** aprobado para implementación

## Resumen

Al pulsar una fila de la clasificación en vivo se abre un modal ligero con el
desglose de ese jugador en los partidos del Live en curso: su pronóstico, los
puntos del pronóstico con sus motivos y los jugadores de su plantilla que
participan en cada partido, con los puntos y conceptos de cada uno. El modal
suma solo puntos del Live, no los oficiales ya cerrados.

Es front-end puro: no hay cambios de backend, scoring, `liveevents`, poll ni
base de datos.

## Objetivos

- Poder consultar los pronósticos de cualquier jugador desde el Live sin salir
  de la pantalla.
- Entender de dónde salen sus puntos live: pronóstico y plantilla, partido a
  partido.
- Reutilizar el cálculo y el lenguaje visual que ya existen para el desglose
  propio.
- Mantener el modal actualizado con el mismo refresco del Live.

## No-objetivos

- Mostrar puntos oficiales ya cerrados ni el total combinado de la porra.
- Mostrar pronósticos de partidos que aún no han empezado.
- Cambiar el modal de perfil existente (`showUserProfileModal`) ni sus tabs.
- Cambiar el cálculo de puntos, el event-sourcing o el backend.
- Añadir comparativas, histórico ni gráficas.

## Decisiones aprobadas

- El modal es de **desglose live rápido**, no el perfil completo.
- Solo incluye los partidos que ya están en el grid del Live: `LIVE`, `HT` y
  `FT`. Los `NS` se excluyen por completo.
- Los puntos mostrados son **solo del Live** (delta del jugador), no
  `officialPoints`.
- El modal se refresca en cada poll mientras está abierto, conservando el
  scroll.
- Las filas del Live pasan a ser interactivas con ratón, Enter y Espacio.

## Contexto actual

- `js/live-v2-ui.js` contiene toda la UI del Live: chips, filas, cabecera,
  modal por partido, polling y cache.
- `liveV2Rows(folded)` genera las filas con `{ name, avatar, livePoints,
  officialPoints, pointsDelta, isMe, rank }` y las ordena con
  `liveV2Api.rankRows`.
- `liveV2RowHtml(r)` pinta cada fila con `data-livev2-row="<nombre>"` dentro de
  `#livev2-rows`. Hoy la fila no es interactiva.
- `liveUserMatchPoints(username, lm, meta)` ya acepta cualquier usuario y
  devuelve `{ matchPts, breakdown, squadPts, squadDetail, total }`, usando
  `AppState.allPredictions[username]` y `AppState.squadsCache[username]`.
- `liveV2OrderedStateEntries(folded)` devuelve los partidos del Live en el
  mismo orden que los chips.
- El modal de partido propio (`openLiveV2MatchModal`) ya implementa overlay,
  cierre con Escape, bloqueo de scroll y refresco con `refreshLiveV2MatchModal`;
  el nuevo modal sigue ese mismo patrón.
- Existen las clases reutilizables `.breakdown-modal-overlay`,
  `.breakdown-modal`, `.breakdown-modal-header`, `.breakdown-modal-title`,
  `.breakdown-modal-content` y `.livev2-modal-*`.

## UX

### Fila interactiva

- Cada `.livev2-row` recibe `role="button"`, `tabindex="0"` y
  `aria-label="Ver desglose de <nombre>, puesto <rank>, <puntos> puntos"`.
- Se añade un indicador visual `›` al final de la fila y `cursor: pointer`.
- Estados `:hover`, `:focus-visible` y `:active` sutiles, sin alterar el layout
  ni las animaciones de reordenación existentes.
- La fila propia (`.me`) también abre el mismo modal.

### Modal

Cabecera con avatar y nombre del jugador, y botón de cierre. Bajo ella:

1. **Resumen**: `Total live` y el reparto `🎯 Pron.` / `👥 Plantilla`.
2. **Partidos**: un bloque por partido del Live, en el orden de los chips:
   - Cabecera: badges, equipos, marcador y estado (`EN JUEGO 63'`, `DESCANSO`,
     `FINAL`).
   - Pronóstico: `Pronóstico X-Y` con `+N pts` y la lista de motivos
     (`8 por acertar resultado`, `3 por goles local`, …). Si no hay pronóstico:
     `Sin pronóstico`.
   - Plantilla: cada jugador con sus puntos y conceptos
     (`Gol · Asistencia · Valoración…`). Si no participa ninguno:
     `Ningún jugador de su plantilla en este partido`.
3. Si el Live no tiene partidos, el modal no se abre y no se muestra nada.

El total del resumen es la suma de `total` de todos los partidos mostrados. Es
el desglose de los partidos del Live, no el delta de la fila ni el total
oficial de la porra: un partido ya finalizado y contabilizado en `matchStats`
puede aparecer aquí y seguir contando en `officialPoints`.

## Arquitectura

### Funciones nuevas en `js/live-v2-ui.js`

- `liveV2PlayerMatches(username, folded)`: recorre
  `liveV2OrderedStateEntries(folded)`, descarta `NS`, construye el `lm` con
  `{ eventId: match.id, stats: folded.statsById[id], status: state.status }`,
  obtiene la meta con `liveMatchMeta`, lee el pronóstico de
  `AppState.allPredictions[username]` (por `match.id` o su clave string), llama
  a `liveUserMatchPoints(username, lm, meta)` y devuelve un array de bloques:
  `{ eventId, meta, status, label, score, prediction, predictionPts,
  predictionBreakdown, squadPts, squadDetail, total }`. `prediction` es
  `{ home, away }` o `null`.
- `liveV2PlayerSummary(matches)`: suma `predictionPts`, `squadPts` y `total`.
- `liveV2PlayerModalHtml(data)`: construye el HTML del modal reutilizando las
  clases `.breakdown-modal*` y `.livev2-modal-*`. Escapa siempre con
  `liveV2Esc`.
- `openLiveV2PlayerModal(username)`: cierra cualquier modal live abierto, crea
  el overlay, guarda foco y overflow, registra Escape y click en el fondo.
- `closeLiveV2PlayerModal()`: elimina overlay, listener y restaura foco y
  scroll, igual que `closeLiveV2MatchModal`.
- `refreshLiveV2PlayerModal()`: recalcula con `liveV2Folded()` y
  `liveV2PlayerMatches`, sustituye el contenido y conserva `scrollTop`. Si el
  jugador ya no está en `visiblePlayers()` o no quedan partidos, cierra.

Estado en `liveV2State()`: `_openPlayerModal` (nombre),
`_playerModalKeyHandler`, `_playerModalReturnFocus` y
`_playerModalPrevOverflow`.

### Eventos

- Un único listener delegado en `#livev2-rows` para `click` y `keydown`
  (Enter/Espacio). Se enlaza una vez, con guard `dataset.bound`, en el mismo
  punto donde hoy se enlazan los chips.
- El listener usa `event.target.closest('[data-livev2-row]')`, de modo que
  sobrevive a las reordenaciones y parcheos de filas.
- No se añaden listeners por fila.

### Refresco

- `refreshLiveV2MatchModal()` se mantiene como está.
- En el mismo punto donde se llama `refreshLiveV2MatchModal()` tras cada
  actualización, se llama también a `refreshLiveV2PlayerModal()`.
- Ambos modales no conviven: abrir uno cierra el otro.

## Estilos

En `css/styles.css`:

- `.livev2-row` gana `cursor: pointer` y transición de fondo.
- `.livev2-row:hover`, `.livev2-row:focus-visible` y `.livev2-row:active`.
- `.livev2-row-chevron` para el `›`.
- `.livev2-player-modal`, `.livev2-player-summary`,
  `.livev2-player-summary-item`, `.livev2-player-match`,
  `.livev2-player-match-head`, `.livev2-player-pred`,
  `.livev2-player-squad`, reutilizando en lo posible `.livev2-modal-*`.
- Respetar `prefers-reduced-motion`: sin transiciones añadidas.

## Accesibilidad

- Overlay con `role="dialog"` y `aria-modal="true"`, título asociado con
  `aria-labelledby`.
- Foco inicial en el botón de cerrar; Escape cierra; al cerrar se devuelve el
  foco a la fila de origen.
- Las filas responden a Enter y Espacio.
- El `aria-label` de cada fila incluye nombre, puesto y puntos:
  `Ver desglose de <nombre>, puesto <rank>, <puntos> puntos`.
- El estado del partido se muestra como texto, no solo por color.

## Casos límite

- Jugador sin pronóstico en un partido: `Sin pronóstico`, 0 pts.
- Jugador sin plantilla o sin jugadores en ese partido: mensaje específico.
- `liveMatchMeta` sin partido en `AppState.matches`: usa el fallback actual.
- Fila de jugador que desaparece de `visiblePlayers()`: el modal se cierra.
- Sin partidos en el Live: no se abre el modal.
- Cambio de jugador mientras el modal está abierto: no ocurre; el overlay
  bloquea la lista. Al cerrar, el foco vuelve a la fila original.

## Tests

Añadir casos a `tests/liveV2Ui.test.js`:

- `liveV2PlayerMatches` devuelve solo `LIVE`, `HT` y `FT`, en orden de kickoff.
- Incluye pronóstico, puntos, motivos y detalle de plantilla de otro usuario.
- Excluye partidos `NS` aunque tengan pronóstico.
- Jugador sin pronóstico devuelve `prediction: null` y 0 pts.
- `liveV2PlayerSummary` suma correctamente pronóstico + plantilla + total.
- `liveV2PlayerModalHtml` contiene nombre, total, partidos, motivos y mensajes
  de vacío, y escapa HTML.
- La fila incluye `role="button"`, `tabindex="0"`, `aria-label` con nombre,
  puesto y puntos, y el chevron.

## Verificación

- `node --check js/live-v2-ui.js`
- `node --test tests/*.test.js` verde en `porra-spa`.
- Revisión manual con `?liveSim=1`: click y teclado abren el modal, el refresco
  mantiene el scroll, Escape y click en el fondo cierran, y el foco vuelve a la
  fila.

## Ficheros afectados

- `js/live-v2-ui.js`
- `js/main.js` (binding de filas y bump de versión)
- `css/styles.css`
- `index.html` (bump de versión de CSS y JS)
- `tests/liveV2Ui.test.js`
