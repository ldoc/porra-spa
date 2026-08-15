# Diseño: Sección "Hoy tenemos partidos" en el tab Inicio

**Fecha:** 2026-08-15
**Proyecto:** porra-spa (frontend)
**Alcance:** Bloque en `renderInicioTab()` que muestra los partidos del día de la fase actual con el pronóstico del usuario y, al expandir, estadísticas 1X2 de la porra con el resultado que maximiza la ventaja relativa del usuario.

---

## Contexto

La pantalla de inicio (`renderInicioTab()`, `js/main.js:3170`) muestra la bienvenida, la tarjeta de fase, un countdown y tarjetas de pendientes. Se quiere que, los días en que hay partidos, el usuario vea de un vistazo qué se juega hoy: fecha/hora, escudos, nombres y su pronóstico; y al pulsar cada partido, cómo está repartida la porra (porcentajes 1X2) y cuál de los resultados le beneficia más frente a la media.

Solo aplica en **fases activas** (se está disputando la competición), nunca en fases `PRE*`, `FASE_PRETEMPORADA` ni `FASE_POSTFINAL`.

## Objetivo

1. En el tab Inicio, si hoy hay partidos de la fase actual y estamos en una fase activa, mostrar la sección **"⚽ Hoy tenemos partidos"** con una tarjeta por partido.
2. Cada tarjeta muestra: fecha y hora, escudos y nombres de equipos, tu pronóstico y (si existe) el resultado real.
3. Al pulsar la tarjeta, se despliegan los **porcentajes 1X2** de los pronósticos de la porra y se marca el resultado con **mayor ventaja relativa** para el usuario según el pronóstico de los demás y el suyo propio.

## No está en alcance

- **No** tocar el backend (`api-porra`): todo se calcula con datos que ya expone (`GET /api/predictions/all`, `GET /api/match-stats`).
- **No** permitir editar el pronóstico desde esta sección (el pronóstico está bloqueado en fases activas).
- **No** mostrar la sección en fases `PRE*`, `FASE_PRETEMPORADA` ni `FASE_POSTFINAL`.
- **No** refactorizar la pestaña Resultados ni sus componentes.

## Fases activas (dónde se muestra)

| Estado | Fases |
|---|---|
| **Se muestra** | `FASE_LIGA`, `FASE_16`, `FASE_8`, `FASE_4`, `FASE_SEMIS`, `FASE_FINAL` |
| **No se muestra** | `FASE_PRETEMPORADA`, `FASE_PRE16`, `FASE_PRE8`, `FASE_PRE4`, `FASE_PRESEMIS`, `FASE_PREFINAL`, `FASE_POSTFINAL` |

Regla de código: `isHoyPartidosAllowed(fase) = !fase.startsWith('FASE_PRE') && fase !== 'FASE_POSTFINAL'`.

## Cambios — Frontend (`porra-spa`)

### 1. Nuevo módulo `js/hoyPartidos.js`

IIFE estilo `js/stats.js` / `js/apiData.js`: cálculos puros exportables para tests + función de render. Expone en `window` y en `module.exports`.

| Función | Responsabilidad |
|---|---|
| `isHoyPartidosAllowed(fase)` | `true` solo en fases activas (no `FASE_PRE*` ni `FASE_POSTFINAL`) |
| `getMatchResult(home, away)` | `'H'` si home > away, `'D'` si iguales, `'A'` si home < away |
| `getTodayMatches(matches, nowMs, calendarFase)` | Partidos cuya **fecha local** de `fechaTs` coincide con la de `nowMs` **y** `m.fase === calendarFase` |
| `computeResultCounts(matchId, allPredictions)` | `{ counts: {H,D,A}, total, pct: {H,D,A} }` entre jugadores con pronóstico numérico completo en ese partido |
| `computeBestResult(counts, myResult)` | Resultado con mayor ventaja relativa → `{ result, advantage }` (o `null` si `total === 0` o sin pronóstico propio) |
| `renderHoyPartidos(container)` | Genera el HTML de la sección (título + tarjetas + desplegables) |

### 2. Integración en `renderInicioTab()` (`js/main.js`)

- Insertar `<div id="hoy-partidos-section"></div>` entre la tarjeta de fase (`faseHtml`) y las tarjetas de pendientes.
- Llamar `renderHoyPartidos(document.getElementById('hoy-partidos-section'))`.
- `renderHoyPartidos` decide si pintar o vaciar el contenedor:
  1. `isHoyPartidosAllowed(getFaseJuego())` → si no, contenedor vacío.
  2. Partidos de hoy con `getTodayMatches(AppState.matches, Date.now(), getFaseForCurrentPhase())` → si no hay, contenedor vacío.
  3. Si `AppState.predictionsLoaded` aún es `false` → tarjetas con el pronóstico en "…" (se repintará al cargar).

### 3. Re-render al cargar predicciones de todos (`enterApp`)

Hoy `enterApp()` (línea ~2257) solo llama a `updatePointsNumber()` cuando termina `pointsReadyP`. Añadir: si el tab activo es `inicio`, llamar también `renderInicioTab()` para que los porcentajes 1X2 aparezcan sin re-navegar.

### 4. Tarjeta de partido (colapsada)

```
┌───────────────────────────────────────────────┐
│  ⚽ Hoy · Jue 8 Sep · 21:00              ▾    │
│   [escudo]   Athletic Club   2 - 1   [escudo] │
│               Tu pronóstico: 2 - 1            │
│               Real: 1 - 0   (si existe)       │
└───────────────────────────────────────────────┘
```

