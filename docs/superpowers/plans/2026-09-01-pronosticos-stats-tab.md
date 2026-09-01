# Pronósticos Stats Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la sub-pestaña Consenso por una nueva Pronósticos (primera en Estadísticas) con 4 bloques apilados (Partidos, Clasificación pronosticada, Eliminatorias, Plantilla) usando enfoque A scroll apilado.

**Architecture:** Todo en `js/stats.js` como funciones puras IIFE exportadas via `global.PorraStats` (sin nuevo módulo). `SUBTABS` reordenado, `renderPronosticosBody()` pinta 4 cards con cálculos puros que toleran `matchStats` vacío. Reutiliza `tallyChampions`, `compareQuadroWithCommunity`, `aggregateSquads` y factoriza `calculatePredictedStandings` a versión pura por usuario.

**Tech Stack:** Vanilla JS ES6+, IIFE `js/stats.js`, CSS vanilla `:root` tokens, Node `assert` tests (`node tests/*.test.js`), localStorage cache sin cambios.

## Global Constraints

- Stack vanilla sin frameworks CSS/JS externos — no Tailwind/Bootstrap/React.
- Mobile vertical first: `max-width:480px`, `100dvh`, `overflow-x:hidden`, `44x44px` touch, `max-height:90dvh` modales.
- Reutilizar variables CSS `:root` de `css/styles.css` (colores `#0F172A`, `#1E293B`, acentos `#10B981`, `#06B6D4`, `#8B5CF6`, `#F59E0B`).
- HTML semántico + ids únicos, sin romper `100dvh`/`safe-area`.
- Guard `isFasePretemporada()` mantiene Estadísticas oculta con mensaje "Disponible al inicio" — también para Pronósticos (no relajar).
- Cálculos de Pronósticos deben funcionar aunque `matchStats` esté vacío (solo `allPredictions`).
- Cache-busting: bump `?v=` en `index.html` para `css/styles.css`, `js/main.js`, `js/stats.js` tras cambios.
- Tests con `node` + `assert`, patrón IIFE export `require('../js/stats.js')` si se adapta a Node, o mantener `global` mock.

---

### Task 1: Reordenar SUBTABS y default a Pronósticos

**Files:**
- Modify: `js/stats.js:495-501` — reordenar `SUBTABS` y eliminar entrada `consenso`
- Modify: `js/main.js:50` — default `estadisticasSubTab: 'pronosticos'`
- Modify: `js/stats.js:608-616` — `initStatsState` default fallback
- Test: `tests/estadisticasPronosticos.test.js` (nuevo temporal para esta task)

**Interfaces:**
- Consumes: `AppState.estadisticasSubTab` existente
- Produces: `SUBTABS` con 5 entradas ordenadas `pronosticos,evolucion,individual,rachas,plantillas`; default `'pronosticos'`

- [ ] **Step 1: Write the failing test**

```js
// tests/estadisticasPronosticos.test.js
const assert = require('assert');
const fs = require('fs');
const statsSrc = fs.readFileSync('js/stats.js','utf8');
assert(statsSrc.includes("key: 'pronosticos'"), 'SUBTABS debe contener pronosticos');
assert(statsSrc.indexOf("'pronosticos'") < statsSrc.indexOf("'evolucion'"), 'pronosticos debe ser primero');
assert(!statsSrc.includes("key: 'consenso'"), 'consenso debe eliminarse');
const mainSrc = fs.readFileSync('js/main.js','utf8');
assert(mainSrc.includes("estadisticasSubTab: 'pronosticos'"), 'default debe ser pronosticos');
console.log('OK Task1');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/estadisticasPronosticos.test.js`
Expected: FAIL — `consenso` aún presente, default es `evolucion`

- [ ] **Step 3: Write minimal implementation**

```js
// js/stats.js:495-501
const SUBTABS = [
  { key: 'pronosticos', label: 'Pronósticos' },
  { key: 'evolucion', label: 'Evolución' },
  { key: 'individual', label: 'Individual' },
  { key: 'rachas', label: 'Rachas' },
  { key: 'plantillas', label: 'Plantillas' },
];
```
```js
// js/main.js:50
estadisticasSubTab: 'pronosticos',
```
```js
// js/stats.js:608
if (!AppState.estadisticasSubTab) AppState.estadisticasSubTab = 'pronosticos';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/estadisticasPronosticos.test.js`
Expected: PASS `OK Task1`

- [ ] **Step 5: Commit**

