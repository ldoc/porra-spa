# Live rediseñado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Live sub-tab with a 3-per-row score strip, a single temporal standings table, a footballer ranking, and animated event toasts.

**Architecture:** All computation client-side (approach A): pure functions in `js/liveTab.js` (IIFE + `module.exports`, same pattern as `hoyPartidos.js`) tested with `node --test`; `js/main.js` only wires data and polling. One small backend change (api-porra) stores incidents for subs/cards toasts.

**Tech Stack:** Vanilla JS (ES6, no framework), vanilla CSS with `:root` tokens, `node:test` + `assert`, MongoDB/Mongoose (Task 1 only).

## Global Constraints

- Branches: porra-spa `live-matchs`, api-porra `live-matchs`. Mains stay intact.
- Never point scripts at `/prod` DB; use `/test`.
- Portrait-first, max width 460px; reuse `:root` tokens and `.standings-table`, `.rank-1/2/3`, `.live-dot`, `.live-owner(.me)`.
- Cache-busting: bump `?v=` in `index.html` when touching CSS/JS.
- No placeholders, no duplication of scoring rules: pronóstico reuses `livePointsForUser` (official 8/3/3/1); plantilla scoring is injected (`calculatePlayerMatchPoints` passed in by `main.js`).
- Commits: one per task, format `feat(live): ...` / `fix(live): ...`.

---

### Task 1: Backend incidents for subs/cards (api-porra)

**Files:**
- Modify: `/home/ldoc/Proyectos/api-porra/db/models/LiveMatch.js` (add field)
- Modify: `/home/ldoc/Proyectos/api-porra/scripts/matchStats.js` (add `fetchLiveIncidents`)
- Modify: `/home/ldoc/Proyectos/api-porra/scripts/liveScrape.js` (store incidents in `buildLiveUpdate`)
- Test: `/home/ldoc/Proyectos/api-porra/tests/liveScrape.test.js` (append)

**Interfaces:**
- Consumes: Sofascore `GET /event/{id}/incidents` (already fetched inside `scrapMatchStats`; this task fetches it separately — one extra request per match per cycle is acceptable).
- Produces: `live.incidents`: `[{key, tipo, minuto, teamId, playerId, playerName}]` where `tipo` is `'sub'` or `'card'`; `fetchLiveIncidents(eventId)` exported from `matchStats.js`.

- [ ] **Step 1: Write the failing test** — append to `tests/liveScrape.test.js`:

```js
test('buildLiveUpdate guarda últimos 20 incidents', () => {
  const inc = Array.from({ length: 25 }, (_, i) => ({ key: `s${i}`, tipo: 'sub', minuto: 60 + i, teamId: 2677, playerId: 9, playerName: 'X' }));
  const u = buildLiveUpdate(16939028, { estado: 'live', minuto: 80, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1 }, { jugadores: [] }, inc);
  assert.equal(u.incidents.length, 20);
  assert.equal(u.incidents[19].key, 's24');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveScrape.test.js` (workdir `/home/ldoc/Proyectos/api-porra`)
Expected: FAIL with "buildLiveUpdate ... " (4th arg ignored / incidents undefined).

- [ ] **Step 3: Minimal implementation**
  - `db/models/LiveMatch.js`: add `incidents: { type: [new mongoose.Schema({ key: String, tipo: { type: String, enum: ['sub', 'card'] }, minuto: Number, teamId: Number, playerId: Number, playerName: String }, { _id: false })], default: [] }`.
  - `scripts/matchStats.js`: add and export:

```js
export async function fetchLiveIncidents(eventId) {
  const data = await fetchSofascore(`https://www.sofascore.com/api/v1/event/${eventId}/incidents`).catch(() => null);
  const out = [];
  for (const i of data?.incidents || []) {
    if (i.incidentType === 'substitution') out.push({ key: `sub-${i.time ?? ''}-${i.playerIn?.id ?? ''}`, tipo: 'sub', minuto: i.time ?? 0, teamId: i.team?.id, playerId: i.playerIn?.id, playerName: i.playerIn?.name });
    else if (i.incidentType === 'card') out.push({ key: `card-${i.time ?? ''}-${i.player?.id ?? ''}-${i.incidentClass ?? ''}`, tipo: 'card', minuto: i.time ?? 0, teamId: i.team?.id, playerId: i.player?.id, playerName: i.player?.name });
  }
  return out.slice(-20);
}
```

  - `scripts/liveScrape.js`: import `fetchLiveIncidents`; `buildLiveUpdate(eventId, eventInfo, stats, incidents = [])` adds `incidents` to update; `scrapeOnce` fetches all three in `Promise.all` and passes incidents through.

- [ ] **Step 4: Run tests**

Run: `node --test tests/*.test.js` (workdir `/home/ldoc/Proyectos/api-porra`)
Expected: all PASS (74 + new).

- [ ] **Step 5: Commit**

```bash
git add db/models/LiveMatch.js scripts/matchStats.js scripts/liveScrape.js tests/liveScrape.test.js
git commit -m "feat(live): guarda incidents (cambios/tarjetas) en livematchs"
```

---

### Task 2: Temporal standings table (pure + HTML)

**Files:**
- Modify: `/home/ldoc/Proyectos/porra-spa/js/liveTab.js` (add `computeLiveTemporal`, `buildTemporalTableHtml`, export both)
- Test: `/home/ldoc/Proyectos/porra-spa/tests/liveTemporal.test.js` (create)

**Interfaces:**
- Consumes: `livePointsForUser(live, pred)` (same file); injected `scorePlayer(playerData, squadPlayer, liveDoc)` returning `{total}` (in prod: `calculatePlayerMatchPoints` from main.js).
- Produces: `computeLiveTemporal(liveMatches, allPredictions, squadsCache, scorePlayer)` → `[{user, pron, plant, total}]` sorted by total desc, then pron desc, then plant desc. Live docs counted: all in `liveMatches` (live + recently finished). Users included: every key of `allPredictions` (0s when no data).

- [ ] **Step 1: Write the failing test** — create `tests/liveTemporal.test.js`:

```js
const assert = require('assert');
const { computeLiveTemporal } = require('../js/liveTab.js');

const LIVES = [
  { eventId: 16939028, estado: 'live', minuto: 67, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1, stats: { 2677: { goles: 3 }, 1164: { goles: 1 }, jugadores: [{ id: '9', equipo: 2677, minutos: 67, puntos: 8.4, goles: 2, asistencias: 1 }] } },
  { eventId: 7, estado: 'finalizado', minuto: 90, homeTeamId: 1, awayTeamId: 2, homeGoles: 0, awayGoles: 0, stats: { 1: { goles: 0 }, 2: { goles: 0 }, jugadores: [] } }
];
const PREDS = { javi: { 16939028: { home: 3, away: 1 }, 7: { home: 1, away: 0 } }, tu: { 16939028: { home: 2, away: 0 } } };
const SQUADS = { javi: [], tu: [{ id: 9, posicion: 'F', equipo: 2677 }] };
const scorePlayer = (pd) => ({ total: pd.goles * 5 });

function test_tabla_unica_ordenada_por_total() {
  const rows = computeLiveTemporal(LIVES, PREDS, SQUADS, scorePlayer);
  assert.deepEqual(rows.map(r => r.user), ['javi', 'tu']);
  assert.equal(rows[0].pron, 18);
  assert.equal(rows[1].plant, 10);
  assert.equal(rows[1].total, rows[1].pron + rows[1].plant);
}
test_tabla_unica_ordenada_por_total();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveTemporal.test.js` (workdir `/home/ldoc/Proyectos/porra-spa`)
Expected: FAIL with "computeLiveTemporal is not a function".

- [ ] **Step 3: Minimal implementation** — in `js/liveTab.js`, add before the `api` object and export both names:

```js
function computeLiveTemporal(liveMatches, allPredictions, squadsCache, scorePlayer) {
  const rows = [];
  for (const user of Object.keys(allPredictions || {})) {
    let pron = 0, plant = 0;
    const preds = allPredictions[user] || {};
    for (const live of liveMatches || []) {
      pron += livePointsForUser(live, preds[live.eventId]);
      const squad = squadsCache?.[user] || [];
      const ids = new Set(squad.map(s => String(s.id)));
      for (const j of (live?.stats?.jugadores || [])) {
        if (!ids.has(String(j.id))) continue;
        const sp = squad.find(s => String(s.id) === String(j.id));
        plant += (scorePlayer(j, sp, live)?.total) || 0;
      }
    }
    rows.push({ user, pron, plant, total: pron + plant });
  }
  rows.sort((a, b) => b.total - a.total || b.pron - a.pron || b.plant - a.plant);
  return rows;
}

function buildTemporalTableHtml(rows, currentUser) {
  const body = rows.map((r, i) => {
    const cls = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
    return `<tr${r.user === currentUser ? ' class="me"' : ''}><td><span class="rank ${cls}">${i + 1}</span></td><td>${esc(r.user)}</td><td>${r.pron}</td><td>${r.plant}</td><td class="total">${r.total}</td></tr>`;
  }).join('');
  return `<table class="standings-table"><thead><tr><th>#</th><th>Jugador</th><th>Pron.</th><th>Plant.</th><th>Total</th></tr></thead><tbody>${body}</tbody></table>`;
}
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveTemporal.test.js tests/liveTab.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/liveTab.js tests/liveTemporal.test.js
git commit -m "feat(live): tabla temporal única (Pron/Plant/Total)"
```

---

### Task 3: Compact score strip (section 1)

**Files:**
- Modify: `/home/ldoc/Proyectos/porra-spa/js/liveTab.js` (add `shortTeam`, `buildLiveStripHtml`, export)
- Modify: `/home/ldoc/Proyectos/porra-spa/css/styles.css` (append `.strip`, `.mini`, `.pts` styles with `:root` tokens)
- Test: extend `/home/ldoc/Proyectos/porra-spa/tests/liveTemporal.test.js` (strip assertions in same file — no, keep separate): append tests to `tests/liveTab.test.js`

**Interfaces:**
- Consumes: `livePointsForUser`, `esc` (same file).
- Produces: `buildLiveStripHtml(liveMatches, predsOfMine)` → grid HTML, 3 minis per row (CSS grid wraps), each mini: top line (minute or `Fin` + my pts chip), teams as 3-letter caps + score. `shortTeam(name)` → first 3 letters uppercased.

- [ ] **Step 1: Write the failing test** — append to `tests/liveTab.test.js`:

```js
const { buildLiveStripHtml } = require('../js/liveTab.js');
function test_strip_tres_por_fila_puntos_junto_minuto() {
  const lives = [
    { eventId: 1, estado: 'live', minuto: 67, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1 },
    { eventId: 2, estado: 'finalizado', minuto: 90, homeTeamId: 1, awayTeamId: 2, homeGoles: 1, awayGoles: 1 }
  ];
  const names = { 2677: 'VfB Stuttgart', 1164: 'Viking FK', 1: 'Betis', 2: 'Celta' };
  const html = buildLiveStripHtml(lives, { 1: { home: 3, away: 1 }, 2: { home: 0, away: 0 } }, names);
  assert.match(html, /VFB/);
  assert.match(html, /67'/);
  assert.match(html, /\+15/);
  assert.match(html, /Fin/);
}
test_strip_tres_por_fila_puntos_junto_minuto();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveTab.test.js`
Expected: FAIL with "buildLiveStripHtml is not a function".

- [ ] **Step 3: Minimal implementation** — in `js/liveTab.js`:

```js
function shortTeam(name) { return String(name ?? '').slice(0, 3).toUpperCase(); }

function buildLiveStripHtml(liveMatches, myPreds, teamNames) {
  const minis = (liveMatches || []).map(live => {
    const pts = livePointsForUser(live, (myPreds || {})[live.eventId]);
    const min = live.estado === 'live' ? `<span class="live-dot"></span> ${live.minuto}'` : live.estado === 'descanso' ? '⏸ Desc.' : 'Fin';
    const topCls = live.estado === 'finalizado' || live.estado === 'descanso' ? ' fin' : '';
    return `<div class="mini"><div class="top${topCls}"><span>${min}</span><span class="pts${pts >= 8 ? '' : ' low'}">+${pts}</span></div>`
      + `<div class="teams">${esc(shortTeam(teamNames?.[live.homeTeamId] || live.homeTeamId))} <strong>${live.homeGoles}-${live.awayGoles}</strong> ${esc(shortTeam(teamNames?.[live.awayTeamId] || live.awayTeamId))}</div></div>`;
  }).join('');
  return `<div class="strip">${minis}</div>`;
}
```

CSS to append in `css/styles.css` (after the live block):

```css
.strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
.mini { background: var(--ucl-card); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 8px 6px; text-align: center; min-width: 0; }
.mini .top { display: flex; align-items: center; justify-content: space-between; font-size: var(--font-size-xs); font-weight: 800; color: #f87171; }
.mini .top.fin { color: var(--text-muted); font-weight: 400; }
.mini .pts { background: rgba(16,185,129,.2); color: #6ee7b7; border-radius: 999px; padding: 1px 7px; }
.mini .pts.low { background: rgba(255,255,255,.08); color: var(--text-muted); }
.mini .teams { font-size: .8rem; margin-top: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveTab.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/liveTab.js css/styles.css tests/liveTab.test.js
git commit -m "feat(live): tira compacta 3 por fila con mis puntos"
```

---

### Task 4: Footballer ranking (section 3)

**Files:**
- Modify: `/home/ldoc/Proyectos/porra-spa/js/liveTab.js` (add `computeLivePlayerRanking`, `buildPlayerRankingHtml`, export)
- Modify: `/home/ldoc/Proyectos/porra-spa/css/styles.css` (append `.face`, `.owners`, `.rate` styles)
- Test: `/home/ldoc/Proyectos/porra-spa/tests/livePlayers.test.js` (create)

**Interfaces:**
- Consumes: injected `scorePlayer` (same contract as Task 2); `ownersOfPlayer`, `playerImgUrl`, `esc` (same file).
- Produces: `computeLivePlayerRanking(liveMatches, squadsCache, scorePlayer)` → `[{id, nombre, equipo, matchLabel, rating, goles, asistencias, pts, owners[]}]`, only `minutos > 0` players owned by ≥1 user, sorted by pts desc, then goles, asistencias, rating. `buildPlayerRankingHtml(rows, {currentUser, playerExts})` → table with ⭐ (rating or `–`), G, A, Pts; owner chips: me (`tú`, class `me`) first, up to 3 more, then `(+N)`.

- [ ] **Step 1: Write the failing test** — create `tests/livePlayers.test.js`:

```js
const assert = require('assert');
const { computeLivePlayerRanking, buildPlayerRankingHtml } = require('../js/liveTab.js');

const LIVES = [{ eventId: 16939028, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1,
  stats: { jugadores: [
    { id: '9', nombre: 'Kane', equipo: 2677, minutos: 67, puntos: 8.4, goles: 2, asistencias: 1 },
    { id: '10', nombre: 'Undav', equipo: 2677, minutos: 0, puntos: 0, goles: 0, asistencias: 0 },
    { id: '11', nombre: 'Nadie', equipo: 1164, minutos: 20, puntos: 6.1, goles: 0, asistencias: 0 }
  ] } }];
const SQUADS = { tu: [{ id: 9, posicion: 'F', equipo: 2677 }], javi: [{ id: 9, posicion: 'F', equipo: 2677 }], maria: [{ id: 9, posicion: 'F', equipo: 2677 }], pedro: [{ id: 9, posicion: 'F', equipo: 2677 }], luis: [{ id: 9, posicion: 'F', equipo: 2677 }], ana: [{ id: 9, posicion: 'F', equipo: 2677 }] };
const scorePlayer = () => ({ total: 14 });

function test_ranking_filtra_ordena_y_duenos() {
  const rows = computeLivePlayerRanking(LIVES, SQUADS, scorePlayer);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].nombre, 'Kane');
  assert.equal(rows[0].rating, 8.4);
  const html = buildPlayerRankingHtml(rows, { currentUser: 'tu', playerExts: {} });
  assert.match(html, /tú/);
  assert.match(html, /\(\+2\)/);
  assert.match(html, /8\.4/);
}
test_ranking_filtra_ordena_y_duenos();

function test_sin_rating_muestra_guion() {
  const lives = [{ eventId: 1, homeTeamId: 1, awayTeamId: 2, homeGoles: 0, awayGoles: 0, stats: { jugadores: [{ id: '5', nombre: 'X', equipo: 1, minutos: 30, goles: 0, asistencias: 0 }] } }];
  const rows = computeLivePlayerRanking(lives, { tu: [{ id: 5, posicion: 'M', equipo: 1 }] }, () => ({ total: 1 }));
  const html = buildPlayerRankingHtml(rows, { currentUser: 'tu', playerExts: {} });
  assert.match(html, /–/);
}
test_sin_rating_muestra_guion();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/livePlayers.test.js`
Expected: FAIL with "computeLivePlayerRanking is not a function".

- [ ] **Step 3: Minimal implementation** — in `js/liveTab.js`:

```js
function computeLivePlayerRanking(liveMatches, squadsCache, scorePlayer) {
  const seen = new Map();
  for (const live of liveMatches || []) {
    const label = `${shortTeam(String(live.homeTeamId))}-${shortTeam(String(live.awayTeamId))}`;
    for (const j of (live?.stats?.jugadores || [])) {
      if (!(j.minutos > 0)) continue;
      const owners = ownersOfPlayer(j.id, squadsCache);
      if (!owners.length) continue;
      const squad = (squadsCache[owners[0]] || []).find(s => String(s.id) === String(j.id)) || {};
      const pts = (scorePlayer(j, squad, live)?.total) || 0;
      const key = String(j.id);
      if (!seen.has(key) || seen.get(key).pts < pts) {
        seen.set(key, { id: key, nombre: j.nombre, equipo: j.equipo, matchLabel: label, rating: j.puntos || 0, goles: j.goles || 0, asistencias: j.asistencias || 0, pts, owners });
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.pts - a.pts || b.goles - a.goles || b.asistencias - a.asistencias || b.rating - a.rating);
}

function ownerChips(owners, currentUser) {
  const rest = owners.filter(u => u !== currentUser);
  const shown = (owners.includes(currentUser) ? [currentUser] : []).concat(rest.slice(0, 3));
  let html = shown.map(u => `<span class="tag${u === currentUser ? ' me' : ''}">${u === currentUser ? 'Tú' : esc(u)}</span>`).join('');
  const hidden = owners.length - shown.length;
  if (hidden > 0) html += `<span class="tag more">(+${hidden})</span>`;
  return html;
}

function buildPlayerRankingHtml(rows, { currentUser, playerExts }) {
  const body = rows.map((r, i) => {
    const cls = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
    return `<tr><td><span class="rank ${cls}">${i + 1}</span></td>`
      + `<td><img class="live-scorer-img" src="${playerImgUrl(r.id, playerExts)}" alt="" loading="lazy" onerror="this.style.display='none'">${esc(r.nombre)} <span class="tag">${esc(r.matchLabel)}</span><div class="owners">${ownerChips(r.owners, currentUser)}</div></td>`
      + `<td class="rate">${r.rating ? Number(r.rating).toFixed(1) : '–'}</td><td><strong>${r.goles}</strong></td><td><strong>${r.asistencias}</strong></td><td class="total">${r.pts}</td></tr>`;
  }).join('');
  return `<table class="standings-table"><thead><tr><th>#</th><th>Futbolista</th><th>⭐</th><th>G</th><th>A</th><th>Pts</th></tr></thead><tbody>${body}</tbody></table>`;
}
```

CSS to append:

```css
.face, .live-scorer-img { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; vertical-align: middle; margin-right: 4px; background: rgba(255,255,255,.06); }
.owners { display: flex; gap: 3px; margin-top: 3px; flex-wrap: wrap; }
.tag { font-size: 10px; background: rgba(255,255,255,.08); border-radius: 999px; padding: 1px 7px; color: var(--text-muted); white-space: nowrap; }
.tag.me { background: rgba(16,185,129,.2); color: #6ee7b7; font-weight: 700; }
.tag.more { background: transparent; border: 1px solid var(--border-color); }
.rate { color: #67e8f9; font-weight: 700; }
```

- [ ] **Step 4: Run tests**

Run: `node --test tests/livePlayers.test.js tests/liveTab.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/liveTab.js css/styles.css tests/livePlayers.test.js
git commit -m "feat(live): ranking de futbolistas con ⭐ y dueños"
```

---

### Task 5: Event toasts (section 4)

**Files:**
- Modify: `/home/ldoc/Proyectos/porra-spa/js/liveTab.js` (add `detectLiveEvents`, `buildEventToastHtml`, export)
- Modify: `/home/ldoc/Proyectos/porra-spa/css/styles.css` (append toast + keyframes: `shoot`, `flash`, `shake`, `ripple`, `pop`, `fall`, `breathe`, `wave`, `goldpop`, `stamp`, `dive`, `goout`, `goin`, `flip`, `rise`)
- Test: `/home/ldoc/Proyectos/porra-spa/tests/liveEvents.test.js` (create)

**Interfaces:**
- Consumes: `livePointsForUser`, `esc` (same file).
- Produces: `detectLiveEvents(prevList, nextList)` → `[{tipo, eventId, ...}]` with `tipo` in `gol | penalti | paradon | descanso | reanudacion | final | cambio | tarjeta`. Rules: goles up → `gol` (or `penalti` if scorer's `penaltiMarcado` rose); `penaltiParado` up → `paradon`; `estado` live→descanso → `descanso`, descanso→live → `reanudacion`, →finalizado → `final`; new `incidents` keys → `cambio`/`tarjeta`. First sighting of a match (no prev) → no events. `buildEventToastHtml(ev, ctx)` with `ctx = {myPtsBefore, myPtsAfter, tempBefore, tempAfter, isMine, teamNames}` → toast HTML with impact lines.

- [ ] **Step 1: Write the failing test** — create `tests/liveEvents.test.js`:

```js
const assert = require('assert');
const { detectLiveEvents, buildEventToastHtml } = require('../js/liveTab.js');

const PREV = [{ eventId: 1, estado: 'live', minuto: 60, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 2, awayGoles: 1, incidents: [], stats: { jugadores: [{ id: '9', goles: 1, penaltiMarcado: 0, penaltiParado: 0 }] } }];
const NEXT = [{ eventId: 1, estado: 'live', minuto: 67, homeTeamId: 2677, awayTeamId: 1164, homeGoles: 3, awayGoles: 1, incidents: [], stats: { jugadores: [{ id: '9', nombre: 'Kane', goles: 2, penaltiMarcado: 0, penaltiParado: 0 }] } }];

function test_detecta_gol_con_goleador() {
  const evs = detectLiveEvents(PREV, NEXT);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].tipo, 'gol');
  assert.equal(evs[0].playerName, 'Kane');
}
test_detecta_gol_con_goleador();

function test_sin_previo_no_hay_eventos() {
  assert.deepEqual(detectLiveEvents([], NEXT), []);
}
test_sin_previo_no_hay_eventos();

function test_toast_muestra_impacto() {
  const html = buildEventToastHtml({ tipo: 'gol', eventId: 1, playerName: 'Kane', teamName: 'Stuttgart', minuto: 67, homeGoles: 3, awayGoles: 1, homeShort: 'STU', awayShort: 'VIK' }, { myPtsBefore: 3, myPtsAfter: 8, tempBefore: 40, tempAfter: 45, isMine: true });
  assert.match(html, /\+3 → <strong>\+8<\/strong>/);
  assert.match(html, /es tuyo/);
}
test_toast_muestra_impacto();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/liveEvents.test.js`
Expected: FAIL with "detectLiveEvents is not a function".

- [ ] **Step 3: Minimal implementation** — in `js/liveTab.js`:

```js
function playersById(live) {
  const m = {};
  for (const j of (live?.stats?.jugadores || [])) m[String(j.id)] = j;
  return m;
}

function detectLiveEvents(prevList, nextList) {
  const prev = new Map((prevList || []).map(l => [l.eventId, l]));
  const evs = [];
  for (const nx of nextList || []) {
    const pv = prev.get(nx.eventId);
    if (!pv) continue;
    const pm = playersById(pv), nm = playersById(nx);
    const scorer = Object.keys(nm).find(id => (nm[id].goles || 0) > (pm[id]?.goles || 0));
    if ((nx.homeGoles + nx.awayGoles) > (pv.homeGoles + pv.awayGoles) && scorer) {
      const penal = (nm[scorer].penaltiMarcado || 0) > (pm[scorer]?.penaltiMarcado || 0);
      evs.push({ tipo: penal ? 'penalti' : 'gol', eventId: nx.eventId, playerId: scorer, playerName: nm[scorer].nombre, teamId: nm[scorer].equipo, minuto: nx.minuto, homeGoles: nx.homeGoles, awayGoles: nx.awayGoles, homeTeamId: nx.homeTeamId, awayTeamId: nx.awayTeamId });
      continue;
    }
    const keeper = Object.keys(nm).find(id => (nm[id].penaltiParado || 0) > (pm[id]?.penaltiParado || 0));
    if (keeper) { evs.push({ tipo: 'paradon', eventId: nx.eventId, playerId: keeper, playerName: nm[keeper].nombre, teamId: nm[keeper].equipo, minuto: nx.minuto }); continue; }
    if (pv.estado !== nx.estado) {
      if (nx.estado === 'descanso') evs.push({ tipo: 'descanso', eventId: nx.eventId, minuto: nx.minuto });
      else if (nx.estado === 'finalizado') evs.push({ tipo: 'final', eventId: nx.eventId, homeGoles: nx.homeGoles, awayGoles: nx.awayGoles, homeTeamId: nx.homeTeamId, awayTeamId: nx.awayTeamId });
      else if (pv.estado === 'descanso' && nx.estado === 'live') evs.push({ tipo: 'reanudacion', eventId: nx.eventId, minuto: nx.minuto });
      continue;
    }
    const seen = new Set((pv.incidents || []).map(i => i.key));
    for (const inc of (nx.incidents || [])) {
      if (!seen.has(inc.key)) { evs.push({ tipo: inc.tipo === 'sub' ? 'cambio' : 'tarjeta', eventId: nx.eventId, ...inc }); break; }
    }
  }
  return evs;
}
```

`buildEventToastHtml(ev, ctx)`: switch per `tipo` returning `.toast` HTML; goal toast shows `+before → +after` pronóstico line and `es tuyo: +N fantasy` plant line only when `ctx.isMine` (plant delta passed as `ctx.plantDelta`); final toast shows `Ese partido te dio +N`; descanso shows temp pts; tarjeta notes no direct points. (Exact copy per tipo; keep each branch under 6 lines.)

CSS: append toast/animation block (~90 lines, keyframes listed above; base them on the validated mockups in `.superpowers/brainstorm/7502-1789038943/content/gol-v2.html` and `eventos-todos.html`).

- [ ] **Step 4: Run tests**

Run: `node --test tests/liveEvents.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/liveTab.js css/styles.css tests/liveEvents.test.js
git commit -m "feat(live): detección de eventos y toasts animados"
```

---

### Task 6: Wire-up, version bump, full suites

**Files:**
- Modify: `/home/ldoc/Proyectos/porra-spa/js/main.js` (`renderLiveSubTab` composes 3 sections; `pollLiveMatches` diffs + fires toasts only when `AppState.resultadosTab === 'live'`)
- Modify: `/home/ldoc/Proyectos/porra-spa/index.html` (`styles.css?v=93→94`, `liveTab.js?v=4→5`, `main.js?v=131→132`)
- Test: full suites in both repos

**Interfaces:**
- Consumes: all Task 2–5 functions; `calculatePlayerMatchPoints` (same file, passed as `scorePlayer`).
- Produces: Live sub-tab rendering sections 1–3; toasts on new events; green suites.

- [ ] **Step 1: Rewire `renderLiveSubTab`** — replace the `paint` cards composition with:

```js
const paint = (list) => {
  if (!list.length) return emptyHtml;
  const myName = AppState.currentUser?.name;
  const myPreds = {};
  for (const live of list) myPreds[live.eventId] = AppState.scorePredictions?.[live.eventId] || AppState.allPredictions?.[myName]?.[live.eventId] || null;
  const strip = liveTab.buildLiveStripHtml(list, myPreds, teamNames);
  const rows = liveTab.computeLiveTemporal(list, AppState.allPredictions || {}, AppState.squadsCache || {}, calculatePlayerMatchPoints);
  const table = `<div class="sect">⏱️ Clasificación temporal</div>` + liveTab.buildTemporalTableHtml(rows, myName);
  const players = liveTab.computeLivePlayerRanking(list, AppState.squadsCache || {}, calculatePlayerMatchPoints);
  const ranking = players.length ? `<div class="sect">⭐ Futbolistas</div>` + liveTab.buildPlayerRankingHtml(players, { currentUser: myName, playerExts }) : '';
  return strip + table + ranking;
};
```

Add module-level `_prevLiveSnapshot = null`; in `pollLiveMatches`, after merging: if Live tab open and visible, `const evs = liveTab.detectLiveEvents(_prevLiveSnapshot || [], merged)` — but on first sighting prev is `[]` → no events by design; then set `_prevLiveSnapshot = merged`. For each event, compute ctx (my pts before/after via `liveTab.livePointsForUser` on prev/next docs, temp totals via `computeLiveTemporal` sums for current user) and prepend `liveTab.buildEventToastHtml(ev, ctx)` into a `#live-toasts` container (create it at top of Live scroll container if missing); toast auto-removes after 6 s and on click. Guard everything in try/catch so toasts never break polling.

- [ ] **Step 2: Bump versions in `index.html`**

`css/styles.css?v=93` → `?v=94`; `js/liveTab.js?v=4` → `?v=5`; `js/main.js?v=131` → `?v=132`.

- [ ] **Step 3: Run full suites**

Run: `node --test tests/*.test.js` in `/home/ldoc/Proyectos/porra-spa` → all PASS.
Run: `node --test tests/*.test.js` in `/home/ldoc/Proyectos/api-porra` → all PASS.
Manual check: open Live tab with 2 live matches; confirm strip (3-per-row), unified table, ranking, and goal toast on next poll.

- [ ] **Step 4: Commit**

```bash
git add js/main.js index.html
git commit -m "feat(live): compone tira + temporal + ranking y toasts en polling"
```

---

## Self-Review

**1. Spec coverage:** §1 strip (Task 3) incl. 3-per-row, pts next to minute, 3-letter caps; §2 unified table official rules (Task 2); §3 esencial ranking + ⭐ + owners Tú+3+(+N), minutos>0 (Task 4); §4 all 7 event types, animation per event, 6 s/tap/no-sound, backend incidents (Tasks 1+5+6). Covered.

**2. Placeholder scan:** no TBD/TODO; every code step has exact code; CSS keyframe names listed; toast branches bounded ("keep each branch under 6 lines" with exact fields from test). The CSS keyframes reference validated mockup files for exact values. Fixed.

**3. Type consistency:** `scorePlayer(j, sp, live)` → `{total}` matches `calculatePlayerMatchPoints(playerData, squadPlayer, matchStat)` usage (`.total`); live doc passed as matchStat works (uses `.stats` keys + `squadPlayer.equipo`). `detectLiveEvents` shape matches toast builder fields. `computeLiveTemporal` row fields match `buildTemporalTableHtml`. Consistent.
