# Design: Live v2 — notas, puestos, diferencial de puntos, desglose y popup por partido

**Fecha:** 2026-10-20
**Rama:** `main` en `porra-spa`
**Estado:** aprobado para implementación

## Resumen

Siete cambios sobre el Live v2, todos front-end:

1. **Ocultar los eventos de cambio de nota** del ticker de últimos eventos.
2. **Movimiento de puestos visible 30 s**: junto al número de puesto se muestra
   `▲N`, `▼N` o `=` cuando no cambia o ya pasaron los 30 s.
3. **Diferencial de puntos por refresco**: nueva columna con `+5pts`, `-2pts` o
   `0pts` respecto al poll anterior, independiente del movimiento de puestos.
   La caja del jugador se tiñe de verde o rojo durante ese refresco, con
   animación, si sus puntos suben o bajan.
4. **Desglose en la cabecera superior**: puntos del Live en curso separados en
   pronósticos y plantilla.
5. **Popup por partido**: al pulsar un chip se abre el desglose del usuario para
   ese partido, con pronóstico y plantilla, también en NS.
6. **Pronóstico en el chip**: línea compacta `Tú 2-1` (o `S/P`) siempre visible.
7. **Color de los chips al cambiar el marcador**: verde, rojo o azul parpadeante
   durante el poll según si el cambio suma, resta o no afecta a tus puntos.

No hay cambios de backend, scoring, event-sourcing ni base de datos.

## Objetivos

- El ticker no muestra ruido de notas de jugadores.
- El usuario ve de forma clara e inmediata si ha subido o bajado puestos, y
  cuántos, durante 30 s.
- El usuario ve cuántos puntos ha ganado o perdido en el último refresco, sin
  confundirlo con el movimiento de puestos.
- La caja del jugador refuerza visualmente si sus puntos han subido o bajado,
  con una animación de color durante ese poll.
- Los chips de partido avisan del cambio de marcador con un color semántico
  (verde/rojo/azul) y parpadeo durante el poll.
- La cabecera explica de dónde salen los puntos live del usuario.
- Cada partido del Live ofrece su desglose completo (pronóstico + plantilla)
  sin salir de la pantalla.
- El pronóstico propio queda visible en el propio chip del partido.

## No-objetivos

- Cambiar el backend, `liveevents`, el poll o el cálculo de puntuación.
- Mostrar desgloses de otros usuarios.
- Añadir histórico de posiciones más allá de los 30 s.
- Cambiar el sonido o el cartel de motivo por los cambios de nota (solo se
  ocultan del ticker).

## Decisiones aprobadas

- El desglose de cabecera es **solo del Live en curso**, no los totales
  oficiales de la porra.
- El indicador `▲/▼/=` va **junto al número de puesto**.
- El diferencial de puntos se calcula **desde el refresco anterior**, no contra
  los puntos oficiales ni contra el total live acumulado.
- El color de la caja dura **hasta el siguiente refresco**: verde si suma,
  rojo si resta y sin color si no cambia.
- El color del chip se calcula con el delta de puntos del usuario en ese
  partido: verde si suma, rojo si resta y azul si no cambia.
- El pulso del chip dura **hasta el siguiente refresco** y sustituye al glow
  verde genérico de 10 s.
- Las notas se ocultan **solo del ticker**; el motivo y el sonido no cambian.
- El pronóstico del chip se muestra **siempre** (NS, LIVE, HT y FT).
- El popup se abre **también en NS**, con pronóstico y plantilla a 0 pts.

## Contexto actual

- `js/live-v2-ui.js` contiene la UI del Live: chips, feed, cabecera, filas,
  modal de motivo, polling y cache.
- `liveV2FeedItems()` filtra `lineup` y `status`; hoy deja pasar `rating`.
- `liveV2RowHtml()` pinta una flecha derecha con el delta de puesto que
  devuelve `rankRows()` (`delta = prevRank - rank`). Esa flecha se sustituye
  por el badge junto al puesto y por la nueva columna de puntos.
- `liveUserMatchPoints(username, lm, meta)` ya calcula, por partido:
  `matchPts`, `breakdown`, `squadPts`, `squadDetail` y `total`.
