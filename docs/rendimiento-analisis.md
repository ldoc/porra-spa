# Análisis de rendimiento — Porra SPA + API

**Fecha:** 2026-08-13
**Alcance:** `porra-spa` (frontend vanilla) + `api-porra` (backend Node.js + MongoDB Atlas)
**Estado:** Análisis realizado, sin implementar. Para retomar en una futura sesión.

---

## Resumen ejecutivo

La app está **bien orientada** en lo importante: lazy loading en imágenes, wizard paginado por jornadas (no renderiza 144 de golpe), polling de match-stats solo con pestaña visible, caché cliente de 30s, y Brotli automático de Vercel. Los cuellos de botella reales están en **5 áreas** de alto impacto y varias de medio/bajo.

---

## 🔴 ALTO impacto

### 1. Caché de datos estáticos + arranque bloqueante (frontend)
- `loadInitialData()` (`js/main.js:233-241`) descarga ~**253 KB de JSON** en cada carga (jugadores 194KB, calendar 46KB, fases 9KB, teams 4KB) y bloquea el primer pintado del login. Son datos casi inmutables.
- **Mejora:** cachearlos en `localStorage`/Cache API con versión.
- **Impacto:** elimina ~250KB + latencia de 5 requests del camino crítico en cada arranque.

### 2. Imágenes de jugadores: ~13.5 MB desperdiciados (assets)
- 682 PNG (24.2 KB media) vs 591 WebP (4.3 KB media), todos 150×150.
- **186 de los 682 PNG son en realidad JPEG** mal nombrados con extensión `.png`.
- No hay duplicados (ningún id existe en png y webp a la vez); `jugadores.json` ya tiene el campo `extension` que la app usa para construir la URL.
- La búsqueda de plantilla renderiza hasta 50 imágenes (`renderSearchResults` `js/main.js:3855-3884`): pasa de ~1.2MB a ~215KB por sesión.
- **Mejora:** convertir los 682 PNG a WebP (o al menos corregir los 186 JPEG) y actualizar `extension` en `jugadores.json`.
- **Impacto:** ~13.5MB menos de catálogo (21MB → ~7.5MB).

### 3. Reglas Cache-Control de `vercel.json` rotas (assets)
- Los `source` `data/imgJugadores/(.*)`, `data/imgEquipos/(.*)` y `data/(.*)\.json` **no matchean** (les falta la `/` inicial; las reglas que funcionan —`/(.*)\.js`, `/(.*)\.css`— la llevan).
- En producción todo `data/` se sirve con `max-age=0, must-revalidate` → **cada visita revalida cada imagen y JSON**.
- **Mejora:** añadir `/` inicial a los 3 `source`.
- **Impacto:** el mayor ahorro de latencia percibida en visitas repetidas (uso habitual de una porra). Verificar con `curl` tras redeploy.

### 4. Sin caché servidor en los payloads grandes (backend)
- `/api/predictions/all` (~178KB raw con 25 usuarios), `/api/match-stats` (~1.3MB raw con 144 partidos) y `/api/match-stats/updated` **no tienen Cache-Control**.
- Con 30 usuarios abriendo Resultados en el mismo minuto: ~44MB transferidos + 90 queries a Atlas.
- `sendJson(req, res, status, data, cacheSeconds)` (`server.js:393-418`) solo añade `Cache-Control` cuando recibe `cacheSeconds`.
- **Mejora:** pasar `cacheSeconds` (30-60s) a `sendJson` en estos 3 endpoints. Precaución: en fases PRE el payload de `predictions/all` varía por usuario (Vary por `X-Client-Phase` si se hace CDN).
- **Impacto:** elimina ~N×(1.3MB + 178KB) de transferencia por ciclo de refresco + queries asociadas.

### 5. Doble/triple query a `gameconfig` por request (backend)
- `checkPhaseConsistency` (`server.js:312-328`) + `getFaseJuego()` (`server.js:286-294`) = **2 round-trips a Atlas por casi cada GET** del mismo documento `gameconfig` (cambia rarísimo).
- **Mejora:** cachear `GameConfig.findById('gameConfig')` en memoria con TTL 5-10s, invalidarlo al `PUT /api/admin/fase-juego` (`server.js:594-598`).
- **Impacto:** reduce de 3 a 1 las queries por request de lectura.

---

## 🟡 MEDIO impacto

