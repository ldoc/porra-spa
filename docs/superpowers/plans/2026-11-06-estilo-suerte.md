# Estilo y suerte (Fase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir a Individual las métricas de suerte vs habilidad, robos/faroles y acierto por confianza, calculadas en cliente.

**Architecture:** Tres funciones puras nuevas en `js/stats.js` (consenso, puntos esperados y estadísticas de estilo), exportadas para tests, más tres renderers integrados en `renderIndividualBody`. Sin cambios de API ni backend.

**Tech Stack:** JavaScript Vanilla ES6+ (IIFE), Node `assert`, CSS vanilla con variables existentes.

> **Actualización 2026-11-06:** la etiqueta final de suerte es relativa a la porra (`z ≥ +1σ` afortunado, `z ≤ −1σ` desafortunado), calculada por `calcLuckLabels`. El cache-busting final es `js/stats.js?v=23`. El resto del plan se mantiene como registro histórico.

## Global Constraints

- Solo liga (`match.fase === 'liga'`) y partidos con resultado.
- La comunidad excluye al usuario analizado y exige **≥5 pronósticos ajenos** por partido; si no, el partido se excluye y se cuenta en `excludedLowSample`.
- Puntos reales desde `userPoints[username].matchDetails`; no se duplica el scoring.
- `esperado = 8·P(resultado) + 3·P(goles local) + 3·P(goles visitante) + 1·P(exacto)`.
- Robo: acierto 1X2 con apoyo <50% y puntos > media de los otros. Farol: fallo con el 1X2 más votado (`plurality`).
- Confianza: mayoría ≥50%, ajustada ≥33 y <50%, minoría <33%.
- Invitados: respetar `statsPlayers()`.
- Sin cambios de API/backend.
- Tests con Node puro: `node tests/estadisticasEstilo.test.js`.
- Cache-busting final: `js/stats.js?v=22` y `css/styles.css?v=137`.
- **Commits:** ejecutar los pasos de commit solo si el usuario ha autorizado commits explícitamente.

---

## File Structure

| Fichero | Responsabilidad |
|---|---|
| `js/stats.js` | Consenso, puntos esperados, estadísticas de estilo y renderers |
| `tests/estadisticasEstilo.test.js` | Tests unitarios de las tres funciones puras |
| `css/styles.css` | Estilos de barras de suerte, robos/faroles y confianza |
| `index.html` | Bump de `stats.js` y `styles.css` |

---

### Task 1: Consenso y puntos esperados

**Files:**
- Modify: `js/stats.js` (insertar tras `calcDataCoverage`, antes de `buildDonutSegments`)
- Create: `tests/estadisticasEstilo.test.js`

**Interfaces:**
- Consumes: `matchResultOf(homeGoals, awayGoals)` existente.
- Produces:
  - `buildMatchConsensus(allPredictions, playerNames, excludeUsername)` → `Map<string, { total, counts, pct, scoreCounts, homeGoalCounts, awayGoalCounts, plurality }>`.
  - `expectedPointsForPrediction(prediction, consensus)` → número redondeado a 2 decimales.

- [ ] **Step 1: Write the failing test**

Create `tests/estadisticasEstilo.test.js`:

