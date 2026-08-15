# Sección "Hoy tenemos partidos" en Inicio — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mostrar en el tab Inicio, solo en fases activas con partidos hoy, una sección "Hoy tenemos partidos" con tarjetas por partido (fecha/hora, escudos, nombres, tu pronóstico y resultado real si existe) que al expandirse muestran los porcentajes 1X2 de la porra y marcan el resultado con mayor ventaja relativa para el usuario.

**Architecture:** Nuevo módulo IIFE `js/hoyPartidos.js` (estilo `js/stats.js` / `js/fasesFechas.js`) con cálculos puros exportables para tests y una función `renderHoyPartidos` que `renderInicioTab()` invoca desde un contenedor `<div id="hoy-partidos-section">`. `enterApp()` re-renderiza Inicio cuando terminan de cargar las predicciones de todos (`fetchAllPredictions()`).

**Tech Stack:** HTML5 + CSS3 vanilla (variables de `:root`) + JavaScript Vanilla ES6+. Tests con `node` + `assert` (sin framework).

## Global Constraints

- **Mobile vertical first:** interfaz para portrait, anchura máx ~460px, áreas táctiles ≥44px, sin scroll horizontal.
- **Tokens de diseño:** reutilizar variables de `css/styles.css` `:root` (`--ucl-card`, `--border-color`, `--accent-cyan`, `--accent-gold`, `--accent-primary`, `--text-*`, `--radius-*`, `--shadow-card`). No usar valores estáticos de color salvo los ya usados en la app.
- **Sin frameworks:** solo HTML5/CSS3/JS Vanilla.
- **Semántica:** `id` descriptivos y únicos; clases `hoy-*` para la sección nueva.
- **Cache-busting (AGENTS.md):** al tocar `js/main.js`, `css/styles.css` o añadir `js/hoyPartidos.js`, incrementar la versión `?v=X` en `index.html`.
- **Validación:** el JS no debe lanzar excepciones en consola; estilos responsivos en móvil vertical.
- **No tocar el backend** `api-porra` (todo se calcula con datos ya expuestos).
- **Fases activas** donde se muestra: `FASE_LIGA`, `FASE_16`, `FASE_8`, `FASE_4`, `FASE_SEMIS`, `FASE_FINAL`. Nunca `FASE_PRE*`, `FASE_PRETEMPORADA` ni `FASE_POSTFINAL`.

---

### Task 1: Módulo `js/hoyPartidos.js` — funciones puras de cálculo

**Files:**
- Create: `js/hoyPartidos.js`
- Create: `tests/hoyPartidos.test.js`

**Interfaces:**
- Produces: módulo exportado `hoyPartidosApi` con `{ isHoyPartidosAllowed, getMatchResult, getTodayMatches, computeResultCounts, computeBestResult, getRealResult, calcMatchPoints, formatMatchTime, esc }` (signaturas exactas en los steps). Se expone como `window.hoyPartidosApi` y vía `module.exports` (para tests en node).

- [ ] **Step 1: Escribir el test que falla**

Crear `tests/hoyPartidos.test.js`:

```js
const assert = require('assert');
const {
  isHoyPartidosAllowed, getMatchResult, getTodayMatches,
  computeResultCounts, computeBestResult, getRealResult,
  calcMatchPoints, formatMatchTime
} = require('../js/hoyPartidos.js');

function test_isHoyPartidosAllowed_solo_fases_activas() {
  const activas = ['FASE_LIGA', 'FASE_16', 'FASE_8', 'FASE_4', 'FASE_SEMIS', 'FASE_FINAL'];
  const inactivas = ['FASE_PRETEMPORADA', 'FASE_PRE16', 'FASE_PRE8', 'FASE_PRE4', 'FASE_PRESEMIS', 'FASE_PREFINAL', 'FASE_POSTFINAL'];
  for (const f of activas) assert.strictEqual(isHoyPartidosAllowed(f), true, `${f} debería permitirse`);
  for (const f of inactivas) assert.strictEqual(isHoyPartidosAllowed(f), false, `${f} no debería permitirse`);
}

function test_getMatchResult_tres_casos() {
  assert.strictEqual(getMatchResult(2, 1), 'H');
  assert.strictEqual(getMatchResult(1, 1), 'D');
  assert.strictEqual(getMatchResult(0, 3), 'A');
}

function test_getTodayMatches_misma_fecha_local_y_fase() {
  // 2026-09-08 21:00 local = timestamp en segundos
  const now = new Date(2026, 8, 8, 12, 0, 0).getTime(); // 8 Sep 2026 12:00 local
  const fechaHoy = new Date(2026, 8, 8, 21, 0, 0);
  const fechaOtroDia = new Date(2026, 8, 9, 21, 0, 0);
  const matches = [
    { id: 1, fase: 'liga', fechaTs: Math.floor(fechaHoy.getTime() / 1000) },
    { id: 2, fase: '16', fechaTs: Math.floor(fechaHoy.getTime() / 1000) },   // otra fase
    { id: 3, fase: 'liga', fechaTs: Math.floor(fechaOtroDia.getTime() / 1000) } // otro día
  ];
  const res = getTodayMatches(matches, now, 'liga');
  assert.deepStrictEqual(res.map(m => m.id), [1]);
}

function test_getTodayMatches_sin_partidos_devuelve_vacio() {
  const now = new Date(2026, 8, 9, 12, 0, 0).getTime();
  const matches = [{ id: 1, fase: 'liga', fechaTs: Math.floor(new Date(2026, 8, 8, 21, 0, 0).getTime() / 1000) }];
  assert.deepStrictEqual(getTodayMatches(matches, now, 'liga'), []);
}

function test_computeResultCounts_conteos_y_pct() {
  const allPredictions = {
    a: { 100: { home: 2, away: 1 } },   // H
    b: { 100: { home: 1, away: 1 } },   // D
    c: { 100: { home: 0, away: 2 } },   // A
    d: { 100: { home: 1, away: 0 } },   // H
    e: { 100: { home: null, away: null } }, // sin pronóstico → se ignora
    f: {}                                // sin pronóstico → se ignora
  };
  const r = computeResultCounts(100, allPredictions);
  assert.strictEqual(r.total, 4);
  assert.deepStrictEqual(r.counts, { H: 2, D: 1, A: 1 });
  assert.strictEqual(r.pct.H, 0.5);
  assert.strictEqual(r.pct.D, 0.25);
  assert.strictEqual(r.pct.A, 0.25);
}

function test_computeResultCounts_sin_datos() {
  const r = computeResultCounts(100, { a: {}, b: { 100: { home: null, away: null } } });
  assert.strictEqual(r.total, 0);
  assert.deepStrictEqual(r.pct, { H: 0, D: 0, A: 0 });
}

function test_computeBestResult_pronostico_minoritario_gana() {
  const counts = { counts: { H: 3, D: 1, A: 2 }, total: 6, pct: { H: 0.5, D: 1 / 6, A: 1 / 3 } };
  // Mi pronóstico es D (minoría) → ventaja D = 8*(1-1/6)=6.67 > H=4 > A=8*(2/3)=5.33? no: A no es mío → -8*(1/3)
  const best = computeBestResult(counts, 'D');
  assert.strictEqual(best.result, 'D');
  assert.ok(Math.abs(best.advantage - 8 * (1 - 1 / 6)) < 1e-9);
}

function test_computeBestResult_sin_total_o_sin_pronostico_devuelve_null() {
  const counts = { counts: { H: 0, D: 0, A: 0 }, total: 0, pct: { H: 0, D: 0, A: 0 } };
  assert.strictEqual(computeBestResult(counts, 'H'), null);
  const counts2 = { counts: { H: 3, D: 1, A: 2 }, total: 6, pct: { H: 0.5, D: 1 / 6, A: 1 / 3 } };
  assert.strictEqual(computeBestResult(counts2, null), null);
}

function test_getRealResult_y_calcMatchPoints() {
  const match = { id: 5, homeTeamId: 10, awayTeamId: 20 };
  const matchStats = [
    { eventId: 5, stats: { 10: { goles: 1 }, 20: { goles: 1 } } },
    { eventId: 6, stats: { 10: { goles: 1 } } } // incompleto → null
  ];
  assert.deepStrictEqual(getRealResult(match, matchStats), { home: 1, away: 1 });
  assert.strictEqual(getRealResult({ id: 6, homeTeamId: 10, awayTeamId: 20 }, matchStats), null);
  assert.strictEqual(getRealResult({ id: 99, homeTeamId: 10, awayTeamId: 20 }, matchStats), null);

  // Acierto exacto 1-1 → 8+3+3+1 = 15
  assert.strictEqual(calcMatchPoints({ home: 1, away: 1 }, 1, 1), 15);
  // Solo resultado → 8
  assert.strictEqual(calcMatchPoints({ home: 2, away: 0 }, 1, 1), 0);
  assert.strictEqual(calcMatchPoints({ home: 1, away: 0 }, 1, 1), 8);
  // Sin pronóstico → 0
  assert.strictEqual(calcMatchPoints(null, 1, 1), 0);
}

function test_formatMatchTime_formato_esperado() {
  const ts = new Date(2026, 8, 8, 21, 5).getTime() / 1000; // 8 Sep 2026 21:05 local
  const s = formatMatchTime(ts);
  assert.match(s, /Sep/);
  assert.match(s, /21:05/);
}

test_isHoyPartidosAllowed_solo_fases_activas();
test_getMatchResult_tres_casos();
test_getTodayMatches_misma_fecha_local_y_fase();
test_getTodayMatches_sin_partidos_devuelve_vacio();
test_computeResultCounts_conteos_y_pct();
test_computeResultCounts_sin_datos();
test_computeBestResult_pronostico_minoritario_gana();
test_computeBestResult_sin_total_o_sin_pronostico_devuelve_null();
test_getRealResult_y_calcMatchPoints();
test_formatMatchTime_formato_esperado();
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `node tests/hoyPartidos.test.js`
Expected: FAIL — `Cannot find module '../js/hoyPartidos.js'`

- [ ] **Step 3: Implementar el módulo**

Crear `js/hoyPartidos.js`:

```js
(function (global) {
  const ACTIVE_PHASES = ['FASE_LIGA', 'FASE_16', 'FASE_8', 'FASE_4', 'FASE_SEMIS', 'FASE_FINAL'];

  function isHoyPartidosAllowed(fase) {
    return ACTIVE_PHASES.includes(fase);
  }

  function getMatchResult(home, away) {
    if (home > away) return 'H';
    if (home < away) return 'A';
    return 'D';
  }

  function getTodayMatches(matches, nowMs, calendarFase) {
    const now = new Date(nowMs);
    return (matches || []).filter(m => {
      const d = new Date(m.fechaTs * 1000);
      return m.fase === calendarFase &&
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    });
  }

  function computeResultCounts(matchId, allPredictions) {
    const counts = { H: 0, D: 0, A: 0 };
    let total = 0;
    for (const username of Object.keys(allPredictions || {})) {
      const p = allPredictions[username]?.[matchId];
      if (!p || typeof p.home !== 'number' || typeof p.away !== 'number') continue;
      counts[getMatchResult(p.home, p.away)]++;
      total++;
    }
    const pct = { H: 0, D: 0, A: 0 };
    if (total > 0) {
      pct.H = counts.H / total;
      pct.D = counts.D / total;
      pct.A = counts.A / total;
    }
    return { counts, total, pct };
  }

  function computeBestResult(counts, myResult) {
    if (!counts || counts.total === 0) return null;
    if (myResult !== 'H' && myResult !== 'D' && myResult !== 'A') return null;
    let best = null;
    for (const r of ['H', 'D', 'A']) {
      const advantage = r === myResult ? 8 * (1 - counts.pct[r]) : -8 * counts.pct[r];
      if (!best || advantage > best.advantage) best = { result: r, advantage };
    }
    return best;
  }

  function getRealResult(match, matchStats) {
    const ms = (matchStats || []).find(s => s.eventId === match.id);
    if (!ms || !ms.stats) return null;
    const home = ms.stats[match.homeTeamId]?.goles;
    const away = ms.stats[match.awayTeamId]?.goles;
    if (home === undefined || away === undefined) return null;
    return { home, away };
  }

  function calcMatchPoints(myPrediction, realHome, realAway) {
    if (!myPrediction || typeof myPrediction.home !== 'number' || typeof myPrediction.away !== 'number') return 0;
    if (realHome === undefined || realAway === undefined) return 0;
    let points = 0;
    if (getMatchResult(myPrediction.home, myPrediction.away) === getMatchResult(realHome, realAway)) points += 8;
    if (myPrediction.home === realHome) points += 3;
    if (myPrediction.away === realAway) points += 3;
    if (myPrediction.home === realHome && myPrediction.away === realAway) points += 1;
    return points;
  }

  function formatMatchTime(fechaTs) {
    const d = new Date(fechaTs * 1000);
    const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const hora = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dias[d.getDay()]} ${d.getDate()} ${meses[d.getMonth()]} · ${hora}:${min}`;
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const hoyPartidosApi = {
    isHoyPartidosAllowed, getMatchResult, getTodayMatches,
    computeResultCounts, computeBestResult, getRealResult,
    calcMatchPoints, formatMatchTime, esc
  };
  global.hoyPartidosApi = hoyPartidosApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = hoyPartidosApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `node tests/hoyPartidos.test.js`
Expected: PASS (todas las aserciones).

- [ ] **Step 5: Commit**

```bash
git add js/hoyPartidos.js tests/hoyPartidos.test.js
git commit -m "feat: módulo hoyPartidos con cálculos 1X2 y ventaja relativa"
```

---

### Task 2: Builders HTML de la sección (tarjeta + desplegable)

**Files:**
- Modify: `js/hoyPartidos.js` (añadir `buildMatchCardHtml` y `buildStatsHtml`)
- Modify: `tests/hoyPartidos.test.js` (añadir tests de los builders)

**Interfaces:**
- Consumes: `esc`, `formatMatchTime`, `getMatchResult`, `computeResultCounts`, `computeBestResult`, `getRealResult`, `calcMatchPoints` (Task 1).
- Produces: `buildMatchCardHtml(opts) -> string` y `buildStatsHtml(opts) -> string`, añadidas a `hoyPartidosApi`.

`buildMatchCardHtml(opts)` — `opts = { match, predDisplay, hasPred, real, pts, counts, best }` (escudos vía `match.homeTeamId`/`match.homeBadgeExt` y `match.awayTeamId`/`match.awayBadgeExt`; nombres vía `match.homeTeam`/`match.awayTeam`).

`buildStatsHtml(opts)` — `opts = { counts, myResult, best, real, homeTeam, awayTeam, realResult }`. Devuelve el HTML del desplegable (barras + notas), o el HTML de "Aún no hay pronósticos" si `counts.total === 0`.

- [ ] **Step 1: Añadir los tests de los builders**

Añadir a `tests/hoyPartidos.test.js` (antes de las invocaciones finales):

```js
const { buildMatchCardHtml, buildStatsHtml } = require('../js/hoyPartidos.js');

function test_buildMatchCardHtml_contiene_datos_clave() {
  const match = { id: 5, fase: 'liga', fechaTs: Math.floor(new Date(2026, 8, 8, 21, 0).getTime() / 1000), homeTeam: 'Athletic Club', homeTeamId: 10, homeBadgeExt: 'webp', awayTeam: 'Arsenal', awayTeamId: 20, awayBadgeExt: 'webp' };
  const counts = { counts: { H: 0, D: 0, A: 0 }, total: 0, pct: { H: 0, D: 0, A: 0 } };
  const html = buildMatchCardHtml({ match, predDisplay: '2 - 1', hasPred: true, real: null, pts: 0, counts, best: null });
  assert.match(html, /hoy-card/);
  assert.match(html, /Athletic Club/);
  assert.match(html, /Arsenal/);
  assert.match(html, /data-match="5"/);
  assert.match(html, /Tu pronóstico: 2 - 1/);
  assert.match(html, /data\/imgEquipos\/10\.webp/);
}

function test_buildMatchCardHtml_con_resultado_real() {
  const match = { id: 5, fase: 'liga', fechaTs: Math.floor(new Date(2026, 8, 8, 21, 0).getTime() / 1000), homeTeam: 'PSG', homeTeamId: 10, homeBadgeExt: 'webp', awayTeam: 'Real Madrid', awayTeamId: 20, awayBadgeExt: 'webp' };
  const counts = { counts: { H: 4, D: 5, A: 3 }, total: 12, pct: { H: 4 / 12, D: 5 / 12, A: 3 / 12 } };
  const html = buildMatchCardHtml({ match, predDisplay: '1 - 1', hasPred: true, real: { home: 1, away: 1 }, pts: 15, counts, best: { result: 'D', advantage: 4.7 } });
  assert.match(html, /Resultado real: 1 - 1/);
  assert.match(html, /Acertaste/);
}

function test_buildStatsHtml_barras_porcentajes_mejor() {
  const counts = { counts: { H: 4, D: 5, A: 3 }, total: 12, pct: { H: 4 / 12, D: 5 / 12, A: 3 / 12 } };
  const html = buildStatsHtml({ counts, myResult: 'D', best: { result: 'D', advantage: 8 * (1 - 5 / 12) }, real: null, homeTeam: 'PSG', awayTeam: 'Real Madrid', realResult: null });
  assert.match(html, /Pronósticos de la porra/);
  assert.match(html, /12 jugadores/);
  assert.match(html, /33%/);
  assert.match(html, /42%/);
  assert.match(html, /25%/);
  assert.match(html, /tu pronóstico/);
  assert.match(html, /Mejor para ti/);
  assert.match(html, /sobre la media/);
}

function test_buildStatsHtml_sin_pronosticos() {
  const counts = { counts: { H: 0, D: 0, A: 0 }, total: 0, pct: { H: 0, D: 0, A: 0 } };
  const html = buildStatsHtml({ counts, myResult: null, best: null, real: null, homeTeam: 'A', awayTeam: 'B', realResult: null });
  assert.match(html, /Aún no hay pronósticos/);
}

function test_buildStatsHtml_con_resultado_real_nota_acertaron() {
  const counts = { counts: { H: 4, D: 5, A: 3 }, total: 12, pct: { H: 4 / 12, D: 5 / 12, A: 3 / 12 } };
  const html = buildStatsHtml({ counts, myResult: 'D', best: { result: 'D', advantage: 4.7 }, real: { home: 1, away: 1 }, homeTeam: 'PSG', awayTeam: 'Real Madrid', realResult: 'D' });
  assert.match(html, /Acertaron el resultado/);
  assert.match(html, /5\/12/);
}

test_buildMatchCardHtml_contiene_datos_clave();
test_buildMatchCardHtml_con_resultado_real();
test_buildStatsHtml_barras_porcentajes_mejor();
test_buildStatsHtml_sin_pronosticos();
test_buildStatsHtml_con_resultado_real_nota_acertaron();
```

- [ ] **Step 2: Ejecutar los tests para verificar que fallan**

Run: `node tests/hoyPartidos.test.js`
Expected: FAIL — `buildMatchCardHtml is not a function`.

- [ ] **Step 3: Implementar los builders**

Añadir a `js/hoyPartidos.js` (antes de `const hoyPartidosApi = ...`):

```js
  function teamImg(teamId, ext, alt) {
    return `<img src="data/imgEquipos/${teamId}.${ext}" alt="${esc(alt)}" loading="lazy">`;
  }

  function buildMatchCardHtml(opts) {
    const { match, predDisplay, hasPred, real, pts, counts, best } = opts;
    const isReal = !!real;
    const scoreLine = isReal ? `${real.home} - ${real.away}` : predDisplay;
    const scoreLabel = isReal ? 'Resultado real' : (hasPred ? 'Tu pronóstico' : 'Sin pronóstico');
    const footMine = `Tu pronóstico: ${predDisplay}`;
    const footReal = isReal
      ? (pts > 0 ? `<span class="ok">✔ Acertaste (${pts} pts)</span>` : `<span class="ko">✘ No acertaste</span>`)
      : '';
    return `
      <div class="hoy-card" data-match="${match.id}" onclick="this.classList.toggle('open')">
        <div class="hoy-card-header">
          <span>⚽ Hoy · ${formatMatchTime(match.fechaTs)}</span>
          <span class="hoy-chev">▾</span>
        </div>
        <div class="hoy-teams">
          <div class="hoy-team">
            ${teamImg(match.homeTeamId, match.homeBadgeExt, match.homeTeam)}
            <div class="hoy-team-name">${esc(match.homeTeam)}</div>
          </div>
          <div class="hoy-score${isReal ? ' real' : ''}">
            <div class="hoy-score-line">${scoreLine}</div>
            <div class="hoy-score-label">${scoreLabel}</div>
          </div>
          <div class="hoy-team">
            ${teamImg(match.awayTeamId, match.awayBadgeExt, match.awayTeam)}
            <div class="hoy-team-name">${esc(match.awayTeam)}</div>
          </div>
        </div>
        <div class="hoy-foot">
          <span class="mine">${footMine}</span>
          ${footReal}
        </div>
        ${buildStatsHtml({
          counts, myResult: best ? best.result : null,
          best, real, homeTeam: match.homeTeam, awayTeam: match.awayTeam,
          realResult: isReal ? getMatchResult(real.home, real.away) : null
        })}
      </div>`;
  }

  function buildStatsHtml(opts) {
    const { counts, myResult, best, real, homeTeam, awayTeam, realResult } = opts;
    if (!counts || counts.total === 0) {
      return `<div class="hoy-stats"><div class="hoy-empty">Aún no hay pronósticos de la porra en este partido.</div></div>`;
    }
    const rows = [
      { key: 'H', tag: '1', name: homeTeam },
      { key: 'D', tag: 'X', name: 'Empate' },
      { key: 'A', tag: '2', name: awayTeam }
    ].map(({ key, tag, name }) => {
      const pct = Math.round(counts.pct[key] * 100);
      const cls = [
        key === myResult ? 'mine' : '',
        best && key === best.result ? 'best' : '',
        key === realResult ? 'real-result' : ''
      ].filter(Boolean).join(' ');
      return `
        <div class="hoy-stat-row ${cls}">
          <span class="hoy-stat-tag">${tag}</span>
          <span class="hoy-stat-name">${esc(name)}</span>
          <span class="hoy-bar-track"><span class="hoy-bar-fill" style="width:${pct}%"></span></span>
          <span class="hoy-stat-pct">${pct}%</span>
        </div>`;
    }).join('');

    const bestNote = best
      ? `<div class="hoy-best-note">⚡ <strong>Mejor para ti: ${esc(bestNameOf(best.result, homeTeam, awayTeam))}</strong> — si aciertas este resultado ganas <strong>≈ ${best.advantage.toFixed(1)} pts sobre la media</strong>.</div>`
      : '';

    const realNote = real
      ? `<div class="hoy-real-note"><b>Resultado: ${real.home} - ${real.away}</b> · Acertaron el resultado: ${counts.counts[realResult]}/${counts.total} (${Math.round(counts.pct[realResult] * 100)}%)</div>`
      : '';

    return `
      <div class="hoy-stats">
        <div class="hoy-stats-hint">Pronósticos de la porra · ${counts.total} jugadores</div>
        ${rows}
        ${bestNote}
        ${realNote}
      </div>`;
  }

  function bestNameOf(result, homeTeam, awayTeam) {
    if (result === 'H') return homeTeam;
    if (result === 'A') return awayTeam;
    return 'Empate';
  }
```

Añadir `buildMatchCardHtml` y `buildStatsHtml` al objeto exportado:

```js
  const hoyPartidosApi = {
    isHoyPartidosAllowed, getMatchResult, getTodayMatches,
    computeResultCounts, computeBestResult, getRealResult,
    calcMatchPoints, formatMatchTime, esc,
    buildMatchCardHtml, buildStatsHtml
  };
```

- [ ] **Step 4: Ejecutar los tests para verificar que pasan**

Run: `node tests/hoyPartidos.test.js`
Expected: PASS. Si el test de barras falla por redondeo (42% vs 5/12=41.67→42%), ajustar los valores esperados al redondeo real de `Math.round`.

- [ ] **Step 5: Commit**

```bash
git add js/hoyPartidos.js tests/hoyPartidos.test.js
git commit -m "feat: builders HTML de tarjetas y estadísticas 1X2 para Hoy tenemos partidos"
```

---

### Task 3: Integración en `renderInicioTab()` y re-render en `enterApp()`

**Files:**
- Modify: `js/main.js:3170-3362` (`renderInicioTab`)
- Modify: `js/main.js:2225-2261` (`enterApp`)

**Interfaces:**
- Consumes: `window.hoyPartidosApi.renderHoyPartidos(container)` (a implementar en el Step 3 de esta tarea), `getFaseJuego()`, `getFaseForCurrentPhase()`, `AppState` (matches, scorePredictions, allPredictions, matchStats, teamsMap).

- [ ] **Step 1: Implementar `renderHoyPartidos` y añadir el contenedor en `renderInicioTab()`**

En `js/hoyPartidos.js`, añadir `renderHoyPartidos` y exponerla en `hoyPartidosApi`:

```js
  function renderHoyPartidos(container) {
    if (!container) container = document.getElementById('hoy-partidos-section');
    if (!container) return;
    const fase = getFaseJuego();
    if (!isHoyPartidosAllowed(fase)) { container.innerHTML = ''; return; }

    const calendarFase = getFaseForCurrentPhase();
    const todayMatches = getTodayMatches(AppState.matches, Date.now(), calendarFase);
    if (!todayMatches.length) { container.innerHTML = ''; return; }

    const scorePreds = AppState.scorePredictions || {};
    const allPreds = AppState.allPredictions || {};
    const matchStats = AppState.matchStats || [];

    const cardsHtml = todayMatches.map(match => {
      const pred = scorePreds[match.id];
      const hasPred = pred && typeof pred.home === 'number' && typeof pred.away === 'number';
      const predDisplay = hasPred ? `${pred.home} - ${pred.away}` : '– –';
      const myResult = hasPred ? getMatchResult(pred.home, pred.away) : null;
      const real = getRealResult(match, matchStats);
      const counts = computeResultCounts(match.id, allPreds);
      const best = computeBestResult(counts, myResult);
      const pts = real ? calcMatchPoints(pred, real.home, real.away) : 0;
      return buildMatchCardHtml({ match, predDisplay, hasPred, real, pts, counts, best });
    }).join('');

    container.innerHTML = `
      <div class="hoy-title">⚽ <span>Hoy tenemos partidos</span></div>
      ${cardsHtml}
    `;
  }
```

Añadir `renderHoyPartidos` a `hoyPartidosApi` (junto a `buildMatchCardHtml` y `buildStatsHtml`).

En `js/main.js`, dentro de `renderInicioTab()` (línea ~3221, justo después del bloque `const faseHtml = ...`), añadir:

```js
  const hoyPartidosHtml = '<div id="hoy-partidos-section"></div>';
```

E insertar `hoyPartidosHtml` en el template de `container.innerHTML` **entre** `${faseHtml}` y el bloque `(${(() => { const isPreFase ...`:

```js
    ${faseHtml}

    ${hoyPartidosHtml}

    ${(() => {
```

Y tras `container.innerHTML = \`...\`;` y `setupPointsMenu();` (línea ~3363), añadir la llamada al render:

```js
  renderHoyPartidos();
```

Con esta firma, `renderHoyPartidos` debe localizar el contenedor si no se le pasa:

```js
  function renderHoyPartidos(container) {
    if (!container) container = document.getElementById('hoy-partidos-section');
    if (!container) return;
    ...
```

- [ ] **Step 2: Re-render en `enterApp()` cuando cargan las predicciones de todos**

En `js/main.js`, dentro de `enterApp()` (línea ~2257), sustituir:

```js
  Promise.all([pointsReadyP, new Promise(r => setTimeout(r, 400))]).then(() => {
    AppState.pointsReady = true;
    updatePointsNumber();
  });
```

por:

```js
  Promise.all([pointsReadyP, new Promise(r => setTimeout(r, 400))]).then(() => {
    AppState.pointsReady = true;
    updatePointsNumber();
    const activeTab = document.querySelector('.nav-item.active')?.dataset?.tab;
    if (activeTab === 'inicio') renderInicioTab();
  });
```

- [ ] **Step 3: Verificación manual**

Run: `python3 -m http.server 8000` en la raíz del proyecto y abrir `http://localhost:8000` en vista móvil.
Expected:
- En `FASE_LIGA` (o fase activa) con partidos hoy → aparece "⚽ Hoy tenemos partidos" bajo la tarjeta de fase.
- Tarjetas muestran hora, escudos, nombres y tu pronóstico; pulsa una tarjeta → se despliega (barras 1X2, tu pronóstico resaltado, ⚡ Mejor para ti).
- Si un partido tiene resultado en matchstats → marcador central real (dorado) y nota de acertados.
- Sin partidos hoy o en fase `PRE`/`POST`/pretemporada → la sección no aparece.
- Sin errores en consola.

> Si no es posible probar con una fase activa real, forzar temporalmente en `AppState.appConfig.faseJuego` (DevTools) a `'FASE_LIGA'` y re-navegar a Inicio. Revertir después.

- [ ] **Step 4: Ejecutar todos los tests**

Run: `for f in tests/*.test.js; do node "$f" || echo "FAIL $f"; done`
Expected: todos PASS, sin `FAIL`.

- [ ] **Step 5: Commit**

```bash
git add js/main.js js/hoyPartidos.js
git commit -m "feat: sección Hoy tenemos partidos integrada en el tab Inicio"
```

---

### Task 4: Estilos `.hoy-*` en `css/styles.css`

**Files:**
- Modify: `css/styles.css` (añadir bloque al final de la sección TAB: INICIO, tras línea 1076)

**Interfaces:**
- Consumes: variables `:root` (`--ucl-card`, `--border-color`, `--radius-md`, `--accent-cyan`, `--accent-gold`, `--accent-primary`, `--text-secondary`, `--text-muted`).

- [ ] **Step 1: Añadir los estilos**

Añadir al final del bloque `TAB: INICIO` (después de `.inicio-card-arrow`, línea ~1076):

```css
/* ==========================================================================
   INICIO: HOY TENEMOS PARTIDOS
   ========================================================================== */

.hoy-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 1.05rem;
  font-weight: 800;
  letter-spacing: .3px;
  margin: 18px 2px 10px;
  color: var(--text-primary);
}

.hoy-card {
  background: var(--ucl-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  margin-bottom: 12px;
  overflow: hidden;
  transition: all var(--transition-fast);
}
.hoy-card:active { transform: scale(0.99); background: var(--ucl-card-hover); }
.hoy-card.open { border-color: rgba(6, 182, 212, 0.35); }

.hoy-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 0;
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 600;
  letter-spacing: .2px;
}

.hoy-chev {
  color: var(--text-muted);
  font-size: 14px;
  transition: transform var(--transition-normal);
}
.hoy-card.open .hoy-chev { transform: rotate(180deg); }

.hoy-teams {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px 6px;
}

.hoy-team {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-align: center;
}
.hoy-team img { width: 40px; height: 40px; object-fit: contain; }
.hoy-team-name { font-size: 12px; font-weight: 700; line-height: 1.2; }

.hoy-score { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.hoy-score-line { font-size: 1.5rem; font-weight: 800; font-variant-numeric: tabular-nums; }
.hoy-score.real .hoy-score-line { color: var(--accent-gold); }
.hoy-score-label { font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px; }

.hoy-foot {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 0 14px 12px;
  font-size: 11px;
}
.hoy-foot .mine { color: var(--accent-cyan); font-weight: 700; }
.hoy-foot .ok { color: var(--accent-primary); font-weight: 700; }
.hoy-foot .ko { color: #ef4444; font-weight: 700; }

.hoy-stats {
  display: none;
  padding: 4px 14px 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  margin-top: 2px;
}
.hoy-card.open .hoy-stats { display: block; }

.hoy-stats-hint {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 700;
  padding: 10px 0 8px;
  text-transform: uppercase;
  letter-spacing: .4px;
}

.hoy-stat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.hoy-stat-tag {
  flex-shrink: 0;
  width: 34px;
  text-align: center;
  font-size: 10px;
  font-weight: 800;
  padding: 3px 0;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
  color: var(--text-secondary);
}
.hoy-stat-row.mine .hoy-stat-tag {
  background: rgba(6, 182, 212, 0.18);
  color: var(--accent-cyan);
  border: 1px solid rgba(6, 182, 212, 0.5);
}
.hoy-stat-row.best .hoy-stat-tag {
  background: rgba(245, 158, 11, 0.15);
  color: var(--accent-gold);
  border: 1px solid rgba(245, 158, 11, 0.5);
}
.hoy-stat-row.real-result .hoy-stat-tag {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-primary);
  border: 1px solid rgba(16, 185, 129, 0.5);
}
.hoy-stat-name {
  flex-shrink: 0;
  font-size: 12px;
  width: 92px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.hoy-bar-track {
  flex: 1;
  height: 12px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  overflow: hidden;
}
.hoy-bar-fill {
  height: 100%;
  border-radius: 8px;
  background: linear-gradient(90deg, #1E3A5F, var(--accent-cyan));
}
.hoy-stat-row.mine .hoy-bar-fill {
  background: linear-gradient(90deg, #0E7490, var(--accent-cyan));
  box-shadow: 0 0 8px rgba(6, 182, 212, 0.5);
}
.hoy-stat-row.best .hoy-bar-fill {
  background: linear-gradient(90deg, #B45309, var(--accent-gold));
}
.hoy-stat-pct {
  flex-shrink: 0;
  width: 38px;
  text-align: right;
  font-size: 12px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}
.hoy-stat-row.mine .hoy-stat-pct { color: var(--accent-cyan); }
.hoy-stat-row.best .hoy-stat-pct { color: var(--accent-gold); }

.hoy-best-note {
  margin-top: 10px;
  padding: 9px 11px;
  border-radius: var(--radius-sm);
  background: rgba(245, 158, 11, 0.07);
  border: 1px solid rgba(245, 158, 11, 0.3);
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.45;
}
.hoy-best-note strong { color: var(--accent-gold); }

.hoy-real-note {
  margin-top: 8px;
  font-size: 11px;
  color: var(--text-muted);
}
.hoy-real-note b { color: var(--accent-primary); }

.hoy-empty {
  padding: 12px 14px;
  font-size: 12px;
  color: var(--text-muted);
  text-align: center;
}
```

- [ ] **Step 2: Verificación visual**

Run: recargar `http://localhost:8000` en vista móvil con la sección visible (mismo procedimiento que Task 3 Step 3).
Expected: tarjetas glass oscuras coherentes con el resto de Inicio; barras con gradiente cyan; tag 1/X/2 legible; fila de tu pronóstico resaltada; nota dorada de "Mejor para ti"; sin scroll horizontal.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "style: estilos de la sección Hoy tenemos partidos en Inicio"
```

---

### Task 5: `index.html` (script + cache-busting) y verificación final

**Files:**
- Modify: `index.html` (líneas 265-269: bloque de scripts)

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Añadir el script y subir versiones**

En `index.html`, añadir justo antes de `main.js`:

```html
  <script src="js/hoyPartidos.js?v=1"></script>
```

E incrementar las versiones existentes:
- `css/styles.css?v=X` → `?v=X+1`
- `js/main.js?v=101` → `?v=102`

- [ ] **Step 2: Verificación final (tests + consola)**

Run:
1. `for f in tests/*.test.js; do node "$f" || echo "FAIL $f"; done` → todos PASS.
2. Cargar la app en móvil vertical y comprobar: sección visible solo en fases activas con partidos hoy; expansión/colapso de tarjetas; sin errores en consola; sin scroll horizontal.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: registrar js/hoyPartidos.js y subir versiones de cache en index.html"
```

---

## Self-Review

- **Cobertura spec:** módulo + funciones puras (Task 1) ✓ · builders UI (Task 2) ✓ · integración Inicio + re-render (Task 3) ✓ · estilos (Task 4) ✓ · index.html + cache-busting (Task 5) ✓ · fórmula de ventaja relativa cubierta en `computeBestResult` (Task 1) ✓ · resultado real y acertados cubiertos (Tasks 1-2) ✓.
- **Placeholders:** ninguno; todo el código está en el plan.
- **Tipos/consistencia:** `hoyPartidosApi` expone y consumen las mismas firmas; `renderHoyPartidos(container?)` admite contenedor opcional; `getFaseJuego`/`getFaseForCurrentPhase` son globales de `main.js` y se invocan en tiempo de render (cargado tras `hoyPartidos.js`).
