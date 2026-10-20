# Design: Live v2 — sonidos por efecto en tus puntos y countdown del poll

## Resumen

Dos mejoras sobre el Live v2, solo front-end:

1. **Sonido ligado a tus puntos**, no al goleador: cualquier evento nuevo que
   suba o baje tus puntos del partido suena con tono bueno/malo. Un gol que no
   cambia nada tiene su tono neutro propio; el resto de eventos neutros callan.
   Se recuperan los tonos de la v1 y se añade un tono malo.
2. **Countdown circular** hasta el siguiente poll (opción C), junto al badge
   de estado, con pausa cuando no hay partidos en juego.

## Objetivos

- Recuperar el criterio v1: el sonido refleja el efecto del evento en **tus
  puntos**, no si el jugador está en tu plantilla.
- Que **cualquier** evento pueda sonar si mueve puntos (asistencia, penalti
  parado, roja, nota, cambio, corrección, final…), no solo los goles.
- Un solo sonido por partido/poll según el efecto neto (opción 2).
- Gol neutro (no cambia puntos) con tono propio; evento neutro que no es gol,
  silencio.
- Countdown claro, compacto y sin fugas de timers.

## No-objetivos

- Cambiar el intervalo de poll (`liveRefreshSecs`) o el backend.
- Sonidos específicos por tipo de evento más allá de bueno/malo/neutro.
- Historial de sonidos, notificaciones push o vibración distinta por evento
  (se mantiene la vibración de los tonos que la tenían).
- Tocar la clasificación, el scoring o el event-sourcing.

## Contexto

- **v1** (`487223c^:js/main.js:2218`): `isMine` de un gol =
  `afterById[eventId] > beforeById[eventId]`, es decir, si tus puntos de ese
  partido subían en el poll. Tonos en `js/sound.js` (idénticos a los actuales).
- **v2 actual** (`js/live-v2-ui.js:232-241`): `liveV2GoalIsMine` comprueba si
  el goleador está en `AppState.squadsCache[yo]`. Solo suenan goles y
  ranking/estado; asistencias, penaltis, rojas o notas no suenan.
- El poll v2 ya calcula `liveUserMatchPoints` por partido (pronóstico +
  plantilla); el estado plegado está en `st.events`.

## Decisiones

- **Criterio:** delta de tus puntos del partido antes/después del poll.
- **Granularidad:** un sonido por partido/poll según el efecto **neto**.
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
- Un evento no-gol que mueve puntos: suena bueno/malo (es el objetivo de la
  mejora).

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
  re-renders (`data-bound`/singleton).

### 2.3 Accesibilidad

- `aria-label` actualizado sin `aria-live` para no hablar cada segundo.
- El número es texto real; el SVG es decorativo (`aria-hidden="true"`).
- Contraste suficiente en modo oscuro; no depende solo del color (el número y
  el `—` de pausa).

## 3. Arquitectura y archivos

- `js/sound.js`
  - `eventToTone(event, quality)`: para `goal`, `quality` puede ser
    `'good' | 'bad' | 'neutral'` (compatibilidad con el booleano v1: `true` =
    bueno, `false` = neutro).
  - Nuevo tono malo.
- `js/live-v2-ui.js`
  - Sustituir el uso de `liveV2GoalIsMine` en `liveV2PlayNewEventSounds` por el
    cálculo `before/after` por partido/poll.
  - Helper puro exportable `liveV2SoundQuality(delta, hasGoal)` →
    `'good' | 'bad' | 'neutral' | null`.
  - Countdown: HTML en `renderLiveV2Html`, timer en
    `startLiveV2Polling`/`stopLiveV2Polling`, reset en el poll/retry.
  - Helper puro `liveV2CountdownState(elapsedMs, intervalMs, { polling,
    paused })` → `{ seconds, progress, label }`.
- `js/liveV2.js`
  - Sin cambios de scoring; se reutilizan `foldMatch`, `matchStateToStats`,
    `eventKey`.
- `css/styles.css`
  - `.livev2-countdown`, `.livev2-countdown svg`, `.track`, `.progress`,
    `.livev2-countdown-num`, `.paused`.
- `index.html`
  - Subir `?v=` de `sound.js`, `live-v2-ui.js` y `styles.css` si se tocan.
- Sin cambios en `api-porra`.

## 4. Testing

- `tests/sound.test.js` (nuevo o existente): `eventToTone` bueno/malo/neutro;
  que los tonos v1 no cambian; `playLiveEvent` con `enabled:false` no suena.
- `tests/liveV2.test.js` o nuevo: `liveV2SoundQuality` para
  `delta>0`, `delta<0`, `delta=0+goal`, `delta=0` sin gol; y
  `liveV2CountdownState` para 0 %, 50 %, 100 %, polling y pausa.
- Manual con el simulador:
  - Gol que sube puntos (pronóstico/plantilla) → bueno.
  - Gol que baja puntos (p. ej. rompe tu 0-0 o encaja tu portero) → malo.
  - Gol neutro (sin efecto) → neutro.
  - Asistencia/penalti/nota que mueve puntos → bueno/malo.
  - Evento neutro no-gol → silencio.
  - Toggle off → silencio.
  - Anillo: baja, se reinicia, pausa sin partidos, se limpia al salir.
- `node --test tests/*.test.js` verde.

## 5. Criterios de aceptación

1. Cualquier evento que mueva tus puntos del partido produce bueno/malo.
2. Un gol que no mueve puntos produce el tono neutro; un no-gol neutro calla.
3. Un solo sonido por partido/poll (efecto neto).
4. Los tonos v1 se mantienen; el tono malo es nuevo y distinguible.
5. El anillo muestra los segundos, se reinicia, pausa y se limpia sin fugas.
6. El toggle y el desbloqueo de audio siguen funcionando.
7. Tests verdes y cache-busters actualizados.

## 6. Riesgos y mitigación

- **Coste de calcular before/after**: se pliega una vez por partido con eventos
  nuevos; el número de eventos por poll es pequeño. Se cachea el estado base
  del poll.
- **Doble sonido (puntos + ranking/estado)**: es intencional (v1); si resulta
  molesto, se puede silenciar el de estado para FT en una iteración posterior.
- **Timers duplicados**: un solo intervalo, limpieza en
  `stopLiveV2Polling` y guardas de re-render.
- **Partidos oficiales**: se excluyen de los sonidos para no duplicar.
- **Audio bloqueado**: se mantiene el desbloqueo en el primer gesto y el
  toggle; si el contexto está suspendido, no suena (comportamiento actual).