- `AppState.allPredictions[usuario][eventId]` contiene `{ home, away }`.
- `AppState.squadsCache[usuario]` contiene la plantilla.
- `liveV2Rows()` suma al total oficial el delta de los partidos plegados que
  aún no están en `AppState.matchStats`.
- `liveV2DetectChipChanges()` compara el marcador entre polls y aplica el glow
  verde de 10 s (`.livev2-cell.changed`); ese glow se sustituye por el pulso
  semántico de la sección 4.
- Existen estilos reutilizables `.breakdown-modal-overlay` y
  `.breakdown-modal`.

## 1. Ticker sin eventos de nota

`liveV2FeedItems()` añade `rating` a la lista de tipos excluidos:

```js
.filter(e => !['lineup', 'status', 'rating'].includes(e.type))
```

- El resto de eventos no cambia.
- `liveV2ReasonHtml`/`liveV2MoverReason` no se tocan.
- El sonido no se toca.
- Si un poll solo trae notas, el ticker mantiene los últimos eventos anteriores.

## 2. Movimiento de puestos durante 30 s

### 2.1 Estado

En `AppState.liveV2`:

```js
_rankMoves: {
  [nombre]: { delta: number, at: number }
}
```

- `delta > 0`: ha subido puestos (`prevRank - rank`).
- `delta < 0`: ha bajado puestos.
- `at`: `Date.now()` del poll en que se detectó el cambio.

### 2.2 Detección

En cada actualización, comparar las filas nuevas con las anteriores
(`prevByName`, ya disponible en `updateLiveV2Dom`):

- Si `prev.rank !== row.rank`, guardar
  `{ delta: prev.rank - row.rank, at: Date.now() }`.
- Si no cambia, conservar la entrada anterior hasta que caduque.
- En el render inicial no hay anterior: todas las filas muestran `=`.

### 2.3 Visualización

La fila pasa de:

```html
<span class="livev2-rank">3</span>
...
<span class="livev2-arrow">▲2</span>
```

a:

```html
<span class="livev2-rank-group">
  <span class="livev2-rank">3</span>
  <span class="livev2-rank-move up" aria-label="Sube 2 puestos">▲2</span>
</span>
```

- `up` → `▲N` (verde).
- `down` → `▼N` (rojo).
- `eq` → `=` (atenuado).
- El indicador se muestra si `Date.now() - at < 30000`; si no, `=`.
- Un temporizador (`liveV2ScheduleRankMoveExpiry`) actualiza a `=` al cumplirse
  los 30 s sin esperar al siguiente poll. Si hay un cambio nuevo antes de
  caducar, se guarda el nuevo `delta`/`at` y se reprograma el temporizador.
- Se elimina la flecha derecha (`.livev2-arrow`) para no duplicar el dato; la
  columna deja de reservar espacio.

### 2.4 Accesibilidad

- `aria-label` textual: “Sube 2 puestos”, “Baja 1 puesto”, “Sin cambios”.
- El color no es el único indicador: siempre hay símbolo y texto accesible.

## 3. Diferencial de puntos por refresco

### 3.1 Cálculo

En `updateLiveV2Dom`, comparar los puntos live de cada fila con los del poll
anterior (`prevByName`):

```js
diff = row.livePoints - prev.livePoints
```

- `diff > 0`: el usuario ha sumado puntos en este refresco.
- `diff < 0`: ha restado puntos.
- `diff === 0`: sin cambios.
- En el render inicial o al volver a entrar al tab no hay anterior: `0pts`.
- El valor se mantiene visible hasta el siguiente poll; si en el siguiente no
  hay cambios, pasa a `0pts`.

No se usa `pointsDelta` (acumulado live contra el oficial) para esta columna.

### 3.2 UI

Nueva columna al final de la fila, tras los puntos totales:

```html
<span class="livev2-pts-diff up">+5pts</span>
```

- `up` → `+5pts` (verde).
- `down` → `-2pts` (rojo).
- `eq` → `0pts` (atenuado).
- Ancho fijo y alineación derecha para que los valores queden alineados.
- Se actualiza en sitio en cada poll, sin recrear la fila.
- No hay temporizador de 30 s: el valor corresponde al último refresco.

### 3.3 Color de la caja

La caja de la fila (`.livev2-inner`) refleja el mismo diferencial del refresco:

- `diff > 0` → clase `points-up`: fondo y borde con tinte verde.
- `diff < 0` → clase `points-down`: fondo y borde con tinte rojo.
- `diff === 0` → sin clase: se mantiene el color normal de la fila.
- El color se mantiene **durante todo el poll**, hasta el siguiente refresco.
- Al cambiar el estado se aplica una animación corta (~0.8 s) que intensifica
  el tinte y el glow y vuelve al color de reposo del estado.
- Si el usuario ya tenía `points-up` y sigue subiendo en el siguiente poll, se
  retira la clase, se fuerza un reflow y se vuelve a aplicar para reiniciar la
  animación.
- Si no hay cambio, se retiran ambas clases y la caja vuelve a su color normal.
- Los estados de movimiento de puesto (`▲/▼`) y de puntos (`verde/rojo`) son
  independientes y pueden coincidir en la misma fila.
- Con `prefers-reduced-motion`, el color se aplica igual pero sin animación.

### 3.4 Accesibilidad

- `aria-label` textual: “Suma 5 puntos en este refresco”, “Resta 2 puntos en
  este refresco”, “Sin cambios de puntos”.
- El signo y el texto `pts` están siempre presentes, no solo el color.
- El color de la caja es un refuerzo visual; la información sigue disponible
  en la columna de diferencial.

## 4. Color de los chips al cambiar el marcador

### 4.1 Cálculo

- Mantener en `AppState.liveV2._chipUserPoints[eventId]` los puntos live del
  usuario actual (pronóstico + plantilla) en ese partido durante el poll
  anterior.
- En cada poll, comparar el marcador con `_chipScores` (ya existente).
- Si el marcador cambió:
  - `delta = puntosActuales - puntosAnteriores`.
  - `fav` si `delta > 0`.
  - `hurt` si `delta < 0`.
  - `neutral` si `delta === 0`.
- Si no hay usuario o no hay puntos anteriores, el estado es `neutral`.
- Guardar `{ state, at }` en `AppState.liveV2._chipPulse[eventId]`.
- Si no hay cambio de marcador en el poll, retirar el pulso del chip.
- Los puntos se calculan con `liveUserMatchPoints()` y el estado plegado actual,
  igual que la clasificación y la cabecera.

### 4.2 UI

- Se sustituye el glow verde genérico de 10 s (`.livev2-cell.changed`) por:
  - `.livev2-cell.score-fav`: borde, fondo y glow verdes, parpadeando.
  - `.livev2-cell.score-hurt`: borde, fondo y glow rojos, parpadeando.
  - `.livev2-cell.score-neutral`: borde, fondo y glow azules, parpadeando.
- El pulso dura **todo el poll**, hasta el siguiente refresco:
  - Si el siguiente poll no trae cambio de marcador, se retira.
  - Si vuelve a cambiar, se actualiza el color según el nuevo delta.
- Animación de parpadeo (~1 s, `infinite alternate`) sobre borde, fondo y glow,
  sin mover el layout ni cambiar el tamaño del chip.
- Se mantiene el orden actual de chips cambiados al frente; el pulso no altera
  el orden.
- Con `prefers-reduced-motion`: color fijo, sin parpadeo.
- El `title` y el `aria-label` del chip añaden el efecto: “marcador cambiado,
  sumas puntos”, “marcador cambiado, restas puntos” o “marcador cambiado, sin
  efecto en tus puntos”.

## 5. Desglose en la cabecera superior

### 5.1 Cálculo

Nuevo helper `liveV2HeaderBreakdown(folded)`:

- Usuario actual = `AppState.currentUser.name`.
- Recorrer los partidos plegados que aún no están en `AppState.matchStats`
  (misma condición que `liveV2Rows`).
- Ignorar `status === 'NS'`.
- Por partido, llamar a `liveUserMatchPoints(usuario, lm, meta)`.
- Acumular:
  - `predictionPts += matchPts`
  - `squadPts += squadPts`
  - `total = predictionPts + squadPts`

Sin sesión: `{ predictionPts: 0, squadPts: 0, total: 0 }`.

### 5.2 UI

Nueva fila compacta dentro de `.livev2-fixed`, debajo de la fila de estado:

```text
⚡ 42   🎯 Pron. 12   👥 Plantilla 30
```