```javascript
const assert = require('assert');
const { buildMatchConsensus, expectedPointsForPrediction } = require('../js/stats.js');

function test_expectedPointsForPrediction_desglose_completo() {
  const consensus = {
    total: 5,
    counts: { H: 3, D: 1, A: 1 },
    pct: { H: 60, D: 20, A: 20 },
    scoreCounts: new Map([['2-1', 2], ['1-0', 1], ['0-0', 1], ['1-2', 1]]),
    homeGoalCounts: new Map([[2, 3], [1, 1], [0, 1]]),
    awayGoalCounts: new Map([[1, 2], [0, 2], [2, 1]]),
    plurality: 'H',
  };
  assert.strictEqual(expectedPointsForPrediction({ home: 2, away: 1 }, consensus), 8.2);
  assert.strictEqual(expectedPointsForPrediction(null, consensus), 0);
  assert.strictEqual(expectedPointsForPrediction({ home: 2, away: 1 }, { total: 0 }), 0);
}

function test_buildMatchConsensus_excluye_usuario_y_desempata() {
  const allPredictions = {
    ana: { 1: { home: 5, away: 5 }, 2: { home: 5, away: 5 } },
    bob: { 1: { home: 1, away: 0 }, 2: { home: 1, away: 0 } },
    carol: { 1: { home: 2, away: 1 }, 2: { home: 2, away: 1 } },
    dave: { 1: { home: 0, away: 0 }, 2: { home: 0, away: 0 } },
    erin: { 1: { home: 0, away: 2 }, 2: { home: 0, away: 0 } },
    frank: { 1: { home: 1, away: 0 }, 2: { home: 0, away: 2 } },
  };
  const map = buildMatchConsensus(allPredictions, ['ana', 'bob', 'carol', 'dave', 'erin', 'frank'], 'ana');
  const m1 = map.get('1');
  assert.strictEqual(m1.total, 5);
  assert.deepStrictEqual(m1.counts, { H: 3, D: 1, A: 1 });
  assert.strictEqual(m1.plurality, 'H');
  assert.strictEqual(m1.scoreCounts.get('1-0'), 2);
  assert.strictEqual(m1.homeGoalCounts.get(0), 2);
  assert.strictEqual(m1.awayGoalCounts.get(0), 3);

  // H=2, D=2, A=1 → empate H/D resuelto por orden H > D.
  const m2 = map.get('2');
  assert.deepStrictEqual(m2.counts, { H: 2, D: 2, A: 1 });
  assert.strictEqual(m2.plurality, 'H');
}

test_expectedPointsForPrediction_desglose_completo();
test_buildMatchConsensus_excluye_usuario_y_desempata();
console.log('OK estadisticasEstilo T1');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticasEstilo.test.js`
Expected: FAIL with `TypeError: buildMatchConsensus is not a function`.

- [ ] **Step 3: Write minimal implementation**

En `js/stats.js`, insertar después de `calcDataCoverage` y antes de `buildDonutSegments`:

```javascript
  function buildMatchConsensus(allPredictions, playerNames, excludeUsername) {
    const names = (playerNames || []).filter(name => name !== excludeUsername);
    const byMatch = new Map();

    for (const name of names) {
      const preds = allPredictions?.[name] || {};
      for (const [matchId, pred] of Object.entries(preds)) {
        if (!pred || !Number.isFinite(pred.home) || !Number.isFinite(pred.away)) continue;
        const key = String(matchId);
        if (!byMatch.has(key)) {
          byMatch.set(key, {
            total: 0,
            counts: { H: 0, D: 0, A: 0 },
            pct: { H: 0, D: 0, A: 0 },
            scoreCounts: new Map(),
            homeGoalCounts: new Map(),
            awayGoalCounts: new Map(),
            plurality: null,
          });
        }
        const entry = byMatch.get(key);
        const result = matchResultOf(pred.home, pred.away);
        const scoreKey = `${pred.home}-${pred.away}`;
        entry.total++;
        entry.counts[result]++;
        entry.scoreCounts.set(scoreKey, (entry.scoreCounts.get(scoreKey) || 0) + 1);
        entry.homeGoalCounts.set(pred.home, (entry.homeGoalCounts.get(pred.home) || 0) + 1);
        entry.awayGoalCounts.set(pred.away, (entry.awayGoalCounts.get(pred.away) || 0) + 1);
      }
    }

    for (const entry of byMatch.values()) {
      if (!entry.total) continue;
      entry.pct = {
        H: Math.round((entry.counts.H / entry.total) * 100),
        D: Math.round((entry.counts.D / entry.total) * 100),
        A: Math.round((entry.counts.A / entry.total) * 100),
      };
      entry.plurality = ['H', 'D', 'A'].reduce((best, key) => {
        if (best === null) return key;
        return entry.counts[key] > entry.counts[best] ? key : best;
      }, null);
    }

    return byMatch;
  }

  function expectedPointsForPrediction(prediction, consensus) {
    if (!prediction || !Number.isFinite(prediction.home) || !Number.isFinite(prediction.away)) return 0;
    if (!consensus || !consensus.total) return 0;

    const total = consensus.total;
    const result = matchResultOf(prediction.home, prediction.away);
    const scoreKey = `${prediction.home}-${prediction.away}`;
    const expected =
      8 * ((consensus.counts?.[result] || 0) / total) +
      3 * ((consensus.homeGoalCounts?.get(prediction.home) || 0) / total) +
      3 * ((consensus.awayGoalCounts?.get(prediction.away) || 0) / total) +
      1 * ((consensus.scoreCounts?.get(scoreKey) || 0) / total);

    return Math.round(expected * 100) / 100;
  }
```

Además, al final de `js/stats.js`, añadir:

```javascript
  global.buildMatchConsensus = buildMatchConsensus;
  global.expectedPointsForPrediction = expectedPointsForPrediction;
```

Y añadir ambas al objeto de `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticasEstilo.test.js`
Expected: PASS and print `OK estadisticasEstilo T1`.

- [ ] **Step 5: Commit (solo si el usuario autorizó commits)**

```bash
git add js/stats.js tests/estadisticasEstilo.test.js
git commit -m "feat(stats): consenso de porra y puntos esperados"
```

---

### Task 2: Estadísticas de estilo

**Files:**
- Modify: `js/stats.js` (insertar tras `expectedPointsForPrediction`)
- Modify: `tests/estadisticasEstilo.test.js`

**Interfaces:**
- Consumes: `buildMatchConsensus`, `expectedPointsForPrediction`, `matchResultOf`.
- Produces:
  - `calcStyleStats(username, playedMatches, allPredictions, userPoints, matchesById, playerNames)` → `{ analyzedMatches, excludedLowSample, actualPoints, expectedPoints, luckDelta, luckPerMatch, luckLabel, robos, faroles, confidence }`.

- [ ] **Step 1: Write the failing test**

Actualizar el `require`:

```javascript
const { buildMatchConsensus, expectedPointsForPrediction, calcStyleStats } = require('../js/stats.js');
```

Añadir al final:

```javascript
function buildStyleFixture() {
  const playerNames = ['ana', 'bob', 'carol', 'dave', 'erin', 'frank'];
  const matchesById = {
    10: { id: 10, fase: 'liga', ronda: 1, homeTeam: 'A', awayTeam: 'B' },
    11: { id: 11, fase: 'liga', ronda: 2, homeTeam: 'C', awayTeam: 'D' },
    12: { id: 12, fase: 'liga', ronda: 3, homeTeam: 'E', awayTeam: 'F' },
    14: { id: 14, fase: 'liga', ronda: 4, homeTeam: 'G', awayTeam: 'H' },
    15: { id: 15, fase: '16', ronda: 5, homeTeam: 'I', awayTeam: 'J' },
  };
  const playedMatches = [
    { matchId: 10, home: 0, away: 1, result: 'A' },
    { matchId: 11, home: 1, away: 1, result: 'D' },
    { matchId: 12, home: 2, away: 0, result: 'H' },
    { matchId: 14, home: 1, away: 0, result: 'H' },
    { matchId: 15, home: 1, away: 0, result: 'H' },
  ];
  const allPredictions = {
    ana: { 10: { home: 0, away: 1 }, 11: { home: 2, away: 1 }, 12: { home: 2, away: 0 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    bob: { 10: { home: 1, away: 0 }, 11: { home: 1, away: 0 }, 12: { home: 1, away: 0 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    carol: { 10: { home: 1, away: 0 }, 11: { home: 2, away: 1 }, 12: { home: 2, away: 1 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    dave: { 10: { home: 0, away: 0 }, 11: { home: 1, away: 1 }, 12: { home: 0, away: 0 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    erin: { 10: { home: 1, away: 0 }, 11: { home: 0, away: 0 }, 12: { home: 1, away: 1 }, 14: { home: 1, away: 0 }, 15: { home: 1, away: 0 } },
    frank: { 10: { home: 1, away: 0 }, 11: { home: 0, away: 2 }, 12: { home: 2, away: 0 }, 15: { home: 1, away: 0 } },
  };
  const points = {
    ana: { 10: 15, 11: 3, 12: 15 },
    bob: { 10: 0, 11: 3, 12: 3, 14: 8 },
    carol: { 10: 0, 11: 3, 12: 0, 14: 8 },
    dave: { 10: 3, 11: 15, 12: 8, 14: 8 },
    erin: { 10: 0, 11: 8, 12: 0, 14: 8 },
    frank: { 10: 0, 11: 0, 12: 15 },
  };
  const userPoints = {};
  for (const [name, map] of Object.entries(points)) {
    userPoints[name] = {
      totalPoints: Object.values(map).reduce((a, b) => a + b, 0),
      matchDetails: Object.entries(map).map(([id, pts]) => ({ match: matchesById[id], points: pts, breakdown: [] })),
    };
  }
  return { playerNames, matchesById, playedMatches, allPredictions, userPoints };
}

function test_calcStyleStats_suerte_robos_faroles_y_confianza() {
  const f = buildStyleFixture();
  const r = calcStyleStats('ana', f.playedMatches, f.allPredictions, f.userPoints, f.matchesById, f.playerNames);
  assert.strictEqual(r.analyzedMatches, 3);
  assert.strictEqual(r.excludedLowSample, 1);
  assert.strictEqual(r.actualPoints, 33);
  assert.strictEqual(r.expectedPoints, 13.8);
  assert.strictEqual(r.luckDelta, 19.2);
  assert.strictEqual(r.luckPerMatch, 6.4);
  assert.strictEqual(r.luckLabel, 'afortunado');
  assert.strictEqual(r.robos.count, 1);
  assert.strictEqual(r.robos.items[0].matchId, 10);
  assert.strictEqual(r.robos.items[0].supportPct, 0);
  assert.strictEqual(r.faroles.count, 1);
  assert.strictEqual(r.faroles.items[0].matchId, 11);
  assert.strictEqual(r.faroles.items[0].supportPct, 40);
  assert.deepStrictEqual(r.confidence.majority, { matches: 1, hits: 1, hitPct: 100, exacts: 1, exactPct: 100 });
  assert.deepStrictEqual(r.confidence.tight, { matches: 1, hits: 0, hitPct: 0, exacts: 0, exactPct: 0 });
  assert.deepStrictEqual(r.confidence.minority, { matches: 1, hits: 1, hitPct: 100, exacts: 1, exactPct: 100 });
}

function test_calcStyleStats_sin_partidos_analizables() {
  const r = calcStyleStats('ana', [], {}, {}, {}, ['ana']);
  assert.strictEqual(r.analyzedMatches, 0);
  assert.strictEqual(r.excludedLowSample, 0);
  assert.strictEqual(r.luckLabel, null);
  assert.strictEqual(r.luckPerMatch, null);
  assert.strictEqual(r.robos.count, 0);
  assert.strictEqual(r.faroles.count, 0);
  assert.deepStrictEqual(r.confidence.majority, { matches: 0, hits: 0, hitPct: 0, exacts: 0, exactPct: 0 });
}

test_calcStyleStats_suerte_robos_faroles_y_confianza();
test_calcStyleStats_sin_partidos_analizables();
console.log('OK estadisticasEstilo T2');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticasEstilo.test.js`
Expected: FAIL with `TypeError: calcStyleStats is not a function`.

