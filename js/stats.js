(function (global) {
  function buildTimeline() {
    const items = [];
    for (let r = 1; r <= 8; r++) {
      items.push({ point: r - 1, label: `J${r}`, kind: 'liga', ronda: r });
    }
    const fases = [['16', '16'], ['8', '8'], ['4', '4'], ['semis', 'Semis'], ['final', 'Final']];
    fases.forEach(([fase, label], i) => items.push({ point: 8 + i, label, kind: 'fase', fase }));
    return items;
  }

  function emptySeries() {
    return { series: Array(13).fill(0), hasData: false };
  }

  function toCumulative(acc) {
    let running = 0;
    const out = Array(13).fill(0);
    for (let p = 0; p < 13; p++) {
      running += acc[p] || 0;
      out[p] = running;
    }
    return out;
  }

  function positionForMatch(match) {
    if (match.fase === 'liga') {
      const ronda = Number(match.ronda);
      if (ronda >= 1 && ronda <= 8) return ronda - 1;
      return null;
    }
    const faseMap = { '16': 8, '8': 9, '4': 10, 'semis': 11, 'final': 12 };
    return faseMap[match.fase] ?? null;
  }

  function calcPredictionSeries(matchDetails) {
    const acc = Array(13).fill(0);
    let hasData = false;
    for (const d of matchDetails || []) {
      const m = d.match;
      if (!m || m.fase !== 'liga') continue;
      const ronda = Number(m.ronda);
      if (!Number.isFinite(ronda) || ronda < 1 || ronda > 8) continue;
      acc[ronda - 1] += d.points || 0;
      hasData = true;
    }
    if (!hasData) return emptySeries();
    return { series: toCumulative(acc), hasData: true };
  }

  function calcSquadSeries(squadPoints, matchesById) {
    const acc = Array(13).fill(0);
    let hasData = false;
    for (const pd of squadPoints?.playerDetails || []) {
      for (const partido of pd.partidos || []) {
        const match = matchesById?.[partido.eventId];
        if (!match) continue;
        const pos = positionForMatch(match);
        if (pos === null) continue;
        acc[pos] += partido.puntos || 0;
        hasData = true;
      }
    }
    if (!hasData) return emptySeries();
    return { series: toCumulative(acc), hasData: true };
  }

  function calcClassificationSeries(total, leagueComplete) {
    if (!leagueComplete || !total) return emptySeries();
    const series = Array(13).fill(0);
    for (let p = 7; p < 13; p++) series[p] = total;
    return { series, hasData: true };
  }

  function calcEliminatoriasSeries(teamDetails) {
    const acc = Array(13).fill(0);
    const rankPos = { 1: 8, 2: 9, 3: 10, 4: 11, 5: 12, 6: 12 };
    let hasData = false;
    for (const td of teamDetails || []) {
      const pos = rankPos[td.reachedRank];
      if (pos === undefined) continue;
      acc[pos] += td.points || 0;
      hasData = true;
    }
    if (!hasData) return emptySeries();
    return { series: toCumulative(acc), hasData: true };
  }

  function sumSeries(results) {
    const out = Array(13).fill(0);
    let hasData = false;
    for (const r of results || []) {
      if (!r) continue;
      hasData = hasData || r.hasData;
      for (let p = 0; p < 13; p++) out[p] += r.series[p] || 0;
    }
    return { series: out, hasData };
  }

  function isLeagueComplete(matches, matchStats) {
    const league = (matches || []).filter(m => m.fase === 'liga');
    if (!league.length) return false;
    const ids = new Set((matchStats || []).map(ms => ms.eventId));
    return league.every(m => ids.has(m.id));
  }

  function matchResultOf(homeGoals, awayGoals) {
    if (homeGoals > awayGoals) return 'H';
    if (homeGoals < awayGoals) return 'A';
    return 'D';
  }

  function extractPlayedMatches(matches, matchStatsById) {
    const played = [];
    for (const m of matches || []) {
      const ms = matchStatsById?.[m.id];
      const home = ms?.stats?.[m.homeTeamId]?.goles;
      const away = ms?.stats?.[m.awayTeamId]?.goles;
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      played.push({ matchId: m.id, home, away, result: matchResultOf(home, away) });
    }
    return played;
  }

  function calcReliabilityRow(username, playedMatches, allPredictions, userPoints) {
    const preds = allPredictions?.[username] || {};
    const pointsByMatch = new Map();
    for (const d of userPoints?.[username]?.matchDetails || []) {
      if (d.match) pointsByMatch.set(d.match.id, d.points || 0);
    }
    let played = 0, hits = 0, pointsSum = 0, exact = 0, perfect = 0;
    for (const pm of playedMatches || []) {
      const pr = preds[pm.matchId];
      if (!pr || !Number.isFinite(pr.home) || !Number.isFinite(pr.away)) continue;
      played++;
      if (matchResultOf(pr.home, pr.away) === pm.result) hits++;
      const pts = pointsByMatch.get(pm.matchId) || 0;
      pointsSum += pts;
      if (pts >= 15) perfect++;
      if (pr.home === pm.home && pr.away === pm.away) exact++;
    }
    return {
      username,
      played,
      hits,
      pctResult: played ? Math.round((hits / played) * 100) : 0,
      ptsPerMatch: played ? Math.round((pointsSum / played) * 10) / 10 : 0,
      exactScores: exact,
      perfect15: perfect,
    };
  }

  function buildCompletedLeagueData(leagueMatches, matchStatsById, matchDetailsByUser) {
    const totalByRonda = new Map();
    const doneByRonda = new Map();
    for (const m of leagueMatches || []) {
      const r = Number(m.ronda);
      if (!(r >= 1 && r <= 8)) continue;
      totalByRonda.set(r, (totalByRonda.get(r) || 0) + 1);
      const home = matchStatsById?.[m.id]?.stats?.[m.homeTeamId]?.goles;
      const away = matchStatsById?.[m.id]?.stats?.[m.awayTeamId]?.goles;
      if (Number.isFinite(home) && Number.isFinite(away)) {
        doneByRonda.set(r, (doneByRonda.get(r) || 0) + 1);
      }
    }
    const completedRondas = [...totalByRonda.keys()]
      .filter(r => doneByRonda.get(r) === totalByRonda.get(r))
      .sort((a, b) => a - b);
    const idxByRonda = new Map(completedRondas.map((r, i) => [r, i]));

    const pointsByUserByJornada = {};
    for (const [username, details] of Object.entries(matchDetailsByUser || {})) {
      const arr = completedRondas.map(() => 0);
      for (const d of details || []) {
        const m = d.match;
        if (!m || m.fase !== 'liga') continue;
        const idx = idxByRonda.get(Number(m.ronda));
        if (idx === undefined) continue;
        arr[idx] += d.points || 0;
      }
      pointsByUserByJornada[username] = arr;
    }
    return { completedRondas, pointsByUserByJornada };
  }

  function calcStreaks(pointsByUserByJornada) {
    const out = {};
    for (const [username, arr] of Object.entries(pointsByUserByJornada || {})) {
      let dir = null, len = 0;
      for (let i = arr.length - 1; i >= 1; i--) {
        if (arr[i] === arr[i - 1]) break;
        const curDir = arr[i] > arr[i - 1] ? 'up' : 'down';
        if (dir === null) { dir = curDir; len = 1; }
        else if (curDir === dir) len++;
        else break;
      }
      out[username] = dir ? { dir, len, lastPts: arr[arr.length - 1] || 0 } : null;
    }
    return out;
  }

  function calcBestJornadas(pointsByUserByJornada, topN = 5) {
    const items = [];
    for (const [username, arr] of Object.entries(pointsByUserByJornada || {})) {
      arr.forEach((pts, jornadaIdx) => items.push({ username, jornadaIdx, pts }));
    }
    items.sort((a, b) => b.pts - a.pts);
    return items.slice(0, topN);
  }

  function calcUserBestJornada(ptsArr) {
    const arr = ptsArr || [];
    if (!arr.length) return null;
    let best = { idx: 0, pts: arr[0] };
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > best.pts) best = { idx: i, pts: arr[i] };
    }
    return best;
  }

  function calcPositionHistory(pointsByUserByJornada) {
    const users = Object.keys(pointsByUserByJornada || {});
    let totalRondas = 0;
    for (const u of users) totalRondas = Math.max(totalRondas, (pointsByUserByJornada[u] || []).length);
    const out = {};
    const cum = {};
    for (const u of users) { out[u] = []; cum[u] = 0; }
    for (let j = 0; j < totalRondas; j++) {
      for (const u of users) cum[u] += ((pointsByUserByJornada[u] || [])[j] || 0);
      for (const u of users) {
        let rank = 1;
        for (const v of users) if (cum[v] > cum[u]) rank++;
        out[u].push(rank);
      }
    }
    return out;
  }

  function calcTimesTopJornada(pointsByUserByJornada) {
    const entries = Object.entries(pointsByUserByJornada || {});
    const out = {};
    for (const [u] of entries) out[u] = 0;
    if (!entries.length) return out;
    let len = 0;
    for (const [, arr] of entries) len = Math.max(len, arr.length);
    for (let j = 0; j < len; j++) {
      let max = null;
      for (const [, arr] of entries) {
        const v = arr[j] || 0;
        if (max === null || v > max) max = v;
      }
      for (const [u, arr] of entries) {
        if (max !== null && (arr[j] || 0) === max) out[u]++;
      }
    }
    return out;
  }

  function calcMomentum(ptsArr) {
    const arr = ptsArr || [];
    if (arr.length < 3) return null;
    const recent = arr.slice(-3).reduce((a, b) => a + b, 0);
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    const delta = Math.round((recent / 3 - avg) * 10) / 10;
    return { recent, avg: Math.round(avg * 10) / 10, delta };
  }

  function calcConsistency(ptsArr) {
    const arr = ptsArr || [];
    if (arr.length < 2) return null;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    return Math.round(Math.sqrt(variance) * 10) / 10;
  }

  function buildDonutSegments(parts) {
    const C = 2 * Math.PI * DONUT_RADIUS;
    const valid = (parts || []).filter(p => Number(p.value) > 0);
    const total = valid.reduce((a, p) => a + Number(p.value), 0);
    if (!valid.length || total <= 0) return [];
    let acc = 0;
    return valid.map(p => {
      const len = (Number(p.value) / total) * C;
      const seg = {
        key: p.key,
        label: p.label,
        color: p.color,
        value: Number(p.value),
        pct: Math.round((Number(p.value) / total) * 100),
        dasharray: `${len.toFixed(2)} ${(C - len).toFixed(2)}`,
        dashoffset: (-acc).toFixed(2),
      };
      acc += len;
      return seg;
    });
  }

  function calcPredictionBias(userPredictions, playedMatches) {
    const out = { H: { pred: 0, hits: 0 }, D: { pred: 0, hits: 0 }, A: { pred: 0, hits: 0 } };
    for (const pm of playedMatches || []) {
      const pr = userPredictions?.[pm.matchId];
      if (!pr || !Number.isFinite(pr.home) || !Number.isFinite(pr.away)) continue;
      const r = matchResultOf(pr.home, pr.away);
      out[r].pred++;
      if (r === pm.result) out[r].hits++;
    }
    return out;
  }

  function calcBestMatch(matchDetails) {
    let best = null;
    for (const d of matchDetails || []) {
      if (!d.match) continue;
      if (!best || (d.points || 0) > best.points) best = { points: d.points || 0, matchId: d.match.id };
    }
    return best;
  }

  function calcBestPlayersByPosition(playerDetails) {
    const best = { G: null, D: null, M: null, F: null, top: null };
    for (const pd of playerDetails || []) {
      const pos = pd.jugador?.posicion;
      const cur = pos && Object.prototype.hasOwnProperty.call(best, pos) ? best[pos] : undefined;
      if (pos && cur !== undefined && (!cur || pd.puntosTotal > cur.puntosTotal)) {
        best[pos] = { jugador: pd.jugador, puntosTotal: pd.puntosTotal };
      }
      if (!best.top || pd.puntosTotal > best.top.puntosTotal) {
        best.top = { jugador: pd.jugador, puntosTotal: pd.puntosTotal };
      }
    }
    return best;
  }

  function calcMostProfitablePlayer(playerDetails) {
    let best = null;
    for (const pd of playerDetails || []) {
      const partidos = (pd.partidos || []).length;
      if (partidos < 1) continue;
      const per = Math.round((pd.puntosTotal / partidos) * 10) / 10;
      if (!best || per > best.ptsPorPartido) {
        best = { jugador: pd.jugador, ptsPorPartido: per, partidos };
      }
    }
    return best;
  }

  function sourceSplitFromUserData(userTotalPoints, userData) {
    return {
      prediction: userTotalPoints || 0,
      squad: userData?.squadPoints?.totalPoints || 0,
      classification: userData?.classificationTotal || 0,
      eliminatorias: (userData?.eliminatoriasTeamDetails || []).reduce((a, t) => a + (t.points || 0), 0),
    };
  }

  function computeMatchConsensus(matchId, allPredictions) {
    const counts = { H: 0, D: 0, A: 0 };
    const scoreVotes = new Map();
    let total = 0;
    for (const preds of Object.values(allPredictions || {})) {
      const pr = preds?.[matchId];
      if (!pr || !Number.isFinite(pr.home) || !Number.isFinite(pr.away)) continue;
      total++;
      counts[matchResultOf(pr.home, pr.away)]++;
      const key = `${pr.home}-${pr.away}`;
      scoreVotes.set(key, (scoreVotes.get(key) || 0) + 1);
    }
    const topScores = [...scoreVotes.entries()]
      .map(([score, votes]) => ({ score, votes, pct: Math.round((votes / total) * 100) }))
      .sort((a, b) => b.votes - a.votes || a.score.localeCompare(b.score))
      .slice(0, 6);
    let majorityResult = null;
    if (total) {
      majorityResult = 'H';
      for (const k of ['D', 'A']) {
        if (counts[k] > counts[majorityResult]) majorityResult = k;
      }
    }
    const pct = {};
    for (const k of ['H', 'D', 'A']) pct[k] = total ? Math.round((counts[k] / total) * 100) : 0;
    return { counts, pct, total, topScores, majorityResult };
  }

  function tallyChampions(finalPredictionsCache) {
    const votes = new Map();
    let total = 0;
    for (const fp of Object.values(finalPredictionsCache || {})) {
      const c = fp?.champion;
      if (!Number.isFinite(c)) continue;
      total++;
      votes.set(c, (votes.get(c) || 0) + 1);
    }
    const teams = [...votes.entries()]
      .map(([teamId, n]) => ({ teamId, votes: n }))
      .sort((a, b) => b.votes - a.votes || a.teamId - b.teamId);
    return { total, teams };
  }

  function finalPredictionTeamIds(fp) {
    if (!fp) return [];
    const ids = [
      Number.isFinite(fp.champion) ? fp.champion : null,
      Number.isFinite(fp.runnerUp) ? fp.runnerUp : null,
      ...(Array.isArray(fp.semiFinalists) ? fp.semiFinalists : []),
      ...(Array.isArray(fp.quarterFinalists) ? fp.quarterFinalists : []),
      ...(Array.isArray(fp.roundOf16) ? fp.roundOf16 : []),
      ...(Array.isArray(fp.roundOf32) ? fp.roundOf32 : []),
    ];
    return ids.filter(v => Number.isFinite(v));
  }

  function compareQuadroWithCommunity(myUsername, finalPredictionsCache) {
    const mine = new Set(finalPredictionTeamIds(finalPredictionsCache?.[myUsername]));
    let users = 0, commonSum = 0, veryDiffCount = 0;
    for (const [username, fp] of Object.entries(finalPredictionsCache || {})) {
      if (!fp || username === myUsername) continue;
      const theirs = new Set(finalPredictionTeamIds(fp));
      let common = 0;
      for (const id of theirs) if (mine.has(id)) common++;
      const union = new Set([...mine, ...theirs]);
      users++;
      commonSum += common;
      if (union.size - common >= 12) veryDiffCount++;
    }
    const avgCommon = users ? Math.round((commonSum / users) * 10) / 10 : 0;
    const avgPct = users ? Math.round((commonSum / users / 24) * 100) : 0;
    return { users, avgCommon, avgPct, veryDiffCount };
  }

  function aggregateSquads(squadPointsByUser, squadsCache) {
    const agg = new Map();
    let usersWithSquad = 0;
    for (const [username, squad] of Object.entries(squadsCache || {})) {
      if (!Array.isArray(squad) || !squad.length) continue;
      usersWithSquad++;
      for (const sp of squad) {
        const id = String(sp?.id);
        if (!id || id === 'undefined') continue;
        if (!agg.has(id)) agg.set(id, { player: sp, owners: new Set(), pts: 0 });
        agg.get(id).owners.add(username);
      }
    }
    for (const sq of Object.values(squadPointsByUser || {})) {
      for (const pd of sq?.playerDetails || []) {
        const entry = agg.get(String(pd.jugador?.id));
        if (entry) entry.pts += pd.puntosTotal || 0;
      }
    }
    const rows = [...agg.values()].map(e => ({
      player: e.player,
      pts: e.pts,
      ownerCount: e.owners.size,
      possessionPct: usersWithSquad ? Math.round((e.owners.size / usersWithSquad) * 100) : 0,
    })).sort((a, b) => b.pts - a.pts || b.possessionPct - a.possessionPct);
    return { usersWithSquad, uniquePlayers: rows.length, rows };
  }

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