- `⚡` muestra el total live (pronóstico + plantilla).
- `🎯 Pron.` y `👥 Plantilla` muestran el desglose.
- Se retira el total de `.livev2-status-right` para no duplicarlo; allí quedan
  countdown, pantalla completa y sonido.
- En móvil la fila puede envolver (`flex-wrap`) sin romper el layout.
- Si no hay usuario o no hay partidos live, muestra `0` en los tres valores.

## 6. Popup de desglose por partido

### 6.1 Apertura

- Los chips pasan a ser interactivos: `role="button"`, `tabindex="0"` y
  `aria-label` con el título del partido.
- Delegación de click en `#livev2-chips-host` mediante
  `bindLiveV2Chips(root)`.
- Enter y Espacio abren el mismo popup.
- Se llama a `bindLiveV2Chips` al renderizar el tab Live y al reintentar.
- Se guarda el `eventId` abierto en `AppState.liveV2._openMatchModal`.

### 6.2 Contenido

Se reutiliza la estructura de `.breakdown-modal-overlay` / `.breakdown-modal`
con una clase adicional `.livev2-match-modal`.

Cabecera:

- Equipos y badges.
- Marcador actual y estado (`NS`, `LIVE 63'`, `HT`, `FT`).
- Total del usuario en ese partido.

Sección **Pronóstico**:

- Marcador pronosticado: `Tú 2-1`.
- Puntos y desglose (`8 por acertar resultado`, `3 por goles local`, …).
- Si no hay pronóstico: “Sin pronóstico”.
- En NS: 0 pts y aviso “El partido aún no ha empezado”.

Sección **Plantilla**:

- Jugadores del usuario que aparecen en `lm.stats.jugadores`, con nombre,
  puntos y conceptos del desglose.
- Si no hay ninguno: “Ningún jugador de tu plantilla en este partido”.
- En NS: lista con 0 pts o aviso equivalente.

### 6.3 Datos

Nuevo helper `liveV2MatchBreakdown(eventId, state)` que devuelve:

```js
{
  meta, status, score, label,
  prediction: { home, away } | null,
  predictionPts, predictionBreakdown,
  squadPts, squadDetail,
  total
}
```

Se apoya en `liveUserMatchPoints()` y en las predicciones del usuario actual,
sin recalcular reglas de puntuación.

### 6.4 Cierre y refresco

- Cierre con ✕, click en el overlay y tecla Escape.
- Si el popup está abierto durante un poll, se refresca su contenido con el
  estado plegado nuevo (`refreshLiveV2MatchModal`).
- El foco vuelve al chip que lo abrió.
- Se bloquea el scroll del body mientras está abierto, igual que otros modales.

## 7. Pronóstico en el chip

### 7.1 Contenido

- `liveV2ChipData()` añade `predictionText`:
  - Con pronóstico: `Tú 2-1`.
  - Sin pronóstico: `S/P`.
- Se obtiene de `AppState.allPredictions[usuario][eventId]` usando el usuario
  actual.

### 7.2 UI

- El texto se integra en la línea de estado del chip para no añadir otra fila:

```text
LIVE 63' · Tú 2-1
```

- En NS: `NS · Tú 2-1`.
- Clase `.livev2-cell-pred`, atenuada y con `font-variant-numeric: tabular-nums`.
- `patchLiveV2Chip()` actualiza el texto sin recrear el nodo.
- Si no hay usuario, se muestra `S/P`.

## 8. Arquitectura y archivos

- `js/live-v2-ui.js`
  - Filtro `rating` en `liveV2FeedItems`.
  - `_chipUserPoints` y `_chipPulse` en el estado del Live; cálculo del delta de
    puntos por partido en `liveV2DetectChipChanges`/`updateLiveV2Dom`.
  - Estado y helpers de movimiento de puestos.
  - `liveV2RowHtml` y `updateLiveV2Dom` con el badge de puesto y la columna
    de diferencial de puntos.
  - `liveV2HeaderBreakdown` y `liveV2HeaderBreakdownHtml`.
  - `liveV2MatchBreakdown`, `liveV2MatchModalHtml`, apertura/cierre/refresco.
  - `bindLiveV2Chips` exportado en la API.
  - `liveV2ChipData`/`liveV2ChipHtml`/`patchLiveV2Chip` con el pronóstico y las
    clases de pulso semántico.
