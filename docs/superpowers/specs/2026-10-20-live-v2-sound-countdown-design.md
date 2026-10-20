# Design: Live v2 — sonidos por efecto en tus puntos, countdown y motivo real

## Resumen

Tres mejoras sobre el Live v2, solo front-end:

1. **Sonido ligado a tus puntos**, no al goleador: cualquier evento nuevo que
   suba o baje tus puntos del partido suena con tono bueno/malo. Un gol que no
   cambia nada tiene su tono neutro propio; el resto de eventos neutros callan.
   Se recuperan los tonos de la v1 y se añade un tono malo.
2. **Countdown circular** hasta el siguiente poll (opción C), junto al badge
   de estado, con pausa cuando no hay partidos en juego.
3. **Motivo real del cambio**: el cartel muestra el evento o eventos que
   realmente mueven tus puntos (hasta 3 líneas, con su delta y el total), no
   un evento de plantilla o el último del poll.

## Objetivos

- Recuperar el criterio v1: el sonido refleja el efecto del evento en **tus
  puntos**, no si el jugador está en tu plantilla.
- Que **cualquier** evento pueda sonar si mueve puntos (asistencia, penalti
  parado, roja, nota, cambio, corrección, final…), no solo los goles.
- Un solo sonido por partido/poll según el efecto neto (opción 2).
- Gol neutro (no cambia puntos) con tono propio; evento neutro que no es gol,
  silencio.
- Que el motivo del cambio de posición muestre los eventos que de verdad
  explican el cambio de puntos del usuario protagonista, con su efecto real.
- Countdown claro, compacto y sin fugas de timers.

## No-objetivos

- Cambiar el intervalo de poll (`liveRefreshSecs`) o el backend.
- Sonidos específicos por tipo de evento más allá de bueno/malo/neutro.
- Cambiar el scoring, el event-sourcing o la clasificación.
- Historial de sonidos, notificaciones push o vibración distinta por evento
  (se mantiene la vibración de los tonos que la tenían).

## Contexto

- **v1** (`487223c^:js/main.js:2218`): `isMine` de un gol =
  `afterById[eventId] > beforeById[eventId]`, es decir, si tus puntos de ese
  partido subían en el poll. Tonos en `js/sound.js` (idénticos a los actuales).
- **v2 actual** (`js/live-v2-ui.js:232-241`): `liveV2GoalIsMine` comprueba si
  el goleador está en `AppState.squadsCache[yo]`. Solo suenan goles y
  ranking/estado; asistencias, penaltis, rojas o notas no suenan.
- **Motivo actual** (`js/live-v2-ui.js:1040-1083`): elige el evento más
  reciente de la **plantilla** del usuario protagonista; si no hay, el evento
  relevante más reciente del poll. No comprueba qué evento movió los puntos.
  `substitution`, `score` y `match_final` no tienen `playerId`, así que solo
  pueden salir como fallback.
- El poll v2 ya calcula `liveUserMatchPoints` por partido (pronóstico +
  plantilla); el estado plegado está en `st.events`.

## Decisiones

- **Criterio:** delta de tus puntos del partido antes/después de cada evento.
- **Sonido:** un tono por partido/poll según el efecto **neto** (opción 2).
- **Motivo:** hasta 3 eventos con delta ≠ 0, ordenados por impacto, en varias
  líneas, más el total del poll (opción 2).
- **Gol neutro:** si el neto es 0 y el partido trae al menos un gol, suena el
  tono neutro v1. Si el neto es 0 y no hay gol, silencio.
- **Countdown:** opción C, anillo SVG de ~20 px junto al badge.
- **Tonos v1** se conservan; se añade uno malo.

## 1. Sonido por efecto en tus puntos

### 1.1 Cálculo

En cada poll, para cada partido con eventos nuevos:

1. `before` = puntos live del usuario en ese partido con el estado **anterior**
   al poll.
2. Aplicar los eventos nuevos del partido (en el orden de plegado:
   `ts, ingestedAt, seq, typeRank, sourceId`).
3. `after` = puntos live del usuario en ese partido con el estado **posterior**.
4. `delta = after - before`.
5. `hasGoal = algún evento nuevo del partido es de tipo goal`.

Los puntos se obtienen con la misma ruta que la clasificación live
(`foldMatch`/`matchStateToStats` + `liveUserMatchPoints`), para que el sonido
coincida con lo que se pinta.

Si el usuario no tiene sesión, no hay sonido.

### 1.2 Selección del tono (por partido/poll)

| Condición | Sonido |
|---|---|
| `delta > 0` | **bueno** |
| `delta < 0` | **malo** |
| `delta === 0` y `hasGoal` | **neutro (gol)** |
| `delta === 0` y sin gol | silencio |

