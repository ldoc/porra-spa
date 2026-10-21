# Live v2: P0 de caché y huecos de snapshot — diseño

- **Fecha:** 2026-10-21
- **Repos:** `porra-spa` (front) y `api-porra` (scraper/API)
- **Origen:** `docs/superpowers/specs/2026-10-21-live-v2-analisis-cache-datos.md`
- **Estado:** diseño aprobado; pendiente de plan de implementación
- **Alcance:** completar los puntos P0 que siguen abiertos. Los P0 4 (gol en propia anulado) y 5 (`findGoalToCancel` por jugador) ya están implementados y commiteados.

## Decisiones

1. La caché pasa a una clave versionada que incluye `source` y fase.
2. Se purgan claves antiguas, se limita el tamaño y se reintenta una vez si `localStorage` se queda sin cuota.
3. `livematches` **solo rellena huecos**: añade partidos que no existen en el log de eventos. Nunca pisa estado, marcador ni puntos de un partido con eventos.
4. El full al entrar sigue siendo obligatorio si el último full tiene más de 60 s. Un cache recortado también fuerza full.

## 1. Caché v2

### Clave

`porra_live_events_v2:<día-local>:<usuario>:<source>:<fase>`

- `source`: `real` o `sim`. Se obtiene con `liveV2Api.wantSimSource(window.location.search, window.location.hostname)`.
- `fase`: `AppState.appConfig?.faseJuego || 'unknown'`.
- El prefijo `v2` invalida todas las cachés antiguas.
- `liveV2CacheKey(username, now, { source, phase })` mantiene el formato actual de día local y usuario.

### Restauración

`restoreLiveV2Cache` solo acepta un payload que cumpla:

- `version === 2`
- `source` y `phase` iguales a los actuales
- `events` array, `serverTime` string no vacío y `fullAt` finito

Si no cumple, no restaura nada y el acceso fuerza full. Las claves que no sean la clave actual se purgan.

### Guardado

`saveLiveV2Cache`:

1. Serializa `{ version: 2, source, phase, events, serverTime, fullAt, truncated }`.
2. Limita a `LIVEV2_CACHE_MAX_EVENTS = 6000` eventos. Si recorta, conserva los más recientes por `ingestedAt` y `ts`, y marca `truncated: true`.
3. Purga claves `porra_live_events_*` que no sean la actual (días/usuarios/source/fase anteriores).
4. Si `setItem` falla por cuota, purga claves antiguas y reintenta una vez. Si vuelve a fallar, elimina la clave actual y no rompe la UI.

`restoreLiveV2Cache` marca `_needFull = true` si `truncated`, para que el primer render pida un full autoritativo.

### Invalidación al entrar

`liveV2ShouldFullOnEntry` mantiene la regla actual: full si falta `serverTime`, no hay eventos, `_needFull` está activo o el último full tiene más de 60 s. No se añaden reglas por “todo FT”: un full de entrada ya sustituye el log antiguo.

## 2. Relleno de huecos con `livematches`

### Función pura

En `js/liveV2.js`:

`fillSnapshotGaps(folded, snapshots, ctxById, now, staleMs = 180000)`

Devuelve un nuevo `{ states, statsById }`:

- Recorre `snapshots` (`eventId -> snapshot`).
- Solo considera snapshots frescos: `lastUpdated` válido y `now - lastUpdated <= staleMs`.
- Si `states[eventId]` ya existe, no toca nada.
- Si no existe:
  - determina `homeTeamId`/`awayTeamId` desde `ctxById`; si no hay contexto, usa las claves de `snap.stats` excluyendo `jugadores`.
  - crea un estado mínimo: `status`, `score` desde `snap.stats[homeId].goles`/`snap.stats[awayId].goles`, `lastMinute` desde `snap.minute`, `goals: []`, `players: {}`.
  - añade `statsById[eventId] = snap.stats`.
- Ignora snapshots sin `stats` o sin estado válido (`NS`, `LIVE`, `HT`, `FT`).

### Integración UI

`liveV2Folded` pliega eventos como hasta ahora y después aplica `fillSnapshotGaps` con `_liveSnapshots` y `liveV2CtxById()`.

`liveV2MatchBreakdown` usa `folded.statsById[id]` para los puntos, de modo que un partido-hueco también muestra su desglose. Para partidos con eventos, `statsById` sigue siendo el resultado del plegado.

Los partidos-hueco participan en chips, orden, badge, polling y clasificación como cualquier otro estado. El modal de eventos mostrará una lista vacía para ellos.

## 3. Backend

No hay cambios nuevos. Los P0 4 y 5 ya están cubiertos por:

- `js/liveV2.js`: `ownGoal` y anulación sin restar goles al jugador.
- `api/liveEvents.js`: `findGoalToCancel` prioriza el jugador del incidente.

## 4. Casos límite

- **Sin `localStorage` o modo privado:** la UI funciona sin caché.
- **Cuota llena:** se purgan claves viejas y se reintenta; si falla, se elimina la clave actual.
- **Cambio real ↔ sim:** la clave cambia y no se reutiliza la caché anterior.
- **Cambio de fase:** la clave cambia y se fuerza full.
- **Snapshot viejo:** no se usa para rellenar huecos.
- **Partido con eventos:** no se sobrescribe aunque el snapshot esté fresco.
- **Snapshot sin `stats` o sin contexto:** se ignora.
- **Partido solo en `livematches` fuera de `AppState.matches`:** se muestra con el fallback de metadatos existente.

## 5. Tests

- Clave de caché con `source` y fase.
- Restauración rechaza versión, source, fase o día distintos.
- Purga de claves antiguas al guardar.
- Límite de 6.000 eventos y `truncated`.
- Reintento tras fallo de cuota y fallback final.
- `fillSnapshotGaps`: añade hueco fresco, ignora snapshot viejo, no pisa partido con eventos.
- Partido solo en `livematches` visible en chips, filas y modal.
- Full al entrar sigue forzándose con full viejo o caché truncada.
- `node --test tests/*.test.js` verde en `porra-spa` y `api-porra`.

## 6. Fuera de alcance

- P1: `MatchStats` parciales, cancelados/aplazados, prórroga/penaltis.
- P2: badge basado en `hasInPlay`, umbral de stale configurable, fallback de minuto.
- Cambiar la autoridad del snapshot para partidos que ya tienen eventos.
- Modificar el orden de plegado del backend o el esquema de eventos.
