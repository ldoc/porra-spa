# Live — Feed de eventos efímero en localStorage (design)

Fecha: 2026-09-17 · Rama: `porra-spa` `main`
Estado: aprobado por el usuario en brainstorm (visual companion `live-events-feed*`)

## 1. Objetivo

Mostrar en el tab Live un bloque **📣 ÚLTIMA HORA** con los eventos del día
(goles, descanso/final, cambios de puesto), que sobreviva a recargas durante el
partido y se invalide al cambiar el día. Espejo del TTL de `livematches` en Mongo.

## 2. Alcance

- Bloque plegable en el tab Live, bajo la tarjeta `⚡ TUS PUNTOS LIVE`.
- Lista global (todos los partidos en juego), más reciente arriba.
- Marca visual para goles de **tu plantilla** (variante **C1c**): caja esmeralda
  sólida `#0E3B2E`, borde `rgba(16,185,129,0.55)`, pestaña lateral de 4px `#10B981`.
- Se mantiene el aviso del último evento (línea v9).

Fuera de alcance: timeline compartida en servidor, eventos por jugador/partido,
sincronización entre dispositivos.

## 3. UI (variante A)

- Cabecera del bloque: `📣 ÚLTIMA HORA · hoy` + contador y chevron `▸/▾`
  (plegado por defecto, patrón de zona/sonido).
- Filas: `icono · texto · HH:MM` (hora local del momento de detección). Fondo
  `rgba(0,0,0,0.28)`, separador `rgba(255,255,255,0.06)`.
- Fila de gol de tu jugador: caja `#0E3B2E` + borde + pestaña de 4px (C1c);
  nombre en `#FFFFFF` y secundario en `#6EE7B7`.
- Builder puro `buildLiveEventsFeed(events, open)`; estado `AppState.live.eventsOpen`.

## 4. Eventos

De `diffLiveMatches` + cambios de puesto:

| tipo | texto |
|---|---|
| goal | `⚽ ¡GOL! {jugador} ({min}') · {equipo}` |
| start | `🟢 ¡Empieza el partido · {equipo}` |
| status HT | `⏸ DESCANSO · {equipo}` |
| status FT | `🏁 FINAL · {equipo}` |
| rankUp | `▲ Subes al {n}º` |
| rankDown | `▼ Bajas al {n}º` |

- `describeLiveEvent(ev, ctx)` (ya existe) se amplía con `ctx.team` → añade ` · {equipo}`.
- `mine`: en el feed, `true` si el goleador pertenece a la plantilla del usuario
  (`AppState.squadsCache[me].some(id === goleadorId)`). `findLiveScorer` pasa a
  devolver `{ id, nombre }`.
- El aviso del último evento (línea v9) muestra el mismo texto sin marca.

## 5. Persistencia e invalidación

- Clave `porra_live_events_v1_<username>` (por usuario: los eventos de puesto son por espectador).
- Valor: `{ day, updatedAt, events: [{ id, eventId, type, text, ts, mine }], baseline }`.
- `day = liveDayKey(nowMs)` en **día local** `YYYY-MM-DD`.
- Al leer: si `store.day !== liveDayKey(hoy)` → se descarta (mismo efecto que el TTL).
- Tope `LIVE_EVENTS_MAX = 50` (descarta los más antiguos).
- Purga: `cacheStore.clearPorraCaches()` añade el prefijo `porra_live_events_`.
- Acceso a localStorage en `js/main.js` con try/catch (como `sound.js`).

## 6. Continuidad entre recargas

- `baseline` ligero por partido: `{ eventId, goles: {teamId: n}, status, minute }`
  más `rank` del usuario.
- En el primer poll tras cargar, si el baseline guardado es de hoy y `updatedAt`
  está dentro de `LIVE_BASELINE_STALE_MS = 5 * 60_000`, se usa como `prev` del
  primer diff (captura goles ocurridos mientras estabas fuera). Si está viejo, se
  arranca de cero (sin avalancha de eventos antiguos).

## 7. Builders y helpers puros (en `js/live.js`, testeados)

- `liveDayKey(nowMs) -> 'YYYY-MM-DD'` (local).
- `pruneLiveEvents(store, nowMs, max) -> store` (invalida por día y recorta).
- `appendLiveEvent(events, ev, max) -> events`.
- `buildLiveEventsFeed(events, open) -> string`.
- `describeLiveEvent(ev, ctx)` ampliado con `ctx.team`.

## 8. Tests

- `liveDayKey` (día local), `pruneLiveEvents` (cambio de día → vacío; tope),
  `appendLiveEvent` (ordena/recorta), `buildLiveEventsFeed` (vacío, plegado,
  abierto, fila `mine` con `#0E3B2E`), `describeLiveEvent` con `ctx.team`.
- Verificación manual del ciclo: recarga durante el partido conserva eventos;
  cambio de día los borra.

## 9. Cache-busting

Incrementar versión de `js/live.js` y `js/main.js` en `index.html` (regla de AGENTS.md).