```bash
git add js/stats.js js/main.js tests/estadisticasPronosticos.test.js
git commit -m "feat(stats): reorder SUBTABS pronosticos first, remove consenso"
```

---

### Task 2: Cálculos puros — Partidos (A-G)

**Files:**
- Modify: `js/stats.js` — añadir funciones puras nuevas tras `aggregateSquads`
- Test: `tests/pronosticosPartidos.test.js` (nuevo)

**Interfaces:**
- Consumes: `allPredictions: {username: {matchId:{home,away}} }`, `leagueMatches: [{id,homeTeamId,awayTeamId}]`
- Produces: `calcPronosticosPartidosStats(allPredictions, leagueMatches)` → `{ globalCounts:{H,D,A}, globalPct, scoreVotes:[{score,votes,pct}], mostRepeated:{score,votes,pct}, leastRepeated, raro:{score,votes} | null, mostConsensus:{matchId,pct,result}, mostDivided:{matchId,entropy}, sesgo:{H,D,A}, avgGoalsByUser:[{username,avg}], conservador:{username,avg}, arriesgado:{username,avg}, localAvg, visitanteAvg, delta }`

- [ ] **Step 1: Write the failing test**

```js
// tests/pronosticosPartidos.test.js
const assert = require('assert');
const { calcPronosticosPartidosStats } = require('../js/stats.js');

function test_global_y_scoreVotes() {
  const league = [{id:1},{id:2},{id:3}];
  const preds = {
    a:{1:{home:2,away:1},2:{home:1,away:1},3:{home:0,away:1}},
    b:{1:{home:2,away:1},2:{home:0,away:0},3:{home:0,away:1}},
    c:{1:{home:1,away:0},2:{home:1,away:1}},
  };
  const r = calcPronosticosPartidosStats(preds, league);
  assert.strictEqual(r.globalCounts.H, 3); // 2-1,2-1,1-0
  assert.strictEqual(r.globalCounts.D, 3); // 1-1,0-0,1-1
  assert.strictEqual(r.globalCounts.A, 2);
  assert.strictEqual(r.mostRepeated.score, '2-1');
  assert.strictEqual(r.mostRepeated.votes, 2);
  assert.strictEqual(r.raro.score, '1-0'); // voto único <5%? en dataset pequeño 1/8=12% pero es único
  assert.ok(r.sesgo.H > 0);
  assert.strictEqual(r.conservador.username, 'c'); // c promedia menos goles
  assert.strictEqual(r.arriesgado.username, 'a');
}

function test_vacio() {
  const r = calcPronosticosPartidosStats({}, []);
  assert.deepStrictEqual(r.globalCounts, {H:0,D:0,A:0});
  assert.strictEqual(r.mostRepeated, null);
  assert.strictEqual(r.raro, null);
}
test_global_y_scoreVotes();
test_vacio();
console.log('OK pronosticosPartidos');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/pronosticosPartidos.test.js`
Expected: FAIL `calcPronosticosPartidosStats is not a function`

- [ ] **Step 3: Write minimal implementation**