Un poll con eventos en varios partidos puede producir un sonido por partido
(p. ej. uno bueno y otro malo). El ranking (`rankUp`/`rankDown`) y los tonos de
estado/FT se mantienen como en v1 y pueden sonar además del sonido de puntos.

Los partidos ya presentes en `AppState.matchStats` se excluyen (sus puntos ya
son oficiales y el live no los mueve), para no sonar por correcciones ya
consolidadas.

### 1.3 Tonos

- **Bueno** (v1): `[523, 659, 784]`, 120 ms, vibración 200 ms.
- **Malo** (nuevo): `[392, 311]`, 140 ms, vibración 120 ms.
- **Neutro gol** (v1): `[440, 440]`, 120 ms, sin vibración.
- **rankUp** (v1): `[392, 523]`, 110 ms, vibración 100 ms.
- **rankDown** (v1): `[330, 262]`, 110 ms, sin vibración.
- **status/end** (v1): `[660]`, 100 ms.

Se mantiene el toggle 🔔 (`porra_live_sound`) y el desbloqueo del `AudioContext`
en el primer gesto. Sonido apagado = ningún tono.

### 1.4 Casos límite

- Sin eventos nuevos: no se calcula nada.
- Error de red/poll: no suena.
- Partido finalizado en `matchStats`: se omite.
- Un gol anulado en el mismo poll: el neto manda; si acaba en 0 y hubo gol, el
  tono neutro.
- Varios goles neutros en el mismo partido/poll: un solo tono neutro.
- Un evento no-gol que mueve puntos: suena bueno/malo.

## 2. Countdown del poll (anillo, opción C)

### 2.1 UI

En la fila de estado del Live, después del badge:

```
● EN DIRECTO   ◔ 12    ⚡34    ⛶  🔔
```

- Anillo SVG de ~20×20 px, trazo ~2.5 px, pista atenuada y progreso en color de
  acento; número de segundos en el centro (9 px) o al lado.
- `role="status"`, `aria-live="off"` y `aria-label="Próxima actualización en
  12 segundos"` (no anunciar cada segundo).
- Visible también en pantalla completa.

### 2.2 Comportamiento

- Intervalo = `AppState.liveRefreshSecs || 30` (el mismo del poll).
- Se actualiza cada segundo; el arco se vacía de lleno a vacío.
- Se reinicia al completar cada poll (éxito o error) y al pulsar reintentar.
- Mientras `st.polling` está en curso, muestra `…` o el anillo quieto (no baja
  de 0).
- Si el poll está pausado (`liveV2ShouldPoll` falso: fuera de la ventana de
  partido) o la pestaña está oculta, el anillo queda atenuado y muestra `—`.
- Si hay error de red, manda el badge de error; el anillo se detiene.
- Se limpia el timer al salir de Live (`stopLiveV2Polling`) y no se duplica en
  re-renders.

### 2.3 Accesibilidad

- `aria-label` actualizado sin `aria-live` para no hablar cada segundo.
- El número es texto real; el SVG es decorativo (`aria-hidden="true"`).
- Contraste suficiente en modo oscuro; no depende solo del color.

## 3. Motivo del cambio (eventos reales)

### 3.1 Cálculo por evento

Para el usuario protagonista (la fila que cambió de puesto/puntos; se mantiene
la prioridad actual, con “yo” primero):

1. Partir del estado **anterior** al poll para cada partido con eventos nuevos.
2. Aplicar los eventos nuevos en orden de plegado.
3. Tras cada evento, calcular los puntos live del usuario en ese partido y
   comparar con el valor anterior.
4. Guardar `{ event, delta }` para los eventos con `delta !== 0`.

El delta es el efecto **total** de ese evento en los puntos del usuario
(pronóstico + plantilla), no los puntos “brutos” del evento.

### 3.2 Selección y visualización

- Ordenar los eventos con delta por `|delta|` descendente.
- Mostrar hasta **3** líneas; si hay más, añadir `+N más`.
- Cada línea: icono + texto + delta (`⚽ Gol de X +8`, `🅰️ Asistencia de Y +1`,
  `🟥 Roja de Z -2`).
- Pie con el **total** del poll (`pick.pointsDelta`), que es el cambio real de
  la fila.
- Si el protagonista no tiene ningún evento con delta (p. ej. su puesto cambia
  porque otro sube), se mantiene el comportamiento actual: motivo del que se
  movió / último evento relevante; si no hay, no se muestra cartel.
- Los partidos ya finalizados en `matchStats` no generan motivo (sus puntos son
  oficiales).

### 3.3 Tipos y etiquetas

- Cualquier tipo puede aparecer si mueve puntos: `goal`, `goal_cancelled`,
  `penalty_saved`, `assist`, `rating`, `card`, `substitution`, `score`,
  `match_final`.