function calcEliminatoriasPronosticosStats(finalPredictionsCache){
  const championTally = tallyChampions(finalPredictionsCache);
  const pairVotes = new Map();
  for (const fp of Object.values(finalPredictionsCache || {})){
    const c = fp?.champion, r = fp?.runnerUp;
    if (!Number.isFinite(c) || !Number.isFinite(r)) continue;
    const pair = `${c}-${r}`;
    pairVotes.set(pair, (pairVotes.get(pair) || 0) + 1);
  }
  const finalTally = [...pairVotes.entries()].map(([pair, votes]) => ({ pair, votes })).sort((a,b)=> b.votes - a.votes || a.pair.localeCompare(b.pair));
  const semisFreq = new Map();
  for (const fp of Object.values(finalPredictionsCache || {})){
    for (const id of (Array.isArray(fp?.semiFinalists) ? fp.semiFinalists : [])){
      if (!Number.isFinite(id)) continue;
      semisFreq.set(id, (semisFreq.get(id) || 0) + 1);
    }
  }
  let quadro;
  try {
    let username = null;
    if (typeof AppState !== 'undefined' && AppState.currentUser && AppState.currentUser.name) username = AppState.currentUser.name;
    if (username && finalPredictionsCache && finalPredictionsCache[username]) {
      quadro = compareQuadroWithCommunity(username, finalPredictionsCache);
    } else {
      const first = Object.keys(finalPredictionsCache || {})[0] || null;
      quadro = first ? compareQuadroWithCommunity(first, finalPredictionsCache) : { users: 0, avgCommon: 0, avgPct: 0, veryDiffCount: 0 };
    }
  } catch(e){ quadro = { users: 0, avgCommon: 0, avgPct: 0, veryDiffCount: 0 }; }
  // Return shallow copy to avoid mutating compareQuadroWithCommunity result (pure, 4 keys only)
  quadro = { users: quadro.users, avgCommon: quadro.avgCommon, avgPct: quadro.avgPct, veryDiffCount: quadro.veryDiffCount };
  return { championTally, finalTally, semisFreq, quadro };
}