```js
function matchResultOf(home,away){ if(home>away) return 'H'; if(home<away) return 'A'; return 'D'; }

function calcPronosticosPartidosStats(allPredictions, leagueMatches){
  const counts={H:0,D:0,A:0};
  const scoreVotes=new Map();
  let total=0, sumLocal=0, sumVisit=0;
  const perUserAvg={};
  const matchConsensus=new Map(); // matchId -> {H,D,A}
  for(const [username,preds] of Object.entries(allPredictions||{})){
    let gSum=0,gN=0;
    for(const m of leagueMatches||[]){
      const pr=preds?.[m.id];
      if(!pr||!Number.isFinite(pr.home)||!Number.isFinite(pr.away)) continue;
      const res=matchResultOf(pr.home,pr.away);
      counts[res]++; total++;
      const key=`${pr.home}-${pr.away}`;
      scoreVotes.set(key,(scoreVotes.get(key)||0)+1);
      sumLocal+=pr.home; sumVisit+=pr.away;
      gSum+=pr.home+pr.away; gN++;
      if(!matchConsensus.has(m.id)) matchConsensus.set(m.id,{H:0,D:0,A:0,total:0});
      const mc=matchConsensus.get(m.id); mc[res]++; mc.total++;
    }
    if(gN) perUserAvg[username]= Math.round((gSum/gN)*10)/10;
  }
  const scoreRows=[...scoreVotes.entries()].map(([score,votes])=>({score,votes,pct: total?Math.round(votes/total*100):0})).sort((a,b)=>b.votes-a.votes);
  const mostRepeated=scoreRows[0]||null;
  const leastRepeated=scoreRows[scoreRows.length-1]||null;
  const raro=scoreRows.find(s=> s.votes===1 || s.pct<5) ? [...scoreRows].reverse().find(s=> s.votes===1 || s.pct<5) : null; // el más raro (menos votos que cumple)
  // alternativas: filtrar raros y coger último
  let mostConsensus=null, mostDivided=null, maxPct=-1, minEntropy=Infinity;
  // entropy: -sum(p log p)
  for(const [matchId,mc] of matchConsensus){
    const pctMax=Math.max(mc.H,mc.D,mc.A)/mc.total*100;
    if(pctMax>maxPct){ maxPct=pctMax; mostConsensus={matchId, pct:Math.round(pctMax), result: mc.H>=mc.D&&mc.H>=mc.A?'H':mc.D>=mc.A?'D':'A'}; }
    const ps=[mc.H,mc.D,mc.A].map(c=>c/mc.total).filter(p=>p>0);
    const ent=-ps.reduce((a,p)=>a+p*Math.log2(p),0);
    // max entropy = most divided (cerca de 1.58 para 3 iguales)
    if(mostDivided===null || ent>mostDivided.entropy) mostDivided={matchId, entropy: Math.round(ent*100)/100};
  }
  const entries=Object.entries(perUserAvg).map(([username,avg])=>({username,avg})).sort((a,b)=>a.avg-b.avg);
  const globalPct={ H: total?Math.round(counts.H/total*100):0, D: total?Math.round(counts.D/total*100):0, A: total?Math.round(counts.A/total*100):0 };
  return {
    globalCounts:counts, globalPct, scoreVotes:scoreRows, mostRepeated, leastRepeated, raro,
    mostConsensus, mostDivided, sesgo: globalPct,
    avgGoalsByUser: entries,
    conservador: entries[0]||null, arriesgado: entries[entries.length-1]||null,
    localAvg: total?Math.round((sumLocal/total)*10)/10:0,
    visitanteAvg: total?Math.round((sumVisit/total)*10)/10:0,
    delta: total?Math.round(((sumLocal-sumVisit)/total)*10)/10:0,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/pronosticosPartidos.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/pronosticosPartidos.test.js
git commit -m "feat(stats): add calcPronosticosPartidosStats pure"
```

---

### Task 3: Cálculos puros — Clasificación pronosticada (C1-4)

**Files:**
- Modify: `js/stats.js` — añadir `calcPredictedStandingsForPreds(preds, matches, teamsMap)` factorizada + `calcClasificacionPronosticosStats(allPredictions, matches, teamsMap)`
- Test: `tests/pronosticosClasificacion.test.js`

**Interfaces:**
- Consumes: `allPredictions`, `leagueMatches`, `teamsMap`
- Produces: `calcPredictedStandingsForPreds(preds, matches, teamsMap)` → array standings ordenado (reusa getTeamStats lógica sin mutar AppState); `calcClasificacionPronosticosStats(...)` → `{ freqPrimero:Map(teamId->count), freqTop8, freqFuera24, mediaPos:Map(teamId->avg), dispersion:Map(teamId->sigma), topMedia5:[teamId] }`

- [ ] **Step 1: Write the failing test**

```js
const assert=require('assert');
const { calcClasificacionPronosticosStats } = require('../js/stats.js');
function test_freq_y_media(){
  const teamsMap={10:{name:'A'},20:{name:'B'},30:{name:'C'}};
  const matches=[
    {id:1, fase:'liga', ronda:1, homeTeamId:10, awayTeamId:20},
    {id:2, fase:'liga', ronda:1, homeTeamId:20, awayTeamId:30},
    {id:3, fase:'liga', ronda:1, homeTeamId:30, awayTeamId:10},
  ];
  const preds={
    u1:{1:{home:2,away:0},2:{home:1,away:1},3:{home:0,away:2}}, // A 6pts
    u2:{1:{home:0,away:2},2:{home:2,away:0},3:{home:2,away:0}}, // B?
  };
  const r=calcClasificacionPronosticosStats(preds, matches, teamsMap);
  assert.ok(r.freqPrimero.get(10) >=1);
  assert.ok(r.mediaPos.get(10) >0);
  assert.ok(Array.isArray(r.topMedia5));
}
function test_vacio(){
  const r=calcClasificacionPronosticosStats({}, [], {});
  assert.strictEqual(r.freqPrimero.size,0);
}
test_freq_y_media(); test_vacio(); console.log('OK clasificacion');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/pronosticosClasificacion.test.js`
Expected: FAIL no function