- [ ] **Step 3: Write minimal implementation**

En `js/stats.js`, insertar después de `expectedPointsForPrediction`:

```javascript
  function calcStyleStats(username, playedMatches, allPredictions, userPoints, matchesById, playerNames) {
    const consensusByMatch = buildMatchConsensus(allPredictions, playerNames, username);
    const myPreds = allPredictions?.[username] || {};
    const pointsByUser = new Map();

    for (const name of playerNames || []) {
      const byMatch = new Map();
      for (const detail of userPoints?.[name]?.matchDetails || []) {
        if (detail?.match?.id != null) byMatch.set(String(detail.match.id), detail.points || 0);
      }
      pointsByUser.set(name, byMatch);
    }

    const out = {
      analyzedMatches: 0,
      excludedLowSample: 0,
      actualPoints: 0,
      expectedPoints: 0,
      luckDelta: 0,
      luckPerMatch: null,
      luckLabel: null,
      robos: { count: 0, items: [] },
      faroles: { count: 0, items: [] },
      confidence: {
        majority: { matches: 0, hits: 0, hitPct: 0, exacts: 0, exactPct: 0 },
        tight: { matches: 0, hits: 0, hitPct: 0, exacts: 0, exactPct: 0 },
        minority: { matches: 0, hits: 0, hitPct: 0, exacts: 0, exactPct: 0 },
      },
    };

    for (const pm of playedMatches || []) {
      const match = matchesById?.[pm.matchId] || null;
      if (!match || match.fase !== 'liga') continue;
      const pred = myPreds[pm.matchId];
      if (!pred || !Number.isFinite(pred.home) || !Number.isFinite(pred.away)) continue;

      const consensus = consensusByMatch.get(String(pm.matchId));
      if (!consensus || consensus.total < 5) {
        out.excludedLowSample++;
        continue;
      }

      const userResult = matchResultOf(pred.home, pred.away);
      const isHit = userResult === pm.result;
      const isExact = pred.home === pm.home && pred.away === pm.away;
      const points = pointsByUser.get(username)?.get(String(pm.matchId)) || 0;
      const expected = expectedPointsForPrediction(pred, consensus);

      let avgSum = 0;
      let avgN = 0;
      for (const name of playerNames || []) {
        if (name === username) continue;
        const otherPred = allPredictions?.[name]?.[pm.matchId];
        if (!otherPred || !Number.isFinite(otherPred.home) || !Number.isFinite(otherPred.away)) continue;
        const byMatch = pointsByUser.get(name);
        if (!byMatch || !byMatch.has(String(pm.matchId))) continue;
        avgSum += byMatch.get(String(pm.matchId)) || 0;
        avgN++;
      }
      const avgPoints = avgN ? Math.round((avgSum / avgN) * 10) / 10 : 0;
      const supportPct = Math.round((consensus.counts[userResult] / consensus.total) * 100);

      out.analyzedMatches++;
      out.actualPoints += points;
      out.expectedPoints += expected;

      const bucket = supportPct >= 50 ? 'majority' : supportPct >= 33 ? 'tight' : 'minority';
      const conf = out.confidence[bucket];
      conf.matches++;
      if (isHit) conf.hits++;
      if (isExact) conf.exacts++;

      const item = {
        matchId: pm.matchId,
        match,
        pred: { home: pred.home, away: pred.away },
        result: pm.result,
        points,
        avgPoints,
        delta: Math.round((points - avgPoints) * 10) / 10,
        supportPct,
        exact: isExact,
      };

      if (isHit && supportPct < 50 && points > avgPoints) out.robos.items.push(item);
      if (!isHit && userResult === consensus.plurality) out.faroles.items.push(item);
    }

    out.robos.count = out.robos.items.length;
    out.faroles.count = out.faroles.items.length;
    out.robos.items.sort((a, b) => b.delta - a.delta || a.supportPct - b.supportPct);
    out.faroles.items.sort((a, b) => b.supportPct - a.supportPct || a.points - b.points);

    out.actualPoints = Math.round(out.actualPoints * 10) / 10;
    out.expectedPoints = Math.round(out.expectedPoints * 10) / 10;
    out.luckDelta = Math.round((out.actualPoints - out.expectedPoints) * 10) / 10;

    if (out.analyzedMatches) {
      out.luckPerMatch = Math.round((out.luckDelta / out.analyzedMatches) * 10) / 10;
      out.luckLabel = out.luckPerMatch >= 1
        ? 'afortunado'
        : out.luckPerMatch <= -1
          ? 'desafortunado'
          : 'neutro';
    }

    for (const key of ['majority', 'tight', 'minority']) {
      const conf = out.confidence[key];
      conf.hitPct = conf.matches ? Math.round((conf.hits / conf.matches) * 100) : 0;
      conf.exactPct = conf.matches ? Math.round((conf.exacts / conf.matches) * 100) : 0;
    }

    return out;
  }
```