| # | Mejora | Dónde | Beneficio |
|---|--------|-------|-----------|
| 6 | Índice `{lastUpdated:-1}` en MatchStats | `db/models/MatchStats.js:14-17` | `findOne({}).sort({lastUpdated:-1})` (`server.js:1122`, poll 1/min×N) hoy hace collection-scan + blocking sort |
| 7 | `.lean()` + `-_id` en lecturas masivas | `predictions/all` (server.js:1204/1206), `squad/all` (1064/1067), `match-stats` (1165) | Menos hidratación Mongoose + payloads menores |
| 8 | Minificar `main.js` (205KB) y `styles.css` (92KB) | SPA estática (no hay build; paso pre-deploy) | ~35-40% menos bytes + parseo JS más rápido en móvil |
| 9 | Cálculo repetido en Clasificación | `renderClasificacionTab` `js/main.js:913-947` | Recalcula `calculateUserTotalPoints`/`calculateSquadPoints` por cada usuario en cada render con `find()` lineal (`main.js:715`) → *jank* en móvil. Pre-indexar matchStats por eventId (Map) + cachear `userPoints` con TTL (como `classificationPoints`) |
| 10 | `fetchPlayers` sin caché + llamado en cada render | `js/main.js:871, 3119` | `?t=${Date.now()}` anula el `Cache-Control: 300` del servidor → 1 request extra por visita a la tab |
| 11 | Proyecciones en lecturas por usuario | `predictions` (server.js:774), `final-predictions` (929), `getSquad` (auth.js:168), `getProfile` (auth.js:116) | No transferir `passwordHash` ni documentos completos (seguridad + rendimiento) |
| 12 | `match-stats/:eventId`: leer Mongo antes de scrapear | `server.js:1145` | Hoy hace 5-9 HTTPS salientes a Sofascore por llamada repetida sin TTL (el SPA no lo usa hoy, pero es una bomba si se añade) |

---

## 🟢 BAJO impacto

- **Fonts:** 9 pesos de Inter+Outfit render-blocking (`index.html:14-18`) → reducir a los usados (~40-80KB, mejora FCP).
- **CLS:** ningún `<img>` tiene `width`/`height` (`js/main.js:455-464` helpers) → añadir dimensiones o CSS `aspect-ratio`.
- **Escudos de eliminatorias sin `loading="lazy"`:** `js/main.js:5247, 5286, 5352`.
- **`getAllPlayers`:** proyecta `points`/`hits` que **no existen en el schema** de User (auth.js:135) → siempre 0, vestigio; proyectar solo `'username avatar'`.
- **`default.png` inexistente:** 6 rutas usan `onerror=...src='data/imgEquipos/default.png'` (`js/main.js:1426, 1749, 5247, 5286, 5352`) pero el archivo no existe → fallback falla en cascada.
- **Índices redundantes:** `index:true` junto a `unique:true` en `clave`/`username`/`eventId`/`code` (unique ya crea índice) → dejar solo `unique`.
- **Rate limiting:** GET pesados sin limitador específico; los limiters in-memory no son fiables en Vercel serverless (sin estado compartido). `match-stats/updated` no pide autenticación.
- **Código muerto:** `getTop8TeamIds` (`server.js:41-163`, nunca se llama), `renderLeaderboard` (`js/main.js:4185`, contenedor no existe).
- **Meta no-store** en `index.html:10-12` (los navegadores ignoran `http-equiv` para subrecursos).

---

## Top 5 para priorizar

1. Convertir PNG de jugadores a WebP (+corregir JPEG mal nombrados)
2. Arreglar las reglas Cache-Control de `vercel.json`
3. Caché servidor (Cache-Control) en los payloads grandes
4. Caché de `gameconfig` en memoria
5. Caché de datos estáticos (JSON) en el frontend

---

## Notas y referencias

- Caché cliente existente: `CACHE_TTL = 30000` (30s) en `js/main.js:489` para match-stats, predictions/all, final-predictions.
- Polling: `startMatchStatsPolling` (`js/main.js:616-639`) cada 60s a `/api/match-stats/updated` solo con pestaña visible.
- Vercel ya sirve Brotli automáticamente para texto (verificado en producción).
- `jugadores.json`: 194KB (brotli 18.4KB); `calendar.json`: 46KB (brotli 2.5KB).
- Imágenes mostradas a 20-48px; origen 150×150 correcto para retina @2x, el peso viene del formato PNG no de las dimensiones.
- Verificado en producción (2026-08-13): `main.js` y `styles.css` tienen `cache-control: public, max-age=86400, stale-while-revalidate=604800` ✅; `data/*` tiene `max-age=0, must-revalidate` ❌.