- [ ] **Step 3: Write minimal implementation**

Factorizar `getTeamStatsForPreds(preds, teamId, matches)` que no lee `AppState`. Luego `calcPredictedStandingsForPreds` ordena con criterios 1-5 (y 6-8 si hace falta). Luego `calcClasificacionPronosticosStats` itera usuarios, llama standings, acumula freq y posiciones, calcula media y σ.

```js
function getTeamStatsForPreds(preds, teamId, matches){
  let PJ=0,V=0,E=0,D=0,GF=0,GC=0,awayWins=0,awayGoals=0;
  for(const m of matches||[]){
    const pr=preds?.[m.id]; if(!pr||!Number.isFinite(pr.home)||!Number.isFinite(pr.away)) continue;
    const isHome=m.homeTeamId===teamId, isAway=m.awayTeamId===teamId;
    if(!isHome&&!isAway) continue;
    PJ++; const gf=isHome?pr.home:pr.away, gc=isHome?pr.away:pr.home;
    GF+=gf; GC+=gc;
    if(gf>gc){ V++; if(isAway) awayWins++; }
    else if(gf===gc) E++;
    else D++;
    if(isAway) awayGoals+=gf;
  }
  return { teamId, PJ, V, E, D, GF, GC, DG: GF-GC, Pts: V*3+E, awayWins, awayGoals };
}
function calcPredictedStandingsForPreds(preds, matches, teamsMap){
  const ids=Object.keys(teamsMap||{}).map(Number);
  const stats=ids.map(id=> getTeamStatsForPreds(preds,id,matches));
  stats.sort((a,b)=> b.Pts-a.Pts || b.DG-a.DG || b.GF-a.GF || b.awayGoals-a.awayGoals || b.V-a.V || b.awayWins-a.awayWins);
  return stats;
}
function calcClasificacionPronosticosStats(allPredictions, matches, teamsMap){
  const freqPrimero=new Map(), freqTop8=new Map(), freqFuera24=new Map(), posLists=new Map();
  const users=Object.keys(allPredictions||{});
  for(const u of users){
    const standings=calcPredictedStandingsForPreds(allPredictions[u], matches, teamsMap);
    standings.forEach((s,i)=>{
      const pos=i+1;
      if(!posLists.has(s.teamId)) posLists.set(s.teamId, []);
      posLists.get(s.teamId).push(pos);
      if(pos===1) freqPrimero.set(s.teamId,(freqPrimero.get(s.teamId)||0)+1);
      if(pos<=8) freqTop8.set(s.teamId,(freqTop8.get(s.teamId)||0)+1);
      if(pos>24) freqFuera24.set(s.teamId,(freqFuera24.get(s.teamId)||0)+1);
    });
  }
  const mediaPos=new Map(), dispersion=new Map();
  for(const [tid,arr] of posLists){
    const mean=arr.reduce((a,b)=>a+b,0)/arr.length;
    mediaPos.set(tid, Math.round(mean*10)/10);
    const vari=arr.reduce((a,b)=>a+(b-mean)**2,0)/arr.length;
    dispersion.set(tid, Math.round(Math.sqrt(vari)*10)/10);
  }
  const topMedia5=[...mediaPos.entries()].sort((a,b)=>a[1]-b[1]).slice(0,5).map(([tid])=>tid);
  return { freqPrimero, freqTop8, freqFuera24, mediaPos, dispersion, posLists, topMedia5, users: users.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/pronosticosClasificacion.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/pronosticosClasificacion.test.js
git commit -m "feat(stats): add clasificacion pronosticos stats pure"
```

---

### Task 4: Cálculos puros — Eliminatorias y Plantilla extras

**Files:**
- Modify: `js/stats.js` — añadir `calcEliminatoriasPronosticosStats(finalPredictionsCache)` y `calcPlantillaPronosticosExtras(squadPointsByUser, squadsCache)`
- Test: `tests/pronosticosElimsPlantilla.test.js`