Además, al final de `js/stats.js`, añadir:

```javascript
  global.calcStyleStats = calcStyleStats;
```

Y añadir `calcStyleStats` al objeto de `module.exports`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticasEstilo.test.js`
Expected: PASS and print `OK estadisticasEstilo T1` y `OK estadisticasEstilo T2`.

- [ ] **Step 5: Commit (solo si el usuario autorizó commits)**

```bash
git add js/stats.js tests/estadisticasEstilo.test.js
git commit -m "feat(stats): suerte, robos, faroles y acierto por confianza"
```

---

### Task 3: Tarjetas de estilo en Individual

**Files:**
- Modify: `js/stats.js` (nuevos renderers + integración en `renderIndividualBody`)
- Modify: `css/styles.css` (clases nuevas)

**Interfaces:**
- Consumes: `calcStyleStats` de Task 2; `esc`, `statsEmpty`, `statsPlayers`.
- Produces: `renderLuckCard(style)`, `renderRobosFarolesCard(style)`, `renderConfidenceCard(style)`.

- [ ] **Step 1: Add the render helpers**

En `js/stats.js`, insertar después de `renderSourceRanksCard` y antes de `renderIndividualBody`:

```javascript
  function luckLabelHtml(label) {
    if (!label) return '<span class="stats-pill">sin datos</span>';
    const cls = label === 'afortunado' ? 'up' : label === 'desafortunado' ? 'dn' : '';
    return `<span class="stats-pill ${cls}">${label}</span>`;
  }

  function renderLuckCard(style) {
    const intro = '<div class="stats-rank-sub" style="white-space:normal">Compara tus puntos reales con los que cabría esperar según lo que votó la porra en cada partido. Por encima de lo esperado tuviste buena suerte; por debajo, fuiste desafortunado.</div>';
    if (!style || !style.analyzedMatches) {
      return `<div class="stats-card"><div class="stats-card-title">🍀 Suerte vs habilidad</div>${intro}${statsEmpty('Aún no hay partidos con muestra suficiente: necesitamos al menos 5 pronósticos de otros usuarios por partido.')}</div>`;
    }

    const max = Math.max(style.actualPoints, style.expectedPoints, 1);
    const actualPct = Math.round((style.actualPoints / max) * 100);
    const expectedPct = Math.round((style.expectedPoints / max) * 100);
    const sign = style.luckDelta > 0 ? '+' : '';
    const perSign = style.luckPerMatch > 0 ? '+' : '';
    return `
      <div class="stats-card">
        <div class="stats-card-title">🍀 Suerte vs habilidad</div>
        ${intro}
        <div class="stats-kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-top:8px">
          <div class="stats-kpi"><div class="stats-kv">${style.actualPoints}</div><div class="stats-kl">puntos reales</div></div>
          <div class="stats-kpi"><div class="stats-kv">${style.expectedPoints}</div><div class="stats-kl">puntos esperados</div></div>
          <div class="stats-kpi"><div class="stats-kv">${sign}${style.luckDelta}</div><div class="stats-kl">suerte neta</div></div>
          <div class="stats-kpi"><div class="stats-kv">${style.analyzedMatches}</div><div class="stats-kl">partidos analizados</div></div>
        </div>
        <div class="stats-luck-bars">
          <div class="stats-luck-row"><span class="stats-luck-lbl">Real</span><div class="stats-luck-bar"><div style="width:${actualPct}%"></div></div><span class="stats-luck-val">${style.actualPoints}</span></div>
          <div class="stats-luck-row"><span class="stats-luck-lbl">Esperado</span><div class="stats-luck-bar expected"><div style="width:${expectedPct}%"></div></div><span class="stats-luck-val">${style.expectedPoints}</span></div>
        </div>
        <div class="stats-rank-sub" style="white-space:normal;margin-top:8px">${luckLabelHtml(style.luckLabel)} Suerte/partido: ${style.luckPerMatch === null ? '—' : perSign + style.luckPerMatch} · ${style.excludedLowSample} partidos excluidos por muestra &lt;5.</div>
        <div class="stats-rank-sub" style="white-space:normal;margin-top:6px">Suerte neta = puntos reales − esperados. El esperado combina resultado (8), goles de cada equipo (3+3) y marcador exacto (1). Solo partidos con al menos 5 pronósticos de otros usuarios.</div>
      </div>`;
  }

  function styleItemHtml(item, kind) {
    const m = item.match || {};
    const name = `${esc(m.homeTeam || '')} – ${esc(m.awayTeam || '')}`;
    const jornada = m.ronda ? ` · J${m.ronda}` : '';
    const detail = kind === 'robo'
      ? `${item.supportPct}% te siguió · ${item.delta > 0 ? '+' : ''}${item.delta} vs media`
      : `${item.supportPct}% de la porra falló contigo`;
    return `<div class="stats-style-row">
      <span class="stats-style-pts">${item.points} pts</span>
      <div class="stats-style-info">
        <div class="stats-style-name">${name}${jornada}</div>
        <div class="stats-style-sub">${item.pred.home} - ${item.pred.away} · ${detail}</div>
      </div>
    </div>`;
  }

  function renderRobosFarolesCard(style) {
    const robos = style?.robos || { count: 0, items: [] };
    const faroles = style?.faroles || { count: 0, items: [] };
    const robosHtml = robos.items.length
      ? robos.items.slice(0, 3).map(item => styleItemHtml(item, 'robo')).join('')
      : statsEmpty('Aún no hay robos: necesitas acertar en minoría y superar la media del partido.');
    const farolesHtml = faroles.items.length
      ? faroles.items.slice(0, 3).map(item => styleItemHtml(item, 'farol')).join('')
      : statsEmpty('Aún no hay faroles: necesitas fallar con la opción más votada.');
    return `
      <div class="stats-card">
        <div class="stats-card-title">🎭 Robos y faroles</div>
        <div class="stats-rank-sub" style="white-space:normal">Un robo es acertar el resultado con una opción que casi nadie eligió. Un farol es seguir a la mayoría y fallar.</div>
        <div class="stats-kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-top:8px">
          <div class="stats-kpi"><div class="stats-kv">${robos.count}</div><div class="stats-kl">robos</div></div>
          <div class="stats-kpi"><div class="stats-kv">${faroles.count}</div><div class="stats-kl">faroles</div></div>
        </div>
        <div class="stats-style-section-title">Robos</div>
        <div class="stats-rank-sub" style="white-space:normal">Aciertos minoritarios que te dieron ventaja sobre la media del partido.</div>
        <div class="stats-style-list">${robosHtml}</div>
        <div class="stats-style-section-title">Faroles</div>
        <div class="stats-rank-sub" style="white-space:normal">Fallos con la opción más votada: la porra se equivocó contigo.</div>
        <div class="stats-style-list">${farolesHtml}</div>
        <div class="stats-rank-sub" style="white-space:normal;margin-top:8px">Solo se analizan partidos con al menos 5 pronósticos de otros usuarios.</div>
      </div>`;
  }

  function renderConfidenceCard(style) {
    const conf = style?.confidence;
    const defs = [
      ['majority', 'Mayoría', '≥50% eligió tu opción'],
      ['tight', 'Ajustada', '33–49% eligió tu opción'],
      ['minority', 'Minoría', '<33% eligió tu opción'],
    ];
    const totalMatches = defs.reduce((sum, [key]) => sum + (conf?.[key]?.matches || 0), 0);
    const intro = '<div class="stats-rank-sub" style="white-space:normal">Agrupa tus partidos según cuánto apoyó la porra tu elección 1X2. Sirve para ver si aciertas más cuando vas con la mayoría o cuando te arriesgas.</div>';
    if (!totalMatches) {
      return `<div class="stats-card"><div class="stats-card-title">🎚️ Acierto por confianza</div>${intro}${statsEmpty('Aún no hay partidos con muestra suficiente para medir la confianza.')}</div>`;
    }

    const rows = defs.map(([key, label, sub]) => {
      const c = conf[key] || { matches: 0, hits: 0, hitPct: 0, exacts: 0, exactPct: 0 };
      const fill = c.matches ? c.hitPct : 0;
      return `<div class="stats-conf-row">
        <span class="stats-conf-lbl">${label}</span>
        <div class="stats-conf-bar"><div style="width:${fill}%"></div></div>
        <span class="stats-conf-val">${c.matches ? `${c.hits}/${c.matches} · ${c.hitPct}%` : '—'}</span>
        <span class="stats-conf-sub">${sub}${c.matches ? ` · ${c.exacts} exactos · ${c.exactPct}%` : ''}</span>
      </div>`;
    }).join('');

    return `
      <div class="stats-card">
        <div class="stats-card-title">🎚️ Acierto por confianza</div>
        ${intro}
        <div class="stats-conf-rows">${rows}</div>
        <div class="stats-rank-sub" style="white-space:normal;margin-top:8px">La confianza mide el apoyo de la porra a tu pronóstico, no tu seguridad personal.</div>
      </div>`;
  }