function calcPlantillaPronosticosExtras(aggOrPts, squadsCache){
  let agg, squads;
  if (aggOrPts && Array.isArray(aggOrPts.rows)) {
    agg = aggOrPts;
    squads = squadsCache || {};
  } else {
    squads = squadsCache || {};
    agg = aggregateSquads(aggOrPts || {}, squads);
  }
  const byPos = { G: [], D: [], M: [], F: [] };
  for (const pos of Object.keys(byPos)){
    const filtered = (agg.rows || []).filter(r => r.player && r.player.posicion === pos);
    filtered.sort((a,b)=> b.possessionPct - a.possessionPct || b.pts - a.pts);
    byPos[pos] = filtered.slice(0,3);
  }
  const equipoCount = new Map();
  for (const squad of Object.values(squads || {})){
    if (!Array.isArray(squad)) continue;
    for (const pl of squad){
      const eq = pl?.equipo;
      if (!Number.isFinite(eq)) continue;
      equipoCount.set(eq, (equipoCount.get(eq) || 0) + 1);
    }
  }
  let equipoMas = null, equipoMenos = null;
  for (const [equipo, count] of equipoCount){
    if (!equipoMas || count > equipoMas.count) equipoMas = { equipo, count };
    if (!equipoMenos || count < equipoMenos.count) equipoMenos = { equipo, count };
  }
  const imprescindible = (agg.rows || []).filter(r => r.possessionPct >= 70);
  const diferencial = (agg.rows || []).filter(r => r.possessionPct <= 30);
  const userIds = {};
  for (const [username, squad] of Object.entries(squads || {})){
    if (!Array.isArray(squad) || !squad.length) continue;
    userIds[username] = new Set(squad.map(p => String(p.id)));
  }
  const usernames = Object.keys(userIds);
  let hipster = null, mainstream = null;
  for (const u of usernames){
    let sum = 0, n = 0;
    for (const v of usernames){
      if (u === v) continue;
      let common = 0;
      for (const id of userIds[u]) if (userIds[v].has(id)) common++;
      sum += common; n++;
    }
    const avgCommon = n ? Math.round((sum / n) * 10) / 10 : 0;
    const entry = { username: u, avgCommon };
    if (!hipster || avgCommon < hipster.avgCommon) hipster = entry;
    if (!mainstream || avgCommon > mainstream.avgCommon) mainstream = entry;
  }
  return { top3ByPos: byPos, equipoMas, equipoMenos, imprescindible, diferencial, hipster, mainstream };
}

  function getSeriesBySource(source, userData) {
    switch (source) {
      case 'pronosticos':
        return calcPredictionSeries(userData?.matchDetails);
      case 'plantilla':
        return calcSquadSeries(userData?.squadPoints, userData?.matchesById);
      case 'clasificacion':
        return calcClassificationSeries(userData?.classificationTotal, userData?.leagueComplete);
      case 'eliminatorias':
        return calcEliminatoriasSeries(userData?.eliminatoriasTeamDetails);
      case 'total':
        return sumSeries([
          calcPredictionSeries(userData?.matchDetails),
          calcSquadSeries(userData?.squadPoints, userData?.matchesById),
          calcClassificationSeries(userData?.classificationTotal, userData?.leagueComplete),
          calcEliminatoriasSeries(userData?.eliminatoriasTeamDetails),
        ]);
      default:
        return emptySeries();
    }
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function getPlayerMeta(name) {
    return (AppState.players || []).find(p => p.name === name) || {};
  }

  const SOURCES = [
    { key: 'total', label: 'Total' },
    { key: 'pronosticos', label: 'Pronóst.' },
    { key: 'plantilla', label: 'Plantilla' },
    { key: 'clasificacion', label: 'Clasif.' },
    { key: 'eliminatorias', label: 'Eliminat.' },
  ];
  const SUBTABS = [
    { key: 'pronosticos', label: 'Pronósticos' },
    { key: 'evolucion', label: 'Evolución' },
    { key: 'individual', label: 'Individual' },
    { key: 'rachas', label: 'Rachas' },
    { key: 'plantillas', label: 'Plantillas' },
  ];
  const STATS_CONSISTENCY_SIGMA = 8;
  const DONUT_RADIUS = 42;
  const LINE_COLORS = ['var(--accent-primary)', 'var(--accent-purple)', 'var(--accent-gold)', 'var(--accent-cyan)', '#EC4899', '#F97316', '#22C55E', '#3B82F6'];
  let currentSeriesMap = null;

  function statsEmpty(message) {
    return `<div class="stats-empty">${esc(message)}</div>`;
  }

  function buildMatchesById() {
    const map = {};
    for (const m of AppState.matches || []) map[m.id] = m;
    return map;
  }

  function buildUserData(username, reachedPhases, matchesById) {
    const squad = AppState.squadsCache?.[username];
    const squadPoints = (squad && squad.length) ? calculateSquadPoints(squad, AppState.matchStats) : { playerDetails: [] };
    const fp = AppState.finalPredictionsCache?.[username];
    const elim = fp ? calculateEliminatoriasPoints(fp, reachedPhases) : { teamDetails: [] };
    return {
      matchDetails: AppState.userPoints[username]?.matchDetails || [],
      squadPoints,
      classificationTotal: calculateClassificationPoints(username).totalPoints,
      leagueComplete: isLeagueComplete(AppState.matches, AppState.matchStats),
      eliminatoriasTeamDetails: elim.teamDetails,
      matchesById,
    };
  }

  let _userDataCache = null;

  function getCachedUserData(username) {
    if (!_userDataCache) _userDataCache = new Map();
    if (!_userDataCache.has(username)) {
      _userDataCache.set(username, buildUserData(
        username,
        computeReachedPhases(AppState.matches, AppState.matchStats),
        buildMatchesById()
      ));
    }
    return _userDataCache.get(username);
  }

  let _porraAvgBySource = null;

  function getPorraAvgBySource() {
    if (_porraAvgBySource) return _porraAvgBySource;
    const keys = ['prediction', 'squad', 'classification', 'eliminatorias'];
    const totals = { prediction: 0, squad: 0, classification: 0, eliminatorias: 0 };
    const list = AppState.players || [];
    for (const p of list) {
      const s = sourceSplitFromUserData(AppState.userPoints[p.name]?.totalPoints, getCachedUserData(p.name));
      for (const k of keys) totals[k] += s[k] || 0;
    }
    const n = list.length || 1;
    _porraAvgBySource = {
      prediction: Math.round((totals.prediction / n) * 10) / 10,
      squad: Math.round((totals.squad / n) * 10) / 10,
      classification: Math.round((totals.classification / n) * 10) / 10,
      eliminatorias: Math.round((totals.eliminatorias / n) * 10) / 10,
    };
    return _porraAvgBySource;
  }

  function renderEstadisticasTab() {
    const container = document.getElementById('estadisticas-container');
    if (!container) return;

    if (isFasePretemporada()) {
      container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">Disponible al inicio de la competición</div>';
      return;
    }

    container.innerHTML = skeletonRows(4);
    Promise.all([fetchPlayers(), fetchMatchStats(), fetchAllPredictions()]).then(() => {
      if (!AppState.matchStats.length) {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">No hay resultados disponibles aún</div>';
        return;
      }
      for (const p of AppState.players || []) {
        AppState.userPoints[p.name] = calculateUserTotalPoints(p.name);
      }
      container.innerHTML = renderStatsContent();
      bindStatsEvents();
    }).catch(() => {
      container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">No hay resultados disponibles aún</div>';
    });
  }

  function buildSeriesMap(source, reachedPhases, matchesById) {
    const map = new Map();
    for (const p of AppState.players || []) {
      const r = getSeriesBySource(source, getCachedUserData(p.name));
      map.set(p.name, r);
    }
    return map;
  }

  function orderPlayers(seriesMap) {
    const players = [...(AppState.players || [])];
    const me = AppState.currentUser?.name;
    players.sort((a, b) => {
      if (a.name === me) return -1;
      if (b.name === me) return 1;
      return (seriesMap.get(b.name)?.series[12] || 0) - (seriesMap.get(a.name)?.series[12] || 0);
    });
    return players;
  }

  function initStatsState(seriesMap) {
    if (!AppState.estadisticasSubTab) AppState.estadisticasSubTab = 'pronosticos';
    if (!AppState.estadisticasPointType) AppState.estadisticasPointType = 'total';
    if (!AppState.estadisticasVisibleUsers) {
      const me = AppState.currentUser?.name;
      const top = orderPlayers(seriesMap).slice(0, 3).map(p => p.name);
      AppState.estadisticasVisibleUsers = new Set([me, ...top].filter(Boolean));
    }
  }

  function buildStatsAggregates() {
    const matchesById = buildMatchesById();
    const matchStatsById = {};
    for (const ms of AppState.matchStats || []) matchStatsById[ms.eventId] = ms;
    const playedMatches = extractPlayedMatches(AppState.matches, matchStatsById);
    const detailsByUser = {};
    for (const p of AppState.players || []) {
      detailsByUser[p.name] = AppState.userPoints[p.name]?.matchDetails || [];
    }
    const league = buildCompletedLeagueData(AppState.leagueMatches, matchStatsById, detailsByUser);
    const squadPointsByUser = {};
    for (const p of AppState.players || []) {
      const ud = getCachedUserData(p.name);
      squadPointsByUser[p.name] = ud.squadPoints?.playerDetails?.length ? ud.squadPoints : null;
    }
    const realPointsByUser = {};
    for (const p of AppState.players || []) {
      const s = sourceSplitFromUserData(AppState.userPoints[p.name]?.totalPoints, getCachedUserData(p.name));
      realPointsByUser[p.name] = s.prediction + s.squad + s.classification + s.eliminatorias;
    }
    return {
      reachedPhases: computeReachedPhases(AppState.matches, AppState.matchStats),
      matchesById,
      matchStatsById,
      playedMatches,
      completedRondas: league.completedRondas,
      streaks: calcStreaks(league.pointsByUserByJornada),
      positionHistory: calcPositionHistory(league.pointsByUserByJornada),
      timesTopJornada: calcTimesTopJornada(league.pointsByUserByJornada),
      realPointsByUser,
      bestJornadas: calcBestJornadas(league.pointsByUserByJornada, 5),
      championsTally: tallyChampions(AppState.finalPredictionsCache),
      quadro: compareQuadroWithCommunity(AppState.currentUser?.name, AppState.finalPredictionsCache),
      squadOwnership: aggregateSquads(squadPointsByUser, AppState.squadsCache),
    };
  }

  function renderStatsContent() {
    _userDataCache = null;
    _porraAvgBySource = null;
    const sub = AppState.estadisticasSubTab || 'pronosticos';
    const aggregates = buildStatsAggregates();

    const subBar = SUBTABS.map(s =>
      `<button class="stats-subtab ${s.key === sub ? 'active' : ''}" data-subtab="${s.key}">${s.label}</button>`
    ).join('');

    let body = '';
    if (sub === 'evolucion') body = renderEvolucionBody(aggregates);
    else if (sub === 'individual') body = renderIndividualBody(aggregates);
    else if (sub === 'rachas') body = renderRachasBody(aggregates);
    else if (sub === 'consenso') body = renderConsensoBody(aggregates);
    else body = renderPlantillasBody(aggregates);

    return `
      <div class="stats-card">
        <div class="stats-subtabs">${subBar}</div>
      </div>
      ${body}`;
  }

  function renderRachasBody(aggregates) {
    const streakEntries = Object.entries(aggregates.streaks || {})
      .filter(([, s]) => s)
      .sort((a, b) => b[1].len - a[1].len || b[1].lastPts - a[1].lastPts);
    const me = AppState.currentUser?.name;
    const streakHtml = streakEntries.length ? streakEntries.map(([u, s]) => `
      <div class="stats-rank-row ${u === me ? 'me' : ''}">
        <span class="stats-rank-pos rank-n">${esc(getPlayerMeta(u).avatar || '⚽')}</span>
        <span class="stats-rank-name">${esc(u)}</span>
        ${s.dir === 'up'
          ? `<span class="stats-badge-up">▲ ${s.len} mejorando</span>`
          : `<span class="stats-badge-dn">▼ ${s.len} empeorando</span>`}
      </div>`).join('') : '';

    const medals = ['🥇', '🥈', '🥉'];
    const bestHtml = (aggregates.bestJornadas || []).length ? aggregates.bestJornadas.map((b, i) => {
      const ronda = aggregates.completedRondas?.[b.jornadaIdx];
      const pos = i < 3 ? medals[i] : `<span class="stats-rank-pos rank-n">${i + 1}</span>`;
      return `
      <div class="stats-rank-row ${b.username === me ? 'me' : ''}">
        ${pos}
        <span class="stats-rank-name">${esc(getPlayerMeta(b.username).avatar || '⚽')} ${esc(b.username)} · J${ronda ?? b.jornadaIdx + 1}</span>
        <span class="stats-rank-main">+${b.pts} pts</span>
      </div>`;
    }).join('') : '';

    return `
      <div class="stats-card">
        <div class="stats-card-title">🔥 Rachas de jornada</div>
        ${streakHtml || statsEmpty('Aún no hay jornadas completadas')}
      </div>
      <div class="stats-card">
        <div class="stats-card-title">📈 Mejores jornadas históricas</div>
        ${bestHtml || statsEmpty('Aún no hay jornadas completadas')}
      </div>`;
  }

  function getDefaultConsensoRonda(matchStatsById) {
    let best = 0;
    for (const m of AppState.leagueMatches || []) {
      const home = matchStatsById?.[m.id]?.stats?.[m.homeTeamId]?.goles;
      const away = matchStatsById?.[m.id]?.stats?.[m.awayTeamId]?.goles;
      if (Number.isFinite(home) && Number.isFinite(away) && Number(m.ronda) > best) {
        best = Number(m.ronda);
      }
    }
    return best || 1;
  }

  function normalizeConsensoRonda(aggregates) {
    let r = Number(AppState.estadisticasConsensoRonda);
    if (!(r >= 1 && r <= 8)) r = getDefaultConsensoRonda(aggregates.matchStatsById);
    AppState.estadisticasConsensoRonda = r;
    return r;
  }

  function consensoBars(cons) {
    const defs = [['1', 'H', 'var(--accent-primary)'], ['X', 'D', 'var(--accent-gold)'], ['2', 'A', 'var(--accent-purple)']];
    return defs.map(([lbl, k, color]) => `
      <div class="stats-consbar">
        <span class="lbl">${lbl}</span>
        <div class="track"><div class="fill" style="width:${cons.pct[k]}%;background:${color}"></div></div>
        <b style="color:var(--text-primary)">${cons.pct[k]}%</b>
      </div>`).join('');
  }

  function consensoScoreGrid(cons, myPr) {
    const cells = cons.topScores.map(t => ({
      score: t.score, label: `${t.votes} voto${t.votes === 1 ? '' : 's'} · ${t.pct}%`,
      mine: !!myPr && t.score === `${myPr.home}-${myPr.away}`,
    }));
    if (myPr && Number.isFinite(myPr.home) && Number.isFinite(myPr.away)) {
      const myKey = `${myPr.home}-${myPr.away}`;
      if (!cells.some(c => c.mine)) cells.push({ score: myKey, label: 'tu marcador', mine: true });
    }
    if (!cells.length) return statsEmpty('Aún no hay pronósticos en este partido');
    return `<div class="stats-scoregrid">${cells.map(c => `
      <div class="stats-scorecell ${c.mine ? 'mine' : ''}">
        <div class="stats-sv">${esc(c.score)}</div>
        <div class="stats-sp">${esc(c.label)}</div>
      </div>`).join('')}</div>`;
  }

  function renderConsensoBody(aggregates) {
    const ronda = normalizeConsensoRonda(aggregates);
    const me = AppState.currentUser?.name;
    const matches = (AppState.leagueMatches || [])
      .filter(m => Number(m.ronda) === ronda)
      .sort((a, b) => (a.fechaTs || 0) - (b.fechaTs || 0));

    const cardsHtml = matches.map(m => {
      const cons = computeMatchConsensus(m.id, AppState.allPredictions);
      const myPr = AppState.allPredictions?.[me]?.[m.id];
      let pill = '';
      if (cons.majorityResult && myPr && Number.isFinite(myPr.home) && Number.isFinite(myPr.away)) {
        pill = matchResultOf(myPr.home, myPr.away) === cons.majorityResult
          ? '<span class="stats-pill cyan">con la mayoría</span>'
          : '<span class="stats-pill">⚖️ contra corriente</span>';
      }
      const ms = aggregates.matchStatsById?.[m.id];
      const rh = ms?.stats?.[m.homeTeamId]?.goles;
      const ra = ms?.stats?.[m.awayTeamId]?.goles;
      let realInfo = '';
      if (Number.isFinite(rh) && Number.isFinite(ra)) {
        const acertaron = cons.counts[matchResultOf(rh, ra)];
        realInfo = `<span class="stats-rank-sub">Real ${rh}-${ra} · ${acertaron}/${cons.total} acertaron</span>`;
      }
      const homeName = AppState.teamsMap?.[m.homeTeamId]?.name || m.homeTeam || '';
      const awayName = AppState.teamsMap?.[m.awayTeamId]?.name || m.awayTeam || '';
      return `
      <div class="stats-cons-card" data-match="${m.id}">
        <div class="stats-cons-head">
          <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(homeName)} – ${esc(awayName)}</span>
          ${pill}${realInfo}
        </div>
        ${consensoBars(cons)}
        <div class="stats-cons-extra">
          <div class="stats-card-title">Marcadores más votados</div>
          ${consensoScoreGrid(cons, myPr)}
        </div>
      </div>`;
    }).join('');

    const champ = aggregates.championsTally || { total: 0, teams: [] };
    const champHtml = champ.teams.length ? `
      <div class="stats-card">
        <div class="stats-card-title">👑 Campeón más votado (${champ.total} votos)</div>
        ${champ.teams.map(t => `
          <div class="stats-rank-row">
            <img class="stats-sq-img" src="data/imgEquipos/${t.teamId}.${AppState.teamsMap?.[t.teamId]?.ext || 'webp'}" alt="" onerror="this.style.visibility='hidden'">
            <span class="stats-rank-name">${esc(AppState.teamsMap?.[t.teamId]?.name || t.teamId)}</span>
            <span class="stats-rank-main">${t.votes}/${champ.total}</span>
          </div>`).join('')}
      </div>` : '';

    const q = aggregates.quadro || {};
    const quadroHtml = q.users ? `
      <div class="stats-card">
        <div class="stats-card-title">🧩 Tu cuadro vs la porra</div>
        <div class="stats-kpi-grid">
          <div class="stats-kpi"><div class="stats-kv">${q.avgPct}%</div><div class="stats-kl">coincidencia media</div></div>
          <div class="stats-kpi"><div class="stats-kv">${q.avgCommon}/24</div><div class="stats-kl">equipos en común</div></div>
          <div class="stats-kpi"><div class="stats-kv">${q.veryDiffCount}</div><div class="stats-kl">cuadros muy distintos (&ge;12)</div></div>
        </div>
      </div>` : '';

    return `
      <div class="stats-card">
        <div class="resultados-round-nav">
          <button class="resultados-round-btn" id="btn-stats-cons-prev" ${ronda <= 1 ? 'disabled' : ''}>◀</button>
          <span class="resultados-round-label">Jornada ${ronda}</span>
          <button class="resultados-round-btn" id="btn-stats-cons-next" ${ronda >= 8 ? 'disabled' : ''}>▶</button>
        </div>
        ${cardsHtml || statsEmpty('No hay partidos en esta jornada')}
      </div>
      ${champHtml}
      ${quadroHtml}`;
  }

  function squadPosLabel(pos) {
    return { G: 'Portero', D: 'Defensa', M: 'Centrocampista', F: 'Delantero' }[pos] || pos || '';
  }

  function squadPosEmoji(pos) {
    return { G: '🧤', D: '🛡️', M: '⚙️', F: '⚽' }[pos] || '⚽';
  }

  function renderPlantillasBody(aggregates) {
    const agg = aggregates.squadOwnership || { rows: [] };
    if (!agg.rows.length) return statsEmpty('Aún no hay plantillas guardadas');
    const top = agg.rows.slice(0, 25);
    const rowsHtml = top.map(r => {
      const badge = r.possessionPct >= 70
        ? '<span class="stats-pill gold">⭐ imprescindible</span>'
        : r.possessionPct <= 30
          ? '<span class="stats-pill cyan">🎯 diferencial</span>'
          : '';
      const ext = r.player.extension || 'webp';
      const img = `<img class="stats-sq-img" src="data/imgJugadores/${r.player.id}.${ext}" alt="" loading="lazy"
        onerror="this.outerHTML='<span class=&quot;stats-sq-img&quot; style=&quot;display:flex;align-items:center;justify-content:center&quot;>${squadPosEmoji(r.player.posicion)}</span>'">`;
      return `
      <div class="stats-squad-row">
        ${img}
        <div class="stats-sq-info">
          <div class="stats-sq-name">${esc(r.player.nombre || '')}</div>
          <div class="stats-sq-pos">${esc(squadPosLabel(r.player.posicion))} · ${r.ownerCount}/${agg.usersWithSquad} lo tienen</div>
        </div>
        ${badge}
        <span class="stats-sq-pts">${r.pts} pts</span>
      </div>`;
    }).join('');
    return `
      <div class="stats-card">
        <div class="stats-card-title">⭐ Jugadores estrella de las plantillas</div>
        ${rowsHtml}
        <div class="stats-rank-sub">Top 25 de ${agg.uniquePlayers} jugadores únicos · posesión sobre ${agg.usersWithSquad} usuarios con plantilla</div>
      </div>`;
  }

  function renderEvolucionBody(aggregates) {
    const source = AppState.estadisticasPointType || 'total';
    const seriesMap = buildSeriesMap(source, aggregates.reachedPhases, aggregates.matchesById);
    currentSeriesMap = seriesMap;
    initStatsState(seriesMap);
    const visibleSet = AppState.estadisticasVisibleUsers;
    const players = orderPlayers(seriesMap);

    const segButtons = SOURCES.map(s =>
      `<button class="stats-source ${s.key === source ? 'active' : ''}" data-source="${s.key}">${s.label}</button>`
    ).join('');

    const chips = players.map(p => {
      const on = visibleSet.has(p.name);
      return `<button class="stats-chip ${on ? 'active' : 'off'}" data-user="${esc(p.name)}">${esc(p.avatar || '⚽')} ${esc(p.name)}</button>`;
    }).join('');

    return `
      <div class="stats-card">
        <div class="stats-source-seg">${segButtons}</div>
      </div>
      <div class="stats-card">
        <div class="stats-chips-header">
          <span class="stats-chips-counter">Jugadores: ${visibleSet.size} visibles de ${players.length}</span>
          <button class="stats-chips-action" data-action="todos">Todos</button>
          <button class="stats-chips-action" data-action="nadie">Nadie</button>
        </div>
        <div class="stats-card-title">Evolución de puntos por jornada</div>
        <div class="stats-chips-row">${chips}</div>
        ${buildLineChart(players, visibleSet, seriesMap)}
        ${buildLegend(players, visibleSet, seriesMap)}
      </div>`;
  }

  function playersWithData(players, visibleSet, seriesMap) {
    return players.filter(p => visibleSet.has(p.name) && seriesMap.get(p.name)?.hasData);
  }

  function buildLineChart(players, visibleSet, seriesMap) {
    const visible = playersWithData(players, visibleSet, seriesMap);
    if (!visible.length) return statsEmpty('Añade jugadores para ver el gráfico');

    const W = 320, H = 170, PAD = 26;
    const x = (p) => PAD + (p / 12) * (W - PAD * 2);
    let maxVal = 10;
    for (const p of visible) {
      maxVal = Math.max(maxVal, ...seriesMap.get(p.name).series);
    }
    const y = (v) => H - PAD - (v / maxVal) * (H - PAD * 2);

    const polylines = visible.map((p, i) => {
      const color = LINE_COLORS[i % LINE_COLORS.length];
      const series = seriesMap.get(p.name).series;
      const pts = series.map((v, pi) => `${x(pi).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      const last = series.length - 1;
      const lx = x(last), ly = y(series[last]);
      return `
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${lx}" cy="${ly}" r="4" fill="${color}" stroke="#0F172A" stroke-width="1.5" class="stats-lastpoint" data-user="${esc(p.name)}"/>
        <circle cx="${lx}" cy="${ly}" r="10" fill="transparent" class="stats-lastpoint" data-user="${esc(p.name)}"/>`;
    }).join('');

    const grid = [0, 0.5, 1].map(f => y(maxVal * f));
    const gridLines = grid.map((gy, gi) =>
      `<line x1="${PAD}" y1="${gy}" x2="${W - PAD}" y2="${gy}" stroke="${gi === 0 ? '#334155' : '#1E293B'}" stroke-width="1"/>`
    ).join('');

    const labels = buildTimeline().map(t =>
      `<text x="${x(t.point)}" y="${H - 6}" font-size="7.5" fill="#64748B" text-anchor="middle">${t.label}</text>`
    ).join('');

    return `
      <svg class="stats-line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
        ${gridLines}
        ${polylines}
        ${labels}
      </svg>`;
  }

  function buildLegend(players, visibleSet, seriesMap) {
    const visible = playersWithData(players, visibleSet, seriesMap);
    const items = visible.map((p, i) => {
      const r = seriesMap.get(p.name);
      return `<span><i style="background:${LINE_COLORS[i % LINE_COLORS.length]}"></i>${esc(p.name)} · ${r.series[12] || 0}</span>`;
    }).join('');
    return `<div class="stats-legend">${items || statsEmpty('Añade jugadores para ver la leyenda')}</div>`;
  }

  function jornadaPtsDeUsuario(aggregates, username) {
    const rondas = aggregates.completedRondas || [];
    const details = AppState.userPoints[username]?.matchDetails || [];
    return rondas.map(r => (details || [])
      .filter(d => d.match && d.match.fase === 'liga' && Number(d.match.ronda) === Number(r))
      .reduce((a, d) => a + (d.points || 0), 0));
  }

  function resolveIndividualUsername(players) {
    const list = players || [];
    const wanted = AppState.estadisticasIndividualUser || AppState.currentUser?.name;
    if (list.some(p => p.name === wanted)) return wanted;
    const me = AppState.currentUser?.name;
    if (list.some(p => p.name === me)) return me;
    return list[0]?.name || null;
  }

  function individualOverallRank(realPointsByUser, username) {
    const mine = realPointsByUser?.[username] || 0;
    let rank = 1;
    for (const u of Object.keys(realPointsByUser || {})) {
      if ((realPointsByUser[u] || 0) > mine) rank++;
    }
    return rank;
  }

  function donutChartHtml(split) {
    const defs = [
      { key: 'prediction', label: 'Pronósticos', color: '#8B5CF6' },
      { key: 'squad', label: 'Plantilla', color: '#10B981' },
      { key: 'classification', label: 'Clasificación', color: '#22D3EE' },
      { key: 'eliminatorias', label: 'Eliminatorias', color: '#F59E0B' },
    ];
    const parts = defs.map(d => ({ ...d, value: split[d.key] || 0 }));
    const segs = buildDonutSegments(parts);
    if (!segs.length) return statsEmpty('Sin puntos todavía');
    const total = parts.reduce((a, p) => a + p.value, 0);
    const circles = segs.map(s =>
      `<circle cx="60" cy="60" r="${DONUT_RADIUS}" fill="none" stroke="${s.color}" stroke-width="18" stroke-dasharray="${s.dasharray}" stroke-dashoffset="${s.dashoffset}" transform="rotate(-90 60 60)"/>`
    ).join('');
    const legend = segs.map(s =>
      `<span class="stats-donut-chip" style="background:${s.color}22;color:${s.color}"><i style="background:${s.color}"></i>${esc(s.label)} ${s.value} · ${s.pct}%</span>`
    ).join('');
    return `
      <svg class="stats-donut" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="${DONUT_RADIUS}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="18"/>
        ${circles}
        <text x="60" y="57" text-anchor="middle" class="stats-donut-total">${total}</text>
        <text x="60" y="72" text-anchor="middle" class="stats-donut-sub">puntos totales</text>
      </svg>
      <div class="stats-donut-legend">${legend}</div>`;
  }

  function comparativaHtml(split) {
    const avg = getPorraAvgBySource();
    const defs = [
      ['prediction', 'Pronóst.'],
      ['squad', 'Plantilla'],
      ['classification', 'Clasif.'],
      ['eliminatorias', 'Elims.'],
    ];
    return `<div class="stats-cmp-row">vs media de la porra: ` + defs.map(([k, lbl]) => {
      const delta = Math.round(((split[k] || 0) - (avg[k] || 0)) * 10) / 10;
      const cls = delta > 0 ? 'up' : delta < 0 ? 'dn' : '';
      const sign = delta > 0 ? '+' : '';
      return `<span class="stats-cmp-chip ${cls}">${lbl} ${sign}${delta}</span>`;
    }).join('') + '</div>';
  }

  function momentumKpiHtml(m) {
    if (!m) return '<div class="stats-kpi"><div class="stats-kv">—</div><div class="stats-kl">momentum</div></div>';
    if (m.delta >= 2) return `<div class="stats-kpi"><div class="stats-kv">▲ ${m.delta}</div><div class="stats-kl">en forma</div></div>`;
    if (m.delta <= -2) return `<div class="stats-kpi"><div class="stats-kv">▼ ${m.delta}</div><div class="stats-kl">bajón</div></div>`;
    return '<div class="stats-kpi"><div class="stats-kv">→</div><div class="stats-kl">estable</div></div>';
  }

  function consistencyKpiHtml(sigma) {
    if (sigma === null) return '<div class="stats-kpi"><div class="stats-kv">—</div><div class="stats-kl">consistencia</div></div>';
    const lbl = sigma <= STATS_CONSISTENCY_SIGMA ? 'regular' : 'montaña rusa';
    return `<div class="stats-kpi"><div class="stats-kv">${sigma}</div><div class="stats-kl">${lbl}</div></div>`;
  }

  function renderIndividualBody(aggregates) {
    const players = AppState.players || [];
    const username = resolveIndividualUsername(players);
    if (!username) return statsEmpty('Sin usuarios disponibles');

    const options = players.map(p =>
      `<option value="${esc(p.name)}" ${p.name === username ? 'selected' : ''}>${esc(p.avatar || '⚽')} ${esc(p.name)}</option>`
    ).join('');

    const rank = individualOverallRank(aggregates.realPointsByUser, username);

    const split = sourceSplitFromUserData(AppState.userPoints[username]?.totalPoints, getCachedUserData(username));

    const row = calcReliabilityRow(username, aggregates.playedMatches, AppState.allPredictions, AppState.userPoints);
    const fallidos = row.played - row.hits;
    const conversion = row.hits ? Math.round((row.exactScores / row.hits) * 100) : null;
    const bestMatch = calcBestMatch(AppState.userPoints[username]?.matchDetails);
    let bestMatchLbl = '—';
    if (bestMatch) {
      const m = aggregates.matchesById?.[bestMatch.matchId];
      bestMatchLbl = `${bestMatch.points} pts${m ? ` (${esc(m.homeTeam || '')} – ${esc(m.awayTeam || '')})` : ''}`;
    }
    const pronosticosCard = `
      <div class="stats-card">
        <div class="stats-card-title">⚽ Pronósticos (${row.played} partidos jugados)</div>
        ${row.played ? `
        <div class="stats-kpi-grid">
          <div class="stats-kpi"><div class="stats-kv">${row.hits}</div><div class="stats-kl">1X2 ✔</div></div>
          <div class="stats-kpi"><div class="stats-kv">${row.exactScores}</div><div class="stats-kl">exactos</div></div>
          <div class="stats-kpi"><div class="stats-kv">${fallidos}</div><div class="stats-kl">fallidos</div></div>
        </div>
        <div class="stats-rank-sub">% conversión de exactos: ${conversion === null ? '—' : conversion + '%'} · Mejor partido: ${bestMatchLbl}</div>` : statsEmpty('Sin partidos pronosticados con resultado')}
      </div>`;

    const rondas = aggregates.completedRondas || [];
    const hist = aggregates.positionHistory?.[username] || [];
    const tops = aggregates.timesTopJornada?.[username] || 0;
    const userJornadaPts = jornadaPtsDeUsuario(aggregates, username);
    const bestJ = calcUserBestJornada(userJornadaPts);
    const mediaJ = rondas.length ? Math.round(((split.prediction || 0) / rondas.length) * 10) / 10 : null;
    const jornadasInner = rondas.length ? `
      <div class="stats-kpi-grid" style="grid-template-columns:repeat(2,1fr)">
        <div class="stats-kpi"><div class="stats-kv">${bestJ ? `J${rondas[bestJ.idx] ?? bestJ.idx + 1} · ${bestJ.pts}` : '—'}</div><div class="stats-kl">mejor jornada</div></div>
        <div class="stats-kpi"><div class="stats-kv">${mediaJ ?? '—'}</div><div class="stats-kl">media/jornada</div></div>
        <div class="stats-kpi"><div class="stats-kv">${tops}</div><div class="stats-kl">veces mejor</div></div>
        <div class="stats-kpi"><div class="stats-kv">${hist.length ? `${Math.min(...hist)}º / ${Math.max(...hist)}º` : '—'}</div><div class="stats-kl">mejor/peor puesto</div></div>
      </div>
      <div class="stats-kpi-grid" style="margin-top:6px">
        ${momentumKpiHtml(calcMomentum(userJornadaPts))}
        ${consistencyKpiHtml(calcConsistency(userJornadaPts))}
        <div class="stats-kpi"><div class="stats-kv">${rondas.length}</div><div class="stats-kl">jornadas completas</div></div>
      </div>` : statsEmpty('Aún no hay jornadas completadas');
    const jornadasCard = `
      <div class="stats-card">
        <div class="stats-card-title">📅 Jornadas</div>
        ${jornadasInner}
      </div>`;

    const bias = calcPredictionBias(AppState.allPredictions?.[username], aggregates.playedMatches);
    const biasDefs = [['1', 'H'], ['X', 'D'], ['2', 'A']];
    const biasRows = biasDefs.map(([lbl, k]) => {
      const pct = bias[k].pred ? Math.round((bias[k].hits / bias[k].pred) * 100) : null;
      return `<div class="stats-consbar"><span class="lbl">${lbl}</span><div class="track"><div class="fill" style="width:${bias[k].pred ? pct : 0}%;background:var(--accent-primary)"></div></div><b style="color:var(--text-primary)">${bias[k].pred ? `${bias[k].hits}/${bias[k].pred} · ${pct}%` : '—'}</b></div>`;
    }).join('');
    const sesgoCard = `
      <div class="stats-card">
        <div class="stats-card-title">🎯 Sesgo 1/X/2 (pronosticado y acierto)</div>
        ${row.played ? biasRows : statsEmpty('Sin partidos pronosticados con resultado')}
      </div>`;

    const ud = getCachedUserData(username);
    const playerDetails = ud.squadPoints?.playerDetails || [];
    let plantillaCard;
    if (!playerDetails.length) {
      plantillaCard = `
      <div class="stats-card">
        <div class="stats-card-title">👥 Plantilla ideal</div>
        ${statsEmpty('Sin plantilla guardada')}
      </div>`;
    } else {
      const best = calcBestPlayersByPosition(playerDetails);
      const rentable = calcMostProfitablePlayer(playerDetails);
      const posRow = (posKey, lbl) => {
        const b = best[posKey];
        if (!b) return '';
        const ext = b.jugador.extension || 'webp';
        const img = `<img class="stats-sq-img" src="data/imgJugadores/${b.jugador.id}.${ext}" alt="" loading="lazy"
          onerror="this.outerHTML='<span class=&quot;stats-sq-img&quot; style=&quot;display:flex;align-items:center;justify-content:center&quot;>${squadPosEmoji(posKey)}</span>'">`;
        return `
        <div class="stats-squad-row">
          ${img}
          <div class="stats-sq-info">
            <div class="stats-sq-name">${esc(b.jugador.nombre || '')}</div>
            <div class="stats-sq-pos">Mejor ${esc(lbl)}</div>
          </div>
          <span class="stats-sq-pts">${b.puntosTotal} pts</span>
        </div>`;
      };
      const topRow = best.top ? `
        <div class="stats-squad-row" style="outline:1px solid var(--accent-gold)">
          <span class="stats-sq-img" style="display:flex;align-items:center;justify-content:center">⭐</span>
          <div class="stats-sq-info">
            <div class="stats-sq-name">${esc(best.top.jugador.nombre || '')}</div>
            <div class="stats-sq-pos">Mejor jugador</div>
          </div>
          <span class="stats-sq-pts">${best.top.puntosTotal} pts</span>
        </div>` : '';
      const rentableRow = rentable ? `
        <div class="stats-squad-row">
          <span class="stats-sq-img" style="display:flex;align-items:center;justify-content:center">💎</span>
          <div class="stats-sq-info">
            <div class="stats-sq-name">${esc(rentable.jugador.nombre || '')}</div>
            <div class="stats-sq-pos">Más rentable · ${rentable.partidos} partido${rentable.partidos === 1 ? '' : 's'}</div>
          </div>
          <span class="stats-sq-pts">${rentable.ptsPorPartido} pts/part</span>
        </div>` : '';
      plantillaCard = `
      <div class="stats-card">
        <div class="stats-card-title">👥 Plantilla ideal — mejores por demarcación</div>
        ${posRow('G', 'POR')}${posRow('D', 'DEF')}${posRow('M', 'MED')}${posRow('F', 'DEL')}
        ${topRow}
        ${rentableRow}
      </div>`;
    }

    return `
      <div class="stats-card">
        <div style="display:flex;align-items:center;gap:10px">
          <select id="stats-ind-select" class="stats-ind-select" aria-label="Seleccionar usuario">${options}</select>
          <span class="stats-rank-main">#${rank}</span>
        </div>
      </div>
      <div class="stats-card">
        <div class="stats-card-title">🥧 Desglose de puntos</div>
        ${donutChartHtml(split)}
        ${comparativaHtml(split)}
      </div>
      ${pronosticosCard}
      ${jornadasCard}
      ${sesgoCard}
      ${plantillaCard}`;
  }

  function bindStatsEvents() {
    const container = document.getElementById('estadisticas-container');
    if (!container) return;

    container.querySelectorAll('.stats-subtab').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasSubTab = btn.dataset.subtab;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-source').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasPointType = btn.dataset.source;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const user = btn.dataset.user;
        const set = AppState.estadisticasVisibleUsers;
        if (set.has(user)) set.delete(user); else set.add(user);
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-chips-action').forEach(btn => {
      btn.addEventListener('click', () => {
        const set = AppState.estadisticasVisibleUsers;
        if (btn.dataset.action === 'todos') {
          (AppState.players || []).forEach(p => set.add(p.name));
        } else {
          set.clear();
        }
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-lastpoint').forEach(circle => {
      circle.addEventListener('click', () => {
        const user = circle.dataset.user;
        const r = currentSeriesMap?.get(user) || emptySeries();
        const tl = buildTimeline();
        const lastIdx = 12;
        showToast(`${esc(user)} · ${r.series[lastIdx]} pts (${tl[lastIdx].label})`);
      });
    });

    container.querySelectorAll('.stats-cons-card').forEach(card => {
      card.addEventListener('click', () => card.classList.toggle('open'));
    });

    container.querySelectorAll('.stats-ind-select').forEach(sel => {
      sel.addEventListener('change', () => {
        AppState.estadisticasIndividualUser = sel.value;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    const prevBtn = container.querySelector('#btn-stats-cons-prev');
    const nextBtn = container.querySelector('#btn-stats-cons-next');
    if (prevBtn) prevBtn.addEventListener('click', () => {
      AppState.estadisticasConsensoRonda = Math.max(1, (AppState.estadisticasConsensoRonda || 1) - 1);
      container.innerHTML = renderStatsContent();
      bindStatsEvents();
    });
    if (nextBtn) nextBtn.addEventListener('click', () => {
      AppState.estadisticasConsensoRonda = Math.min(8, (AppState.estadisticasConsensoRonda || 1) + 1);
      container.innerHTML = renderStatsContent();
      bindStatsEvents();
    });
  }

  global.renderEstadisticasTab = renderEstadisticasTab;
  global.emptySeries = emptySeries;
  global.buildTimeline = buildTimeline;
  global.calcPredictionSeries = calcPredictionSeries;
  global.calcSquadSeries = calcSquadSeries;
  global.calcClassificationSeries = calcClassificationSeries;
  global.calcEliminatoriasSeries = calcEliminatoriasSeries;
  global.sumSeries = sumSeries;
  global.isLeagueComplete = isLeagueComplete;
  global.getSeriesBySource = getSeriesBySource;
  global.matchResultOf = matchResultOf;
  global.extractPlayedMatches = extractPlayedMatches;
  global.calcReliabilityRow = calcReliabilityRow;
  global.buildCompletedLeagueData = buildCompletedLeagueData;
  global.calcStreaks = calcStreaks;
  global.calcBestJornadas = calcBestJornadas;
  global.calcUserBestJornada = calcUserBestJornada;
  global.calcPositionHistory = calcPositionHistory;
  global.calcTimesTopJornada = calcTimesTopJornada;
  global.calcMomentum = calcMomentum;
  global.calcConsistency = calcConsistency;
  global.buildDonutSegments = buildDonutSegments;
  global.calcPredictionBias = calcPredictionBias;
  global.calcBestMatch = calcBestMatch;
  global.calcBestPlayersByPosition = calcBestPlayersByPosition;
  global.calcMostProfitablePlayer = calcMostProfitablePlayer;
  global.sourceSplitFromUserData = sourceSplitFromUserData;
  global.computeMatchConsensus = computeMatchConsensus;
  global.tallyChampions = tallyChampions;
  global.finalPredictionTeamIds = finalPredictionTeamIds;
  global.compareQuadroWithCommunity = compareQuadroWithCommunity;
  global.aggregateSquads = aggregateSquads;
  global.calcPronosticosPartidosStats = calcPronosticosPartidosStats;
  global.getTeamStatsForPreds = getTeamStatsForPreds;
  global.calcPredictedStandingsForPreds = calcPredictedStandingsForPreds;
  global.calcClasificacionPronosticosStats = calcClasificacionPronosticosStats;
  global.calcEliminatoriasPronosticosStats = calcEliminatoriasPronosticosStats;
  global.calcPlantillaPronosticosExtras = calcPlantillaPronosticosExtras;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { emptySeries, buildTimeline, calcPredictionSeries, calcSquadSeries, calcClassificationSeries, calcEliminatoriasSeries, sumSeries, isLeagueComplete, getSeriesBySource, matchResultOf, extractPlayedMatches, calcReliabilityRow, buildCompletedLeagueData, calcStreaks, calcBestJornadas, calcUserBestJornada, calcPositionHistory, calcTimesTopJornada, calcMomentum, calcConsistency, buildDonutSegments, calcPredictionBias, calcBestMatch, calcBestPlayersByPosition, calcMostProfitablePlayer, sourceSplitFromUserData, computeMatchConsensus, tallyChampions, finalPredictionTeamIds, compareQuadroWithCommunity, aggregateSquads, calcPronosticosPartidosStats, getTeamStatsForPreds, calcPredictedStandingsForPreds, calcClasificacionPronosticosStats, calcEliminatoriasPronosticosStats, calcPlantillaPronosticosExtras };
  }
})(typeof window !== 'undefined' ? window : globalThis);