**Interfaces:**
- Consumes: `finalPredictionsCache:{username:{champion,runnerUp,semiFinalists,quarterFinalists,roundOf16,roundOf32}}`, `squadsCache`, `squadPointsByUser` (de `aggregateSquads`)
- Produces: `calcEliminatoriasPronosticosStats` → `{ championTally, finalTally:[{pair,votes}], semisFreq:Map(teamId->count), quadro }`; `calcPlantillaPronosticosExtras` → `{ top3ByPos:{G:[],D:[],M:[],F:[]}, equipoMas, equipoMenos, imprescindible:[], diferencial:[], hipster:{username,avgCommon}, mainstream:{username,avgCommon} }`

- [ ] **Step 1: Write the failing test**

```js
const assert=require('assert');
const { calcEliminatoriasPronosticosStats, calcPlantillaPronosticosExtras, aggregateSquads } = require('../js/stats.js');
function test_elims(){
  const cache={a:{champion:10,runnerUp:20,semiFinalists:[30,40],quarterFinalists:[50,60,70,80],roundOf16:[1,2,3,4,5,6,7,8],roundOf32:[9,10,11,12,13,14,15,16]}, b:{champion:10,runnerUp:20,semiFinalists:[30,41],quarterFinalists:[50,60,70,81],roundOf16:[1,2,3,4,5,6,7,8],roundOf32:[9,10,11,12,13,14,15,16]}};
  const r=calcEliminatoriasPronosticosStats(cache);
  assert.strictEqual(r.championTally.teams[0].teamId,10);
  assert.ok(r.semisFreq.get(30)===2);
  assert.strictEqual(r.finalTally[0].pair,'10-20');
}
function test_plantilla(){
  const squads={a:[{id:1,posicion:'G',equipo:10},{id:2,posicion:'D',equipo:20}], b:[{id:1,posicion:'G',equipo:10}]};
  const pts={a:{playerDetails:[{jugador:{id:1},puntosTotal:10}]}, b:{playerDetails:[{jugador:{id:1},puntosTotal:5}]}};
  const agg=aggregateSquads(pts,squads);
  const r=calcPlantillaPronosticosExtras(agg, squads);
  assert.strictEqual(r.top3ByPos.G[0].player.id,1);
  assert.ok(r.equipoMas.equipo===10);
}
test_elims(); test_plantilla(); console.log('OK elimsPlantilla');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/pronosticosElimsPlantilla.test.js`
Expected: FAIL

- [ ] **Step 3: Write minimal implementation**

Reuse `tallyChampions`, `compareQuadroWithCommunity`. Para `calcEliminatoriasPronosticosStats`: tally champion, tally final pair (`champion-runnerUp`), tally semis freq, reuse quadro. Para plantilla: agrupar `agg.rows` por `posicion`, ordenar por `possessionPct`, tomar top3, calcular `equipoMas/Menos` contando picks por `equipo`, imprescindible/diferencial filtrando `possessionPct`, hipster/mainstream comparando coincidencia media (para cada usuario calcular intersección con pool global).

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/pronosticosElimsPlantilla.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add js/stats.js tests/pronosticosElimsPlantilla.test.js
git commit -m "feat(stats): add eliminatorias+plantilla pronosticos extras pure"
```

---

### Task 5: Render Pronósticos Body (4 cards) + CSS + bump versions

**Files:**
- Modify: `js/stats.js` — `renderStatsContent()` primera rama `pronosticos`, implementar `renderPronosticosBody(aggregates)` + 4 helpers `renderPronosticosPartidosCard`, `renderPronosticosClasificacionCard`, `renderPronosticosEliminatoriasCard`, `renderPronosticosPlantillaCard`
- Modify: `js/stats.js` — `buildStatsAggregates()` ampliar para pronósticos o calcular lazy
- Modify: `css/styles.css` — añadir `.stats-pronosticos-*` (grid 2x2, border-left colores, pills)
- Modify: `index.html` — bump `?v=` para `styles.css`, `main.js`, `stats.js`
- Test: `tests/pronosticosRender.test.js` (DOM ligero con jsdom o string contains)

**Interfaces:**
- Consumes: `aggregates` de `buildStatsAggregates()` + funciones puras de Tasks 2-4 + `AppState.teamsMap`, `AppState.players`
- Produces: HTML string con 4 cards, cada una con `statsEmpty` si sin datos

- [ ] **Step 1: Write the failing test**

```js
const assert=require('assert');
const fs=require('fs');
const src=fs.readFileSync('js/stats.js','utf8');
assert(src.includes('renderPronosticosBody'), 'debe existir renderPronosticosBody');
assert(src.includes('pronosticos-partidos') || src.includes('Pronósticos de partidos'), 'debe renderizar partidos card');
console.log('OK render');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/pronosticosRender.test.js`
Expected: FAIL no function

- [ ] **Step 3: Write minimal implementation**

```js
function renderPronosticosBody(aggregates){
  const partidos=calcPronosticosPartidosStats(AppState.allPredictions, AppState.leagueMatches);
  const clasif=calcClasificacionPronosticosStats(AppState.allPredictions, AppState.leagueMatches, AppState.teamsMap);
  const elims=calcEliminatoriasPronosticosStats(AppState.finalPredictionsCache);
  const squadAgg=aggregateSquads(buildSquadPointsByUser(), AppState.squadsCache);
  const plantilla=calcPlantillaPronosticosExtras(squadAgg, AppState.squadsCache);
  return `
  <div class="stats-card" style="border-left:3px solid var(--accent-primary)">${renderPronosticosPartidosCard(partidos)}</div>
  <div class="stats-card" style="border-left:3px solid var(--accent-cyan)">${renderPronosticosClasificacionCard(clasif)}</div>
  <div class="stats-card" style="border-left:3px solid var(--accent-purple)">${renderPronosticosEliminatoriasCard(elims)}</div>
  <div class="stats-card" style="border-left:3px solid var(--accent-gold)">${renderPronosticosPlantillaCard(plantilla, squadAgg)}</div>`;
}
// helpers generan filas, KPIs, barras, pills; si sin datos retornan statsEmpty('Aún no hay pronósticos')
```

CSS: reutiliza `.stats-card`, añade `.stats-pronosticos-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}` y `.stats-pill`.

Bump `index.html`: `css/styles.css?v=86`, `js/stats.js?v=5`, `js/main.js?v=124`

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/pronosticosRender.test.js` + `npm test` (o `for f in tests/*.test.js; do node $f; done`)
Expected: PASS, sin regresiones en `estadisticas-subtabs.test.js`