```

- [ ] **Step 2: Integrate in Individual**

En `renderIndividualBody`, antes de `const indAvatar = ...`, añadir:

```javascript
    const styleStats = calcStyleStats(
      username,
      aggregates.playedMatches,
      AppState.allPredictions,
      AppState.userPoints,
      aggregates.matchesById,
      statsPlayers().map(p => p.name)
    );
```

Y en el `return` final, entre `${sesgoCard}` y `${plantillaCard}`, añadir:

```javascript
      ${sesgoCard}
      ${renderLuckCard(styleStats)}
      ${renderRobosFarolesCard(styleStats)}
      ${renderConfidenceCard(styleStats)}
      ${plantillaCard}`;
```

- [ ] **Step 3: Add CSS**

En `css/styles.css`, al final del bloque de estilos de Jugador v2:

```css
.stats-luck-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.stats-luck-row {
  display: grid;
  grid-template-columns: 58px 1fr auto;
  gap: 8px;
  align-items: center;
}

.stats-luck-lbl {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-primary);
}

.stats-luck-bar {
  height: 8px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.stats-luck-bar > div {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--accent-primary);
}

.stats-luck-bar.expected > div {
  background: var(--accent-purple);
}

.stats-luck-val {
  font-size: 10px;
  color: var(--text-secondary);
  text-align: right;
}

.stats-pill.up {
  background: rgba(16, 185, 129, 0.15);
  color: var(--accent-primary);
}

.stats-pill.dn {
  background: rgba(239, 68, 68, 0.12);
  color: var(--accent-danger, #EF4444);
}

.stats-style-section-title {
  margin-top: 10px;
  font-size: 11px;
  font-weight: 800;
  color: var(--text-primary);
}

.stats-style-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 6px;
}

.stats-style-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 10px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.stats-style-pts {
  min-width: 44px;
  font-size: 12px;
  font-weight: 800;
  color: var(--accent-cyan);
}

.stats-style-info {
  min-width: 0;
}

.stats-style-name {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
}

.stats-style-sub {
  margin-top: 2px;
  font-size: 10px;
  color: var(--text-muted);
}

.stats-conf-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.stats-conf-row {
  display: grid;
  grid-template-columns: 58px 1fr auto;
  gap: 6px 8px;
  align-items: center;
}

.stats-conf-lbl {
  font-size: 10px;
  font-weight: 800;
  color: var(--text-primary);
}

.stats-conf-bar {
  height: 8px;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.06);
  overflow: hidden;
}

.stats-conf-bar > div {
  height: 100%;
  border-radius: var(--radius-full);
  background: var(--accent-gold);
}

.stats-conf-val {
  font-size: 10px;
  color: var(--text-secondary);
  text-align: right;
  white-space: nowrap;
}

.stats-conf-sub {
  grid-column: 2 / -1;
  font-size: 9px;
  color: var(--text-muted);
}
```