- **Fecha/hora**: `⚽ Hoy · <día> <mes> · <HH:MM>` (día/mes y hora en local, reutilizando la lógica de `formatDate`). Si el día de la fase cae en una fecha concreta, se muestra igualmente "Hoy".
- **Marcador central**: tu pronóstico por defecto. Si el partido tiene resultado real en `AppState.matchStats` (goles de ambos equipos presentes), el marcador central pasa a ser el **real** resaltado (color `--accent-gold`) y bajo el pie se mantiene `Tu pronóstico: X - Y`.
- **Pie**: `Tu pronóstico: X - Y` (si no hay resultado). Si hay resultado: `Tu pronóstico: X - Y` + `✔ Acertaste (N pts)` (verde) o `✘ No acertaste` (rojo). `N` = puntos del partido según reglas de puntuación (8 resultado + 3+3 goles + 1 ambos).
- **Interacción**: pulsar la tarjeta alterna la clase `.open` (chevron ▾/▴). Área táctil ≥ 44px.

### 5. Desplegable (estadísticas 1X2)

```
  Pronósticos de la porra · 12 jugadores
  [1] Athletic Club  █████████░░░ 67%   ★ tu pronóstico
  [X] Empate         ██░░░░░░░░░░ 17%   ⚡ Mejor para ti
  [2] Arsenal        ███░░░░░░░░░ 16%
  ⚡ Mejor para ti: Empate — si aciertas este resultado ganas ≈ +2.6 pts sobre la media
```

- Cabecera: `Pronósticos de la porra · <total> jugadores` (jugadores con pronóstico en ese partido).
- Una fila por resultado (1/X/2) con nombre (equipo local, "Empate", equipo visitante), barra con el `%` (ancho = pct) y el porcentaje numérico.
- **Tu pronóstico**: fila resaltada (tag cyan + borde) con etiqueta `★ tu pronóstico`.
- **Mejor para ti**: fila del resultado con mayor ventaja relativa marcada con badge dorado `⚡` y una nota bajo las barras con la ventaja estimada (1 decimal).
- Si el partido tiene resultado real: línea `Acertaron el resultado: X/Y (N%)` bajo las barras y la barra del resultado real marcada.
- Si `total === 0`: el desplegable muestra `Aún no hay pronósticos de la porra en este partido.`

### 6. Cálculo de ventaja relativa (fórmula definitiva)

Base = usuarios de `AppState.allPredictions` con pronóstico numérico completo (`home` y `away` de tipo `number`) para ese `matchId`.

Para cada resultado `R ∈ {H, D, A}`:
- `pct(R) = counts[R] / total`.
- Si **mi** pronóstico tiene resultado `R`: `ventaja(R) = 8 × (1 − pct(R))` (cuantos más jugadores aciertan R, menor ventaja relativa al acertarlo yo).
- Si **mi** pronóstico no es `R`: `ventaja(R) = −8 × pct(R)` (si sale R, todos los que lo acertaron me superan).

`mejor` = resultado con mayor `ventaja`. Mostrado redondeado a 1 decimal.

> Nota (documentada): el resultado marcado como "mejor para ti" suele ser el propio pronóstico del usuario; el dato útil es la **magnitud** de la ventaja. Se usa el componente de 8 puntos del resultado (la parte de goles 3+3+1 no es estimable sin conocer el marcador real).

### 7. Estilos (`css/styles.css`)

Clases nuevas `.hoy-*` (`.hoy-title`, `.hoy-card`, `.hoy-card-header`, `.hoy-chev`, `.hoy-teams`, `.hoy-team`, `.hoy-score`, `.hoy-foot`, `.hoy-stats`, `.hoy-stat-row`, `.hoy-bar-*`, `.hoy-best-note`, `.hoy-real-note`, `.hoy-empty`) reutilizando variables de `:root` (`--ucl-card`, `--border-color`, `--accent-cyan`, `--accent-gold`, `--accent-primary`, `--text-*`, `--radius-*`, `--shadow-card`), consistente con el resto de la pantalla Inicio (tarjetas glass oscuras, etiquetas 1/X/2, barras con gradiente).

### 8. `index.html`

- Añadir `<script src="js/hoyPartidos.js?v=1"></script>` (antes de `main.js`).
- Incrementar la versión de `js/main.js` y `css/styles.css` (regla de cache-busting de AGENTS.md).

## Consideraciones

- **Fase del calendario**: solo se muestran partidos de hoy de la fase de calendario correspondiente a la fase actual (`getFaseForCurrentPhase()`). En la práctica no debería haber partidos de otra fase el mismo día, pero se filtra igualmente.
- **Hora local**: "hoy" se calcula comparando día/mes/año **locales** de `fechaTs` (segundos) y `Date.now()`.
- **Datos no cargados**: `AppState.allPredictions` se rellena con `fetchAllPredictions()` (fases activas devuelven todo); `renderInicioTab()` se re-invoca cuando termina para pintar los porcentajes.
- **Sin frameworks**: JS Vanilla ES6+ y CSS plano, como el resto del proyecto.

## Verificación

- `node tests/hoyPartidos.test.js` (nuevo test): `isHoyPartidosAllowed` para las 13 fases; `getMatchResult` (H/D/A); `getTodayMatches` (misma fecha local + filtro por fase calendario, sin partidos si no coincide); `computeResultCounts` (conteos y pct, `total=0`); `computeBestResult` (mayoría vs minoría, con y sin pronóstico propio, `total=0`).
- Tests existentes siguen pasando (`node tests/*.test.js`).
- Manual: en una fase activa con partidos hoy, Inicio muestra la sección; al pulsar una tarjeta se despliegan los porcentajes y el resultado "mejor para ti"; en fase `PRE`/`POST`/pretemporada o sin partidos hoy, la sección no aparece.
- Sin errores en consola; estilos responsivos en móvil vertical.