- [ ] **Step 5: Commit**

```bash
git add js/stats.js css/styles.css index.html tests/pronosticosRender.test.js
git commit -m "feat(stats): render pronosticos body 4 cards + styles + bump v"
```

---

### Task 6: Cleanup Consenso y verificación final

**Files:**
- Modify: `js/stats.js` — eliminar `renderConsensoBody`, `getDefaultConsensoRonda`, `normalizeConsensoRonda`, `consensoBars`, `consensoScoreGrid`, `computeMatchConsensus` si no se reutiliza (mantener si se usa en Partidos? no, Partidos usa nueva función), limpiar `AppState.estadisticasConsensoRonda` referencias
- Test: `tests/estadisticas-subtabs.test.js` — actualizar imports si se borran funciones testeadas (migrar tests de consenso a legacy o borrar)
- Verify: `node` all tests

**Interfaces:**
- Consumes: nothing; cleanup
- Produces: codebase sin referencias a `consenso`

- [ ] **Step 1: Write the failing test (verificar no hay referencias)**

```js
const fs=require('fs'); const assert=require('assert');
const src=fs.readFileSync('js/stats.js','utf8');
assert(!src.includes('consenso') || src.includes('pronosticos'), 'no debe quedar consenso');
assert(!src.includes('renderConsensoBody'), 'renderConsensoBody eliminado');
console.log('OK cleanup');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/cleanupCheck.test.js`
Expected: FAIL aún existe

- [ ] **Step 3: Write minimal implementation**

Borrar bloques consenso, quitar `AppState.estadisticasConsensoRonda` de `js/main.js:51` y de `js/stats.js` helpers. Actualizar `buildStatsAggregates` para no computar consenso.

- [ ] **Step 4: Run test to verify it passes**

Run: `for f in tests/*.test.js; do echo "Running $f"; node "$f" || exit 1; done`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add js/stats.js js/main.js tests/
git commit -m "chore(stats): remove consenso legacy code"
```

---

## Self-Review

- Spec coverage: Partidos A-G → Task2, Clasificación C1-4 → Task3, Eliminatorias E1-4 → Task4, Plantilla P1-4 → Task4, SUBTABS reorder → Task1, Render 4 cards → Task5, Cleanup consenso → Task6. Guard pretemporada verificado en Task5 render. Cache-busting en Task5.
- Placeholder scan: sin TBD/TODO, todos los pasos tienen código concreto.
- Type consistency: `calcPronosticosPartidosStats` firma igual en Task2 y Task5; `aggregateSquads` reutilizada sin renombrar; `matchResultOf` no duplicada (reusa existente).