- [ ] **Step 4: Verify syntax and regressions**

Run:

```bash
node -e "require('./js/stats.js'); console.log('stats.js OK')"
node tests/estadisticasEstilo.test.js
node tests/estadisticasJugadorV2.test.js
node tests/estadisticas.test.js
node tests/estadisticas-subtabs.test.js
```

Expected: todos PASS sin excepciones.

- [ ] **Step 5: Commit (solo si el usuario autorizó commits)**

```bash
git add js/stats.js css/styles.css
git commit -m "feat(stats): tarjetas de suerte, robos y confianza"
```

---

### Task 4: Cache-busting y verificación final

**Files:**
- Modify: `index.html` (versiones)

- [ ] **Step 1: Bump cache-busting versions**

En `index.html`, cambiar:

```html
<link rel="stylesheet" href="css/styles.css?v=136">
```

por:

```html
<link rel="stylesheet" href="css/styles.css?v=137">
```

Y cambiar:

```html
<script src="js/stats.js?v=21"></script>
```

por:

```html
<script src="js/stats.js?v=22"></script>
```

- [ ] **Step 2: Run all stats tests**

```bash
node tests/estadisticasEstilo.test.js
node tests/estadisticasJugadorV2.test.js
node tests/estadisticas.test.js
node tests/estadisticas-subtabs.test.js
node tests/estadisticasEvolucion.test.js
node tests/estadisticasIndividualDesempate.test.js
```