- `reasonLabel`/`feedLabel` se amplían para cubrir `card` y los tipos que
  falten; se reutiliza el texto existente cuando ya existe.
- El cartel pasa de una línea `nowrap` a varias líneas con ancho máximo y
  `line-height` legible; se añade `.livev2-reason-line` y
  `.livev2-reason-total`.

## 4. Arquitectura y archivos

- `js/sound.js`
  - `eventToTone(event, quality)`: para `goal`, `quality` puede ser
    `'good' | 'bad' | 'neutral'` (compatibilidad con el booleano v1: `true` =
    bueno, `false` = neutro).
  - Nuevo tono malo.
- `js/live-v2-ui.js`
  - Cálculo compartido de deltas por evento (helper puro exportable
    `liveV2EventDeltas(...)` o similar) para sonido y motivo.
  - Sustituir `liveV2GoalIsMine` en `liveV2PlayNewEventSounds` por el efecto
    neto por partido/poll.
  - `liveV2MoverReason` usa los eventos con delta del protagonista, los ordena
    por impacto y devuelve hasta 3 + total.
  - Countdown: HTML en `renderLiveV2Html`, timer en
    `startLiveV2Polling`/`stopLiveV2Polling`, reset en el poll/retry.
  - Helpers puros: `liveV2SoundQuality(delta, hasGoal)` y
    `liveV2CountdownState(elapsedMs, intervalMs, { polling, paused })`.
- `js/liveV2.js`
  - Sin cambios de scoring; se reutilizan `foldMatch`, `matchStateToStats`,
    `eventKey`; se amplía `reasonLabel` con `card` si hace falta.
- `css/styles.css`
  - `.livev2-countdown` y variantes; `.livev2-reason-line`,
    `.livev2-reason-total`, ancho máximo y wrapping del cartel.
- `index.html`
  - Subir `?v=` de `sound.js`, `live-v2-ui.js`, `liveV2.js` y `styles.css` si
    se tocan.
- Sin cambios en `api-porra`.

## 5. Testing

- `tests/sound.test.js` (nuevo o existente): `eventToTone` bueno/malo/neutro;
  tonos v1 intactos; `enabled:false` no suena.
- Tests puros:
  - `liveV2SoundQuality` para `delta>0`, `delta<0`, `delta=0+goal`,
    `delta=0` sin gol.
  - `liveV2CountdownState` para 0 %, 50 %, 100 %, polling y pausa.
  - Deltas por evento: gol (+8 pronóstico +1 plantilla), asistencia (+1),
    roja que quita portería a cero (-2), evento neutro (0), varios eventos y
    selección de los 3 principales + total.
- Manual con el simulador:
  - Gol que sube puntos → bueno y motivo con el gol y su delta.
  - Gol que baja puntos → malo y motivo con el delta negativo.
  - Gol neutro → neutro; no-gol neutro → silencio y sin línea.
  - Asistencia/penalti/nota que mueve puntos → bueno/malo y motivo.
  - Varios eventos → hasta 3 líneas + total.
  - Toggle off → silencio.
  - Anillo: baja, se reinicia, pausa fuera de ventana, se limpia al salir.
- `node --test tests/*.test.js` verde.

## 6. Criterios de aceptación

1. Cualquier evento que mueva tus puntos del partido produce bueno/malo.
2. Un gol que no mueve puntos produce el tono neutro; un no-gol neutro calla.
3. Un solo sonido por partido/poll (efecto neto).
4. El motivo muestra los eventos reales con delta ≠ 0 (hasta 3) y el total.
5. Los tonos v1 se mantienen; el tono malo es nuevo y distinguible.
6. El anillo muestra los segundos, se reinicia, pausa y se limpia sin fugas.
7. El toggle y el desbloqueo de audio siguen funcionando.
8. Tests verdes y cache-busters actualizados.

## 7. Riesgos y mitigación

- **Coste de calcular before/after**: se pliega una vez por partido con eventos
  nuevos y se aplican los eventos de forma incremental; el número de eventos
  por poll es pequeño.
- **Doble sonido (puntos + ranking/estado)**: es intencional (v1); si resulta
  molesto, se puede silenciar el de estado para FT en una iteración posterior.
- **Timers duplicados**: un solo intervalo, limpieza en
  `stopLiveV2Polling` y guardas de re-render.
- **Partidos oficiales**: se excluyen de sonidos y motivos para no duplicar.
- **Cartel largo**: máximo 3 líneas + `+N más` y ancho máximo con wrapping.
- **Audio bloqueado**: se mantiene el desbloqueo en el primer gesto y el
  toggle; si el contexto está suspendido, no suena.