- `js/main.js`
  - Llamar a `liveV2Ui.bindLiveV2Chips(container)` en el render del tab Live.
- Temporizadores
  - `stopLiveV2Polling` limpia también el temporizador de caducidad de puestos.
  - El popup se cierra al salir del tab Live.
- `css/styles.css`
  - `.livev2-rank-group`, `.livev2-rank-move.up/.down/.eq`.
  - `.livev2-pts-diff.up/.down/.eq` y el ajuste de anchos de la fila.
  - `.livev2-row.points-up > .livev2-inner` y
    `.livev2-row.points-down > .livev2-inner`, con sus `@keyframes` y la
    variante `prefers-reduced-motion`.
  - `.livev2-cell.score-fav`, `.score-hurt` y `.score-neutral`, con su
    `@keyframes` de parpadeo y la variante `prefers-reduced-motion`.
  - `.livev2-breakdown` y sus segmentos.
  - `.livev2-cell-pred`.
  - Ajustes de `.livev2-match-modal` reutilizando los estilos de modal.
- `tests/liveV2Ui.test.js`
  - Nuevos tests de feed, puestos, diferencial de puntos, cabecera, chip y popup.

## 9. Casos límite

- Sin usuario: cabecera a 0, chip `S/P` y popup con el mensaje “Inicia sesión
  para ver tu desglose”; no se muestran datos personales.
- Partido NS: popup completo, puntos 0 y aviso.
- Partido sin pronóstico: “Sin pronóstico”; la plantilla se muestra igual.
- Partido sin jugadores del usuario: mensaje específico.
- Partido ya oficial (`AppState.matchStats`): no suma en la cabecera live; el
  popup sigue mostrando el desglose live si el chip existe.
- Cambio de puesto seguido de otro cambio antes de 30 s: prevalece el último
  delta y se reinicia el contador.
- Refresco sin cambios: el diferencial de puntos pasa a `0pts`, la caja vuelve
  a su color normal; el badge de puesto conserva su movimiento hasta caducar.
- Cambio de puntos en un poll y nuevo cambio en el siguiente: se reinicia la
  animación de color con el nuevo signo.
- Varios cambios de puntos seguidos: la columna muestra solo el neto del último
  refresco, no la suma histórica.
- Cambio de puesto sin cambio de puntos: `▲/▼` puede aparecer junto a `0pts`.
- Cambio de puntos sin cambio de puesto: `=` puede aparecer junto a `+5pts`.
- Cambio de marcador que suma puntos: chip verde parpadeando durante el poll.
- Cambio de marcador que resta puntos: chip rojo parpadeando durante el poll.
- Cambio de marcador sin efecto neto (o sin usuario): chip azul parpadeando.
- Varios cambios de marcador en un mismo partido dentro del poll: prevalece el
  delta neto y el color correspondiente.
- Cambio de marcador seguido de un poll sin cambios: el pulso desaparece y el
  chip recupera su color normal.
- Poll sin cambios: el badge conserva el último movimiento hasta caducar.
- Pestaña oculta o poll pausado: no se alteran los badges; el temporizador de
  30 s sigue su curso.
- Modal abierto y partido que desaparece del fold: se cierra automáticamente.

## 10. Testing

- Unitarios en `tests/liveV2Ui.test.js`:
  - `liveV2FeedItems` excluye `rating` y mantiene el resto.
  - Movimiento de puestos: sube, baja, `=`, caducidad a 30 s y reinicio.
  - Diferencial de puntos: `+`, `-`, `0`, inicial y neto entre polls.
  - Clases de color de la caja: `points-up`, `points-down`, sin clase en `0` y
    reinicio de la animación al repetir cambio.
  - Pulso de chips: `score-fav`, `score-hurt`, `score-neutral`, retirada en el
    siguiente poll sin cambio y caso sin usuario.
  - `liveV2HeaderBreakdown` separa pronóstico y plantilla y excluye oficiales.
  - Chip con pronóstico y sin pronóstico.
  - HTML del popup con pronóstico, desglose, plantilla y caso NS.
- Ejecutar `node --test tests/` y comprobar que no hay regresiones.
- Comprobación manual en local: chips clicables, popup, cabecera, ticker sin
  notas, badges de puesto, columna de diferencial, color animado de la caja y
  parpadeo verde/rojo/azul de los chips al cambiar el marcador.