Expected: todos PASS.

- [ ] **Step 3: Headless mobile verification**

Usar un harness como el de Fase 1 con datos sintéticos y `google-chrome --headless=new --dump-dom` a 320 px y 375 px. Comprobar:

1. Aparecen las tarjetas `🍀 Suerte vs habilidad`, `🎭 Robos y faroles` y `🎚️ Acierto por confianza`.
2. Sin errores de consola registrados por el harness.
3. Sin elementos cuyo borde derecho supere el ancho del harness.
4. Con cero partidos analizables aparecen los tres empty states.
5. Con un invitado oculto, su nombre no aparece en la tarjeta ni en el selector.

- [ ] **Step 4: Commit (solo si el usuario autorizó commits)**

```bash
git add index.html
git commit -m "chore(stats): cache-busting de Estilo y suerte"
```

---

## Self-Review

- **Cobertura del spec:** las tres métricas, la muestra mínima, el desglose 8+3+3+1, robos/faroles, confianza, microcopy, empty states y solo-liga tienen tarea.
- **Placeholders:** no hay TBD/TODO ni pasos sin código.
- **Consistencia de tipos:** `buildMatchConsensus` devuelve `Map<string, consensus>`; `expectedPointsForPrediction` devuelve número; `calcStyleStats` devuelve las claves `analyzedMatches`, `excludedLowSample`, `actualPoints`, `expectedPoints`, `luckDelta`, `luckPerMatch`, `luckLabel`, `robos`, `faroles`, `confidence`.
- **Exportaciones:** las tres funciones puras se añaden a `global.*` y `module.exports`.
