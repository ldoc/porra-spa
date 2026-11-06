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

  function toStagePoints(series) {
    const src = series || [];
    const out = Array(13).fill(0);
    let prev = 0;
    for (let p = 0; p < src.length && p < 13; p++) {
      const cur = src[p] || 0;
      out[p] = cur - prev;
      prev = cur;
    }
    return out;
  }

  function calcEvolutionPositions(totalSeriesMap) {
    const map = totalSeriesMap || new Map();
    const names = [...map.keys()];
    const out = new Map();
    for (const name of names) {
      out.set(name, { series: Array(13).fill(1), hasData: !!map.get(name)?.hasData });
    }
    for (let p = 0; p < 13; p++) {
      const totals = names.map(name => ({ name, total: map.get(name)?.series?.[p] || 0 }));
      for (const item of totals) {
        let rank = 1;
        for (const other of totals) if (other.total > item.total) rank++;
        out.get(item.name).series[p] = rank;
      }
    }
    return out;
  }

  function calcEvolutionPositionsFromSplits(splitMaps) {
    const maps = splitMaps || {};
    const prediction = maps.prediction || new Map();
    const squad = maps.squad || new Map();
    const classification = maps.classification || new Map();
    const eliminatorias = maps.eliminatorias || new Map();
    const names = new Set([
      ...prediction.keys(),
      ...squad.keys(),
      ...classification.keys(),
      ...eliminatorias.keys(),
    ]);
    const out = new Map();
    for (const name of names) {
      const hasData = [prediction, squad, classification, eliminatorias].some(m => m.get(name)?.hasData);
      out.set(name, { series: Array(13).fill(1), hasData });
    }
    for (let p = 0; p < 13; p++) {
      const rows = [...names].map(name => {
        const pred = prediction.get(name)?.series?.[p] || 0;
        const sq = squad.get(name)?.series?.[p] || 0;
        const cls = classification.get(name)?.series?.[p] || 0;
        const elim = eliminatorias.get(name)?.series?.[p] || 0;
        return {
          name,
          realPoints: pred + sq + cls + elim,
          eliminatoriasPoints: elim,
          squadPoints: sq,
          classificationPoints: cls,
          predictionPoints: pred,
        };
      });
      for (const row of rows) {
        let rank = 1;
        for (const other of rows) if (compareIndividualRows(other, row) < 0) rank++;
        out.get(row.name).series[p] = rank;
      }
    }
    return out;
  }

  function lastTimelinePoint(matches, matchStatsById) {
    let last = 0;
    for (const m of matches || []) {
      const ms = matchStatsById?.[m.id];
      const home = ms?.stats?.[m.homeTeamId]?.goles;
      const away = ms?.stats?.[m.awayTeamId]?.goles;
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      const pos = positionForMatch(m);
      if (pos !== null && pos > last) last = pos;
    }
    return last;
  }

  function trimTimeline(timeline, lastPoint) {
    const tl = timeline || [];
    const limit = Number.isInteger(lastPoint) ? lastPoint : tl.length - 1;
    return tl.filter(t => t.point <= limit);
  }

  function buildEvolutionSeriesMap(metric, mode, sourceSeriesMap, totalSeriesMap) {
    if (metric === 'posicion') return calcEvolutionPositions(totalSeriesMap);
    const out = new Map();
    for (const [name, result] of sourceSeriesMap || []) {
      const series = mode === 'jornada' ? toStagePoints(result.series) : (result.series || []).slice();
      out.set(name, { series, hasData: !!result.hasData });
    }
    return out;
  }

  function buildAxisTicks(metric, maxVal, minVal) {
    const max = Math.max(1, Math.round(maxVal || 1));
    if (metric === 'posicion') {
      const mid = Math.round((1 + max) / 2);
      return [...new Set([1, mid, max])].map(value => ({ value, label: `#${value}` }));
    }
    const min = Math.min(0, Math.round(minVal || 0));
    const top = Math.max(min + 1, max);
    const mid = Math.round((min + top) / 2);
    return [...new Set([min, mid, top])].map(value => ({ value, label: String(value) }));
  }

  function formatPointValue(metric, value) {
    return metric === 'posicion' ? `#${value}` : `${value} pts`;
  }

  function buildPointTooltipText(playerName, stageLabel, metric, value) {
    return `${playerName} · ${stageLabel} · ${formatPointValue(metric, value)}`;
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

  function buildCompletedLeagueData(leagueMatches, matchStatsById, matchDetailsByUser, squadPointsByUser) {
    const totalByRonda = new Map();
    const doneByRonda = new Map();
    const rondaByMatchId = new Map();
    for (const m of leagueMatches || []) {
      const r = Number(m.ronda);
      if (!(r >= 1 && r <= 8)) continue;
      rondaByMatchId.set(String(m.id), r);
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
    const usernames = new Set([
      ...Object.keys(matchDetailsByUser || {}),
      ...Object.keys(squadPointsByUser || {}),
    ]);
    for (const username of usernames) {
      const arr = completedRondas.map(() => 0);
      for (const d of matchDetailsByUser?.[username] || []) {
        const m = d.match;
        if (!m || m.fase !== 'liga') continue;
        const idx = idxByRonda.get(Number(m.ronda));
        if (idx === undefined) continue;
        arr[idx] += d.points || 0;
      }
      for (const pd of squadPointsByUser?.[username]?.playerDetails || []) {
        for (const partido of pd.partidos || []) {
          const ronda = rondaByMatchId.get(String(partido.eventId));
          if (ronda === undefined) continue;
          const idx = idxByRonda.get(ronda);
          if (idx === undefined) continue;
          arr[idx] += partido.puntos || 0;
        }
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

  function calcExactStats(username, leagueMatches, matchStatsById, allPredictions) {
    const preds = allPredictions?.[username] || {};
    const byRonda = new Map();
    const played = [];
    const totals = { played: 0, exact: 0, outcomeHits: 0, exactPct: 0 };

    for (const m of leagueMatches || []) {
      if (!m || m.fase !== 'liga') continue;
      const ronda = Number(m.ronda);
      if (!Number.isInteger(ronda) || ronda < 1) continue;
      const ms = matchStatsById?.[m.id];
      const home = ms?.stats?.[m.homeTeamId]?.goles;
      const away = ms?.stats?.[m.awayTeamId]?.goles;
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      const pr = preds[m.id];
      if (!pr || !Number.isFinite(pr.home) || !Number.isFinite(pr.away)) continue;

      const isExact = pr.home === home && pr.away === away;
      const isHit = matchResultOf(pr.home, pr.away) === matchResultOf(home, away);

      totals.played++;
      if (isExact) totals.exact++;
      if (isHit) totals.outcomeHits++;

      if (!byRonda.has(ronda)) {
        byRonda.set(ronda, { ronda, played: 0, exact: 0, outcomeHits: 0, complete: false });
      }
      const row = byRonda.get(ronda);
      row.played++;
      if (isExact) row.exact++;
      if (isHit) row.outcomeHits++;

      played.push({
        ronda,
        matchId: m.id,
        fechaTs: Number(m.fechaTs) || 0,
        isExact,
      });
    }

    const statsByRonda = new Map();
    for (const m of leagueMatches || []) {
      if (!m || m.fase !== 'liga') continue;
      const ronda = Number(m.ronda);
      if (!Number.isInteger(ronda)) continue;
      if (!statsByRonda.has(ronda)) statsByRonda.set(ronda, { total: 0, done: 0 });
      const entry = statsByRonda.get(ronda);
      entry.total++;
      const ms = matchStatsById?.[m.id];
      const home = ms?.stats?.[m.homeTeamId]?.goles;
      const away = ms?.stats?.[m.awayTeamId]?.goles;
      if (Number.isFinite(home) && Number.isFinite(away)) entry.done++;
    }
    for (const row of byRonda.values()) {
      const entry = statsByRonda.get(row.ronda);
      row.complete = !!entry && entry.done === entry.total;
    }

    const chrono = played.slice().sort((a, b) =>
      a.ronda - b.ronda
      || a.fechaTs - b.fechaTs
      || (Number(a.matchId) || 0) - (Number(b.matchId) || 0));
    let bestExact = 0;
    let currentExact = 0;
    for (const item of chrono) {
      if (item.isExact) {
        currentExact++;
        if (currentExact > bestExact) bestExact = currentExact;
      } else {
        currentExact = 0;
      }
    }

    totals.exactPct = totals.played ? Math.round((totals.exact / totals.played) * 100) : 0;

    return {
      byJornada: [...byRonda.values()]
        .filter(row => row.played > 0)
        .sort((a, b) => a.ronda - b.ronda),
      totals,
      streaks: { currentExact, bestExact },
    };
  }

  function calcSourceRanks(splitByUser, playerNames) {
    const names = (playerNames || []).slice();
    const n = names.length;
    const sources = [
      {
        key: 'total',
        get: (name) => {
          const s = splitByUser?.[name] || {};
          return (s.prediction || 0) + (s.squad || 0) + (s.classification || 0) + (s.eliminatorias || 0);
        },
      },
      { key: 'prediction', get: (name) => splitByUser?.[name]?.prediction || 0 },
      { key: 'squad', get: (name) => splitByUser?.[name]?.squad || 0 },
      { key: 'classification', get: (name) => splitByUser?.[name]?.classification || 0 },
      { key: 'eliminatorias', get: (name) => splitByUser?.[name]?.eliminatorias || 0 },
    ];

    const out = {};
    for (const name of names) out[name] = {};

    for (const source of sources) {
      const values = names.map(name => source.get(name));
      const hasData = values.some(value => value !== 0);
      if (!hasData) {
        for (const name of names) {
          out[name][source.key] = {
            value: source.get(name),
            rank: null,
            n,
            topPct: null,
            hasData: false,
          };
        }
        continue;
      }

      for (const name of names) {
        const mine = source.get(name);
        let rank = 1;
        for (const other of names) {
          if (other === name) continue;
          const otherValue = source.get(other);
          if (source.key === 'total') {
            if (compareIndividualRows(toClasificacionRow(splitByUser?.[other]), toClasificacionRow(splitByUser?.[name])) < 0) rank++;
          } else if (otherValue > mine) {
            rank++;
          }
        }
        out[name][source.key] = {
          value: mine,
          rank,
          n,
          topPct: n ? Math.max(1, Math.round((rank / n) * 100)) : null,
          hasData: true,
        };
      }
    }

    return out;
  }

  function calcMatchExtremes(username, playedMatches, allPredictions, userPoints, matchesById) {
    const pointsByUser = new Map();
    for (const name of Object.keys(allPredictions || {})) {
      const byMatch = new Map();
      for (const detail of userPoints?.[name]?.matchDetails || []) {
        if (detail?.match?.id != null) byMatch.set(detail.match.id, detail.points || 0);
      }
      pointsByUser.set(name, byMatch);
    }

    const myPreds = allPredictions?.[username] || {};
    const candidates = [];

    for (const pm of playedMatches || []) {
      const pr = myPreds[pm.matchId];
      if (!pr || !Number.isFinite(pr.home) || !Number.isFinite(pr.away)) continue;

      const match = matchesById?.[pm.matchId] || null;
      if (match && match.fase && match.fase !== 'liga') continue;

      const points = pointsByUser.get(username)?.get(pm.matchId) || 0;
      let sum = 0;
      let sample = 0;
      for (const [name, byMatch] of pointsByUser) {
        const otherPred = allPredictions?.[name]?.[pm.matchId];
        if (!otherPred || !Number.isFinite(otherPred.home) || !Number.isFinite(otherPred.away)) continue;
        sum += byMatch.get(pm.matchId) || 0;
        sample++;
      }
      const avg = sample ? Math.round((sum / sample) * 10) / 10 : 0;
      candidates.push({
        matchId: pm.matchId,
        match,
        points,
        avg,
        sample,
        delta: Math.round((points - avg) * 10) / 10,
        fechaTs: Number(match?.fechaTs) || 0,
      });
    }

    if (!candidates.length) return { best: null, worst: null };

    const older = (a, b) =>
      a.fechaTs - b.fechaTs
      || (Number(a.matchId) || 0) - (Number(b.matchId) || 0);

    const best = candidates.reduce((acc, item) => {
      if (!acc) return item;
      if (item.points > acc.points) return item;
      if (item.points === acc.points && older(item, acc) < 0) return item;
      return acc;
    }, null);

    const worst = candidates.reduce((acc, item) => {
      if (!acc) return item;
      if (item.points < acc.points) return item;
      if (item.points === acc.points && older(item, acc) < 0) return item;
      return acc;
    }, null);

    return { best, worst };
  }

  function calcDataCoverage(matches, matchStats, allPredictions, username) {
    const matchStatsById = {};
    for (const ms of matchStats || []) matchStatsById[ms.eventId] = ms;

    const league = (matches || []).filter(m => m && m.fase === 'liga');
    const totalByRonda = new Map();
    const doneByRonda = new Map();
    let playedLeague = 0;

    for (const m of league) {
      const ronda = Number(m.ronda);
      if (!Number.isFinite(ronda)) continue;
      totalByRonda.set(ronda, (totalByRonda.get(ronda) || 0) + 1);
      const home = matchStatsById[m.id]?.stats?.[m.homeTeamId]?.goles;
      const away = matchStatsById[m.id]?.stats?.[m.awayTeamId]?.goles;
      if (Number.isFinite(home) && Number.isFinite(away)) {
        playedLeague++;
        doneByRonda.set(ronda, (doneByRonda.get(ronda) || 0) + 1);
      }
    }

    const totalJornadas = totalByRonda.size;
    let completedJornadas = 0;
    for (const [ronda, total] of totalByRonda) {
      if (total > 0 && doneByRonda.get(ronda) === total) completedJornadas++;
    }

    const preds = allPredictions?.[username] || {};
    let userPredictedPlayed = 0;
    for (const m of league) {
      const home = matchStatsById[m.id]?.stats?.[m.homeTeamId]?.goles;
      const away = matchStatsById[m.id]?.stats?.[m.awayTeamId]?.goles;
      if (!Number.isFinite(home) || !Number.isFinite(away)) continue;
      const pr = preds[m.id];
      if (pr && Number.isFinite(pr.home) && Number.isFinite(pr.away)) userPredictedPlayed++;
    }

    return {
      totalLeague: league.length,
      playedLeague,
      completedJornadas,
      totalJornadas,
      userPredictedPlayed,
      partial: playedLeague < league.length || completedJornadas < totalJornadas,
    };
  }

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
      luckZ: null,
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
    }

    for (const key of ['majority', 'tight', 'minority']) {
      const conf = out.confidence[key];
      conf.hitPct = conf.matches ? Math.round((conf.hits / conf.matches) * 100) : 0;
      conf.exactPct = conf.matches ? Math.round((conf.exacts / conf.matches) * 100) : 0;
    }

    return out;
  }

  function calcLuckLabels(styleByUser) {
    const styles = Object.values(styleByUser || {})
      .filter(style => style && style.analyzedMatches > 0 && Number.isFinite(style.luckPerMatch));
    if (!styles.length) {
      for (const style of Object.values(styleByUser || {})) {
        if (style) {
          style.luckLabel = null;
          style.luckZ = null;
        }
      }
      return styleByUser;
    }

    const values = styles.map(style => style.luckPerMatch);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    const sd = Math.sqrt(variance);

    for (const style of Object.values(styleByUser || {})) {
      if (!style) continue;
      if (!style.analyzedMatches || !Number.isFinite(style.luckPerMatch) || !sd) {
        style.luckLabel = null;
        style.luckZ = null;
        continue;
      }
      const z = (style.luckPerMatch - mean) / sd;
      style.luckZ = Math.round(z * 10) / 10;
      style.luckLabel = z >= 1 ? 'afortunado' : z <= -1 ? 'desafortunado' : 'neutro';
    }

    return styleByUser;
  }

  function calcPlayerExtremes(playerDetails) {
    let best = null;
    let worst = null;
    for (const detail of playerDetails || []) {
      if (!detail?.jugador) continue;
      if (!Array.isArray(detail.partidos) || detail.partidos.length === 0) continue;
      const points = detail.puntosTotal || 0;
      if (!best || points > best.puntos) best = { jugador: detail.jugador, puntos: points };
      if (!worst || points < worst.puntos) worst = { jugador: detail.jugador, puntos: points };
    }
    return best ? { best, worst } : null;
  }

  function buildDuelContext(leftUser, rightUser, aggregates) {
    const a = aggregates || {};

    const buildSide = (username) => {
      const split = a.splitByUser?.[username] || {};
      const reliability = a.reliabilityByUser?.[username] || {};
      const exact = a.exactStatsByUser?.[username] || {};
      const extremes = a.matchExtremesByUser?.[username] || {};
      const players = a.playerExtremesByUser?.[username] || null;
      const style = a.styleByUser?.[username] || {};
      const leaguePoints = a.leaguePoints?.[username] || [];
      const positions = a.positionHistory?.[username] || [];
      const played = reliability.played || 0;
      return {
        points_prediction: split.prediction || 0,
        points_squad: split.squad || 0,
        points_classification: split.classification || 0,
        points_eliminatorias: split.eliminatorias || 0,
        points_total: (split.prediction || 0) + (split.squad || 0) + (split.classification || 0) + (split.eliminatorias || 0),
        hits_1x2: reliability.hits || 0,
        exact_scores: reliability.exactScores || 0,
        avg_points_per_match: played ? reliability.ptsPerMatch : null,
        best_match: extremes.best?.points ?? null,
        worst_match: extremes.worst?.points ?? null,
        best_jornada: leaguePoints.length ? Math.max(...leaguePoints) : null,
        worst_jornada: leaguePoints.length ? Math.min(...leaguePoints) : null,
        consistency: leaguePoints.length >= 2 ? calcConsistency(leaguePoints) : null,
        momentum: leaguePoints.length >= 3 ? (calcMomentum(leaguePoints)?.delta ?? null) : null,
        best_exact_streak: played ? (exact.streaks?.bestExact ?? 0) : null,
        best_player: players?.best?.puntos ?? null,
        worst_player: players?.worst?.puntos ?? null,
        robos: style.robos?.count || 0,
        faroles: style.faroles?.count || 0,
        luck_per_match: style.luckPerMatch ?? null,
        minority_hit: style.confidence?.minority?.hitPct ?? null,
        minority_matches: style.confidence?.minority?.matches || 0,
        times_top_jornada: a.timesTopJornada?.[username] || 0,
        best_rank: positions.length ? Math.min(...positions) : null,
        worst_rank: positions.length ? Math.max(...positions) : null,
        played_matches: played,
        analyzed_matches: style.analyzedMatches || 0,
        league_points: leaguePoints,
      };
    };

    const left = buildSide(leftUser);
    const right = buildSide(rightUser);
    const jornadaCount = Math.min(left.league_points.length, right.league_points.length);
    let leftJornadas = 0;
    let rightJornadas = 0;
    let biggestWin = null;
    let biggestLoss = null;

    for (let i = 0; i < jornadaCount; i++) {
      const delta = (left.league_points[i] || 0) - (right.league_points[i] || 0);
      if (delta > 0) leftJornadas++;
      else if (delta < 0) rightJornadas++;
      if (biggestWin === null || delta > biggestWin) biggestWin = delta;
      if (biggestLoss === null || delta < biggestLoss) biggestLoss = delta;
    }

    const leftMatchPoints = a.matchPointsByUser?.[leftUser] || {};
    const rightMatchPoints = a.matchPointsByUser?.[rightUser] || {};
    let leftMatches = 0;
    let rightMatches = 0;
    let playedLeagueCount = 0;

    for (const match of a.playedMatches || []) {
      const meta = a.matchesById?.[match.matchId];
      if (!meta || meta.fase !== 'liga') continue;
      playedLeagueCount++;
      const l = leftMatchPoints[match.matchId] || 0;
      const r = rightMatchPoints[match.matchId] || 0;
      if (l > r) leftMatches++;
      else if (r > l) rightMatches++;
    }

    left.h2h_jornadas_won = leftJornadas;
    right.h2h_jornadas_won = rightJornadas;
    left.h2h_partidos_won = leftMatches;
    right.h2h_partidos_won = rightMatches;
    left.biggest_win = biggestWin;
    left.biggest_loss = biggestLoss;
    right.biggest_win = biggestLoss === null ? null : -biggestLoss;
    right.biggest_loss = biggestWin === null ? null : -biggestWin;

    return {
      left,
      right,
      jornada_count: jornadaCount,
      played_league_count: playedLeagueCount,
    };
  }

  const DUEL_CATEGORIES = [
    { key: 'points_prediction', title: 'Puntos pronósticos', desc: 'Puntos conseguidos con los marcadores de los partidos.', direction: 'higher', format: 'int' },
    { key: 'points_squad', title: 'Puntos plantilla', desc: 'Puntos de tu plantilla ideal.', direction: 'higher', format: 'int' },
    { key: 'points_classification', title: 'Puntos clasificación', desc: 'Puntos por acertar la clasificación final.', direction: 'higher', format: 'int' },
    { key: 'points_eliminatorias', title: 'Puntos eliminatorias', desc: 'Puntos del cuadro de eliminatorias.', direction: 'higher', format: 'int' },
    { key: 'points_total', title: 'Puntos totales', desc: 'Suma de las cuatro fuentes de puntos.', direction: 'higher', format: 'int' },
    { key: 'hits_1x2', title: 'Aciertos 1X2', desc: 'Partidos en los que acertaste el resultado.', direction: 'higher', format: 'int' },
    { key: 'exact_scores', title: 'Marcadores exactos', desc: 'Partidos en los que acertaste el marcador completo.', direction: 'higher', format: 'int' },
    { key: 'best_match', title: 'Mejor partido', desc: 'Tu mayor puntuación en un solo partido.', direction: 'higher', format: 'int', na: c => c.left.best_match == null || c.right.best_match == null },
    { key: 'worst_match', title: 'Peor partido', desc: 'Tu puntuación más baja; gana el que tenga la menos mala.', direction: 'higher', format: 'int', na: c => c.left.worst_match == null || c.right.worst_match == null },
    { key: 'best_jornada', title: 'Mejor jornada', desc: 'Tu mayor puntuación en una jornada completa.', direction: 'higher', format: 'int', na: c => c.jornada_count === 0 },
    { key: 'worst_jornada', title: 'Peor jornada', desc: 'Tu jornada más baja; gana la menos mala.', direction: 'higher', format: 'int', na: c => c.jornada_count === 0 },
    { key: 'consistency', title: 'Regularidad', desc: 'Desviación de tus puntos por jornada; gana el más regular.', direction: 'lower', format: 'decimal1', na: c => c.left.consistency == null || c.right.consistency == null },
    { key: 'momentum', title: 'Momentum', desc: 'Media de las últimas 3 jornadas frente a tu media de temporada.', direction: 'higher', format: 'signedDecimal1', na: c => c.left.momentum == null || c.right.momentum == null },
    { key: 'best_exact_streak', title: 'Mejor racha de exactos', desc: 'Marcadores exactos consecutivos; gana la racha más larga.', direction: 'higher', format: 'int', na: c => c.left.played_matches === 0 || c.right.played_matches === 0 },
    { key: 'best_player', title: 'Mejor jugador', desc: 'El jugador de tu plantilla con más puntos.', direction: 'higher', format: 'int', na: c => c.left.best_player == null || c.right.best_player == null },
    { key: 'worst_player', title: 'Peor jugador', desc: 'El jugador con menos puntos; gana el menos malo.', direction: 'higher', format: 'int', na: c => c.left.worst_player == null || c.right.worst_player == null },
    { key: 'robos', title: 'Robos', desc: 'Aciertos minoritarios que te dieron ventaja sobre la media.', direction: 'higher', format: 'int', na: c => c.left.analyzed_matches === 0 || c.right.analyzed_matches === 0 },
    { key: 'faroles', title: 'Faroles', desc: 'Fallos con la opción más votada; gana quien tenga menos.', direction: 'lower', format: 'int', na: c => c.left.analyzed_matches === 0 || c.right.analyzed_matches === 0 },
    { key: 'luck_per_match', title: 'Suerte/partido', desc: 'Puntos reales menos puntos esperados por partido.', direction: 'higher', format: 'signedDecimal1', na: c => c.left.analyzed_matches === 0 || c.right.analyzed_matches === 0 },
    { key: 'minority_hit', title: 'Acierto en minoría', desc: 'Acierto 1X2 cuando tu opción tenía menos del 33% de apoyo.', direction: 'higher', format: 'percent', na: c => c.left.minority_matches < 3 || c.right.minority_matches < 3 },
    { key: 'times_top_jornada', title: 'Veces mejor de la jornada', desc: 'Jornadas en las que igualaste la máxima puntuación de la porra.', direction: 'higher', format: 'int', na: c => c.jornada_count === 0 },
    { key: 'avg_points_per_match', title: 'Media de puntos por partido', desc: 'Puntos de pronósticos divididos entre partidos jugados.', direction: 'higher', format: 'decimal1', na: c => c.left.played_matches === 0 || c.right.played_matches === 0 },
    { key: 'h2h_jornadas_won', title: 'Jornadas ganadas', desc: 'Jornadas completas en las que superaste a tu rival.', direction: 'higher', format: 'int', na: c => c.jornada_count === 0 },
    { key: 'h2h_partidos_won', title: 'Partidos ganados', desc: 'Partidos jugados en los que superaste a tu rival.', direction: 'higher', format: 'int', na: c => c.played_league_count === 0 },
    { key: 'biggest_win', title: 'Mayor victoria', desc: 'Tu mayor diferencia positiva en una jornada.', direction: 'higher', format: 'signedInt', na: c => c.jornada_count === 0 },
    { key: 'biggest_loss', title: 'Mayor derrota', desc: 'Tu mayor diferencia negativa; gana la menos abultada.', direction: 'higher', format: 'signedInt', na: c => c.jornada_count === 0 },
    { key: 'best_rank', title: 'Mejor puesto histórico', desc: 'Tu mejor posición en la clasificación; gana el puesto más bajo.', direction: 'lower', format: 'rank', na: c => c.jornada_count === 0 },
    { key: 'worst_rank', title: 'Peor puesto histórico', desc: 'Tu peor posición; gana el puesto más bajo (el menos malo).', direction: 'lower', format: 'rank', na: c => c.jornada_count === 0 },
  ];

  function formatDuelValue(value, format) {
    if (value == null || !Number.isFinite(value)) return '—';
    if (format === 'signedInt') {
      const rounded = Math.round(value);
      return rounded > 0 ? `+${rounded}` : String(rounded);
    }
    if (format === 'decimal1') return value.toFixed(1);
    if (format === 'signedDecimal1') {
      const text = value.toFixed(1);
      return value > 0 ? `+${text}` : text;
    }
    if (format === 'percent') return `${Math.round(value)}%`;
    if (format === 'rank') return `${value}º`;
    return String(Math.round(value));
  }

  function calcDuelCategories(context) {
    return DUEL_CATEGORIES.map(category => {
      const na = typeof category.na === 'function' ? category.na(context) : false;
      const leftNum = na ? null : context.left[category.key];
      const rightNum = na ? null : context.right[category.key];
      let winner = 'na';
      if (!na && Number.isFinite(leftNum) && Number.isFinite(rightNum)) {
        if (leftNum === rightNum) winner = 'tie';
        else if (category.direction === 'lower') winner = leftNum < rightNum ? 'left' : 'right';
        else winner = leftNum > rightNum ? 'left' : 'right';
      }
      return {
        key: category.key,
        title: category.title,
        desc: category.desc,
        direction: category.direction,
        format: category.format,
        leftNum: na ? null : leftNum,
        rightNum: na ? null : rightNum,
        leftValue: na ? '—' : formatDuelValue(leftNum, category.format),
        rightValue: na ? '—' : formatDuelValue(rightNum, category.format),
        winner,
      };
    });
  }

  function calcDuelScore(categories, context) {
    const leftWins = categories.filter(category => category.winner === 'left').length;
    const rightWins = categories.filter(category => category.winner === 'right').length;
    const disputed = categories.filter(category => category.winner !== 'na').length;
    let winner = leftWins > rightWins ? 'left' : rightWins > leftWins ? 'right' : null;
    let tieBreak = null;

    if (!winner) {
      const order = [
        ['points_total', 'total'],
        ['points_squad', 'squad'],
        ['points_prediction', 'pronósticos'],
      ];
      for (const [key, label] of order) {
        const leftValue = context.left[key] || 0;
        const rightValue = context.right[key] || 0;
        if (leftValue > rightValue) {
          winner = 'left';
          tieBreak = label;
          break;
        }
        if (rightValue > leftValue) {
          winner = 'right';
          tieBreak = label;
          break;
        }
      }
    }

    return {
      leftWins,
      rightWins,
      disputed,
      na: categories.length - disputed,
      winner: winner || 'draw',
      tieBreak,
    };
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

  function tallyChampions(finalPredictionsCache) {
    const votes = new Map();
    let total = 0;
    for (const fp of Object.values(finalPredictionsCache || {})) {
      let c = fp?.champion;
      if (c != null && typeof c === 'string' && c !== '') c = Number(c);
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
        if (!agg.has(id)) agg.set(id, { player: sp, owners: new Set(), pts: 0, hasPts: false });
        agg.get(id).owners.add(username);
      }
    }
    for (const sq of Object.values(squadPointsByUser || {})) {
      for (const pd of sq?.playerDetails || []) {
        const entry = agg.get(String(pd.jugador?.id));
        if (entry && !entry.hasPts) {
          entry.pts = pd.puntosTotal || 0;
          entry.hasPts = true;
        }
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
  let mostConsensus=null, mostDivided=null, maxPct=-1;
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
    let c = fp?.champion, r = fp?.runnerUp;
    if (c != null && typeof c === 'string' && c !== '') c = Number(c);
    if (r != null && typeof r === 'string' && r !== '') r = Number(r);
    if (!Number.isFinite(c) || !Number.isFinite(r)) continue;
    const pair = `${c}-${r}`;
    pairVotes.set(pair, (pairVotes.get(pair) || 0) + 1);
  }
  const finalTally = [...pairVotes.entries()].map(([pair, votes]) => ({ pair, votes })).sort((a,b)=> b.votes - a.votes || a.pair.localeCompare(b.pair));
  const semisFreq = new Map();
  for (const fp of Object.values(finalPredictionsCache || {})){
    for (let id of (Array.isArray(fp?.semiFinalists) ? fp.semiFinalists : [])){
      if (id != null && typeof id === 'string' && id !== '') id = Number(id);
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

  function renderPronosticosPartidosCard(partidos){
    const hasData = partidos && ((partidos.globalCounts?.H||0)+(partidos.globalCounts?.D||0)+(partidos.globalCounts?.A||0))>0;
    const title='<div class="stats-card-title">⚽ Pronósticos de partidos</div>';
    if(!hasData) return `<div class="stats-pronosticos-partidos">${title}${statsEmpty('Aún no hay pronósticos')}</div>`;
    const pct = partidos.globalPct || {H:0,D:0,A:0};
    function matchLabel(id){
      try{
        const list = (typeof AppState!=='undefined' && (AppState.leagueMatches?.length ? AppState.leagueMatches : AppState.matches)) || [];
        const m = list.find(x=> String(x.id)===String(id));
        if(!m) return `#${id}`;
        const hn = (typeof AppState!=='undefined' && AppState.teamsMap?.[m.homeTeamId]?.name) || m.homeTeam || m.homeTeamId;
        const an = (typeof AppState!=='undefined' && AppState.teamsMap?.[m.awayTeamId]?.name) || m.awayTeam || m.awayTeamId;
        return `${esc(hn)} – ${esc(an)}`;
      }catch(e){ return `#${id}`; }
    }
    const resultLabel = { H:'1', D:'X', A:'2' };
    const mostRep = partidos.mostRepeated;
    const leastRep = partidos.leastRepeated;
    const raro = partidos.raro;
    const cons = partidos.mostConsensus;
    const div = partidos.mostDivided;
    const headline = pct.H >= 50 ? 'Somos optimistas en casa y nos cuesta creer en el 0-0' : pct.D >= 30 ? 'La porra huele a empates' : 'Atrevidos fuera de casa';
    return `<div class="stats-pronosticos-partidos">${title}
      <div style="font-size:10px; font-weight:900; letter-spacing:0.4px; color:var(--accent-primary); margin-bottom:2px;">LA PORRA DICE…</div>
      <div style="font-size:13px; font-weight:800; line-height:1.3; margin-bottom:10px;">${esc(headline)}</div>
      <div style="background:rgba(255,255,255,0.04); border-radius:10px; padding:10px; display:flex; gap:8px; margin-bottom:10px;">
        <div style="flex:1; text-align:center;"><div style="font-size:16px;">🏠</div><div style="font-weight:900; font-size:16px; color:var(--accent-primary);">${pct.H||0}%</div><div style="font-size:9px; color:var(--text-muted); font-weight:700;">LOCAL</div></div>
        <div style="width:1px; background:rgba(255,255,255,0.06);"></div>
        <div style="flex:1; text-align:center;"><div style="font-size:16px;">🤝</div><div style="font-weight:900; font-size:16px; color:var(--accent-gold);">${pct.D||0}%</div><div style="font-size:9px; color:var(--text-muted); font-weight:700;">EMPATE</div></div>
        <div style="width:1px; background:rgba(255,255,255,0.06);"></div>
        <div style="flex:1; text-align:center;"><div style="font-size:16px;">✈️</div><div style="font-weight:900; font-size:16px; color:var(--accent-purple);">${pct.A||0}%</div><div style="font-size:9px; color:var(--text-muted); font-weight:700;">VISITANTE</div></div>
      </div>
      <div style="font-size:11px; line-height:1.6; color:var(--text-secondary);">
        El <b style="color:var(--accent-gold);">${esc(mostRep?.score||'—')}</b> es el rey (${mostRep?.pct||0}% · ${mostRep?.votes||0} votos). El <b>${esc(leastRep?.score||'—')}</b> apenas existe (${leastRep?.pct||0}%). ${raro ? `Y hay un valiente: <b style="color:var(--accent-cyan);">${esc(raro.score)} · ${raro.votes} voto${raro.votes===1?'':'s'}</b> 🤯` : ''}
      </div>
      <div style="margin-top:10px; padding:9px; background:rgba(16,185,129,0.07); border-radius:10px; border:1px solid rgba(16,185,129,0.18);">
        <div style="font-size:11px; font-weight:800; color:var(--accent-primary);">🤝 Todos de acuerdo</div>
        <div style="font-size:11px; margin-top:3px;">${cons ? `<b>${matchLabel(cons.matchId)}</b> · ${cons.pct}% al <b>${esc(resultLabel[cons.result]||cons.result)}</b>` : '—'}</div>
        <div style="font-size:11px; font-weight:800; color:var(--accent-gold); margin-top:8px;">⚖️ Nadie se aclara</div>
        <div style="font-size:11px; margin-top:3px;">${div ? `<b>${matchLabel(div.matchId)}</b> · entropía ${div.entropy}` : '—'}</div>
      </div>
      <div style="display:flex; gap:6px; margin-top:10px; font-size:10px; color:var(--text-muted); justify-content:space-between;">
        <span>${partidos.conservador ? `🛡️ ${esc(partidos.conservador.username)}${guestTag(partidos.conservador.username)} prudente · ${partidos.conservador.avg} gol/part` : ''}</span>
        <span>${partidos.arriesgado ? `🔥 ${esc(partidos.arriesgado.username)}${guestTag(partidos.arriesgado.username)} loco · ${partidos.arriesgado.avg} gol/part` : ''}</span>
      </div>
      <div style="font-size:10px; color:var(--text-muted); margin-top:6px; text-align:center;">Media: <b>${partidos.localAvg} local</b> / ${partidos.visitanteAvg} visitante · Δ ${partidos.delta>0?'+':''}${partidos.delta}</div>
    </div>`;
  }

  function renderPronosticosClasificacionCard(clasif){
    const title='<div class="stats-card-title">📊 Clasificación pronosticada</div>';
    if(!clasif || !clasif.users) return `<div class="stats-pronosticos-clasificacion">${title}${statsEmpty('Aún no hay pronósticos')}</div>`;
    const freqPrimero = [...(clasif.freqPrimero||new Map()).entries()].sort((a,b)=>b[1]-a[1]).slice(0,3);
    const topMedia = (clasif.topMedia5||[]).slice(0,5);
    const maxDisp = [...(clasif.dispersion||new Map()).entries()].sort((a,b)=>b[1]-a[1])[0] || null;
    const teamName = (tid)=> esc((typeof AppState!=='undefined'&&AppState.teamsMap?.[tid]?.name)||tid);
    const teamImg = (tid)=> `<img class="stats-sq-img" src="data/imgEquipos/${tid}.${(typeof AppState!=='undefined'&&AppState.teamsMap?.[tid]?.ext)||'webp'}" alt="" onerror="this.style.visibility='hidden'">`;
    const headline = freqPrimero[0] ? `Todos ven a ${teamName(freqPrimero[0][0])} arriba, pero nadie se aclara con ${maxDisp ? teamName(maxDisp[0]) : 'el resto'}` : 'Aún sin favoritos claros';
    return `<div class="stats-pronosticos-clasificacion">${title}
      <div style="font-size:10px; font-weight:900; letter-spacing:0.4px; color:var(--accent-cyan);">EL ORDEN SOÑADO</div>
      <div style="font-size:13px; font-weight:800; line-height:1.3; margin:4px 0 10px;">${headline}</div>
      ${freqPrimero.length ? `<div style="background:rgba(6,182,212,0.07); border-radius:10px; padding:9px; border:1px solid rgba(6,182,212,0.15);">
        <div style="font-size:11px; font-weight:800; color:var(--accent-cyan);">👑 Más veces 1º</div>
        ${freqPrimero.map(([tid,cnt])=>`<div class="stats-rank-row" style="background:transparent; border:none; padding:6px 0;">${teamImg(tid)}<span class="stats-rank-name">${teamName(tid)}</span><span class="stats-rank-main">${cnt}/${clasif.users} · ${Math.round(cnt/clasif.users*100)}%</span></div>`).join('')}
      </div>` : ''}
      ${maxDisp ? `<div style="margin-top:8px; padding:8px; background:rgba(245,158,11,0.07); border-radius:10px; border:1px solid rgba(245,158,11,0.15); font-size:11px;">
        <span style="font-weight:800; color:var(--accent-gold);">🌪️ Polémico</span> · <b>${teamName(maxDisp[0])}</b> divide opiniones <span style="color:var(--text-muted);">σ ${maxDisp[1]}</span>
      </div>` : ''}
      <div style="margin-top:10px; font-size:11px; font-weight:800; color:var(--text-muted);">Mejor media (top 5)</div>
      ${topMedia.length ? topMedia.map(tid=>`<div class="stats-rank-row">${teamImg(tid)}<span class="stats-rank-name">${teamName(tid)}</span><span class="stats-rank-main">pos ${clasif.mediaPos?.get(tid)??'—'}</span></div>`).join('') : statsEmpty('Aún no hay pronósticos')}
    </div>`;
  }

  function renderPronosticosEliminatoriasCard(elims){
    const title='<div class="stats-card-title">🏆 Eliminatorias</div>';
    const hasAny = elims && ((elims.championTally?.teams?.length||0) + (elims.finalTally?.length||0) + (elims.semisFreq?.size||0) > 0);
    if(!hasAny) return `<div class="stats-pronosticos-eliminatorias">${title}${statsEmpty('Aún no hay pronósticos')}</div>`;
    const champ = elims.championTally && elims.championTally.teams?.length ? elims.championTally : { total:0, teams:[] };
    const topChamp = champ.teams[0];
    const cname = topChamp ? esc((typeof AppState!=='undefined'&&AppState.teamsMap?.[topChamp.teamId]?.name)||topChamp.teamId) : '—';
    const champPct = topChamp ? Math.round(topChamp.votes/champ.total*100) : 0;
    const finalTop = (elims.finalTally||[])[0];
    const finalLabel = finalTop ? (()=>{
      const p=finalTop.pair.split('-'); const a=esc((typeof AppState!=='undefined'&&AppState.teamsMap?.[p[0]]?.name)||p[0]); const b=esc((typeof AppState!=='undefined'&&AppState.teamsMap?.[p[1]]?.name)||p[1]);
      return `${a} – ${b} · ${finalTop.votes} votos`;
    })() : '—';
    const semisTop = [...(elims.semisFreq||new Map()).entries()].sort((a,b)=>b[1]-a[1])[0];
    const semisName = semisTop ? esc((typeof AppState!=='undefined'&&AppState.teamsMap?.[semisTop[0]]?.name)||semisTop[0]) : '—';
    const q = elims.quadro || {};
    const champBlock = topChamp ? `<div style="font-size:10px; font-weight:900; letter-spacing:0.4px; color:var(--accent-purple);">EL SUEÑO COLECTIVO</div>
      <div style="font-size:13px; font-weight:800; line-height:1.3; margin:4px 0 10px;">${cname} es el campeón del corazón · <span style="color:var(--accent-purple);">${champPct}%</span> lo ve levantando la copa</div>
      <div style="background:rgba(139,92,246,0.07); border-radius:10px; padding:9px; border:1px solid rgba(139,92,246,0.15);">
        <div style="display:flex; gap:8px; align-items:center;">
          <img class="stats-sq-img" src="data/imgEquipos/${topChamp.teamId}.${(typeof AppState!=='undefined'&&AppState.teamsMap?.[topChamp.teamId]?.ext)||'webp'}" alt="" onerror="this.style.visibility='hidden'" style="width:36px;height:36px;">
          <div style="flex:1;"><div style="font-weight:900;">${cname}</div><div style="font-size:11px; color:var(--text-muted);">${topChamp.votes}/${champ.total} votos · ${champPct}%</div></div>
          <div style="font-size:18px;">👑</div>
        </div>
      </div>` : '';
    return `<div class="stats-pronosticos-eliminatorias">${title}
      ${champBlock}
      <div style="margin-top:10px; padding:9px; background:rgba(255,255,255,0.04); border-radius:10px;">
        <div style="font-size:11px; font-weight:800; color:var(--accent-cyan);">💭 Final soñada</div>
        <div style="font-size:11px; margin-top:3px;"><b>${finalLabel}</b></div>
        <div style="font-size:11px; font-weight:800; color:var(--accent-gold); margin-top:8px;">⚔️ Fijo en semis</div>
        <div style="font-size:11px; margin-top:3px;"><b>${semisName}</b> ${semisTop ? `· ${semisTop[1]} votos` : ''}</div>
      </div>
      ${q.users ? `<div style="margin-top:8px; font-size:10px; color:var(--text-muted); text-align:center;">Tu cuadro coincide un <b>${q.avgPct}%</b> · ${q.avgCommon}/24 equipos · ${q.veryDiffCount} cuadros muy distintos</div>` : ''}
    </div>`;
  }

  function renderPronosticosPlantillaCard(plantilla, squadAgg){
    const title='<div class="stats-card-title">👥 Plantilla</div>';
    if(!squadAgg || !squadAgg.rows?.length) return `<div class="stats-pronosticos-plantilla">${title}${statsEmpty('Aún no hay pronósticos')}</div>`;
    const imp = (plantilla?.imprescindible||[])[0];
    const dif = (plantilla?.diferencial||[])[0];
    const headline = imp ? `Todos quieren a ${esc(imp.player.nombre||imp.player.id)}, pero ${dif ? esc(dif.player.nombre||dif.player.id) : 'el diferencial'} es tu arma secreta` : 'Cada plantilla cuenta una historia';
    const top3 = plantilla?.top3ByPos || {G:[],D:[],M:[],F:[]};
    const equipoMas = plantilla?.equipoMas;
    const equipoMenos = plantilla?.equipoMenos;
    return `<div class="stats-pronosticos-plantilla">${title}
      <div style="font-size:10px; font-weight:900; letter-spacing:0.4px; color:var(--accent-gold);">EL VESTUARIO</div>
      <div style="font-size:13px; font-weight:800; line-height:1.3; margin:4px 0 10px;">${headline}</div>
      ${imp ? `<div style="background:rgba(245,158,11,0.08); border-radius:10px; padding:9px; border:1px solid rgba(245,158,11,0.15); display:flex; gap:8px; align-items:center;">
        <img class="stats-sq-img" src="data/imgJugadores/${imp.player.id}.${imp.player.extension||'webp'}" alt="" onerror="this.style.visibility='hidden'" style="width:36px;height:36px;">
        <div style="flex:1;"><div style="font-weight:900;">⭐ ${esc(imp.player.nombre||imp.player.id)}</div><div style="font-size:11px; color:var(--text-muted);">Imprescindible · ${imp.possessionPct}% lo tiene</div></div>
        <div style="font-weight:900; color:var(--accent-gold);">${imp.possessionPct}%</div>
      </div>` : ''}
      ${dif ? `<div style="margin-top:8px; background:rgba(6,182,212,0.07); border-radius:10px; padding:9px; border:1px solid rgba(6,182,212,0.15); display:flex; gap:8px; align-items:center;">
        <img class="stats-sq-img" src="data/imgJugadores/${dif.player.id}.${dif.player.extension||'webp'}" alt="" onerror="this.style.visibility='hidden'" style="width:36px;height:36px;">
        <div style="flex:1;"><div style="font-weight:900;">🎯 ${esc(dif.player.nombre||dif.player.id)}</div><div style="font-size:11px; color:var(--text-muted);">Diferencial · solo ${dif.possessionPct}% lo tiene</div></div>
      </div>` : ''}
      <div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:11px;">
        <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:8px; text-align:center;"><div style="font-weight:800; color:var(--accent-primary);">${equipoMas ? esc((typeof AppState!=='undefined'&&AppState.teamsMap?.[equipoMas.equipo]?.name)||equipoMas.equipo) : '—'}</div><div style="font-size:9px; color:var(--text-muted);">MÁS ELEGIDO · ${equipoMas?.count||0}</div></div>
        <div style="background:rgba(255,255,255,0.04); border-radius:8px; padding:8px; text-align:center;"><div style="font-weight:800;">${equipoMenos ? esc((typeof AppState!=='undefined'&&AppState.teamsMap?.[equipoMenos.equipo]?.name)||equipoMenos.equipo) : '—'}</div><div style="font-size:9px; color:var(--text-muted);">MENOS ELEGIDO</div></div>
      </div>
      <div style="margin-top:8px; font-size:10px; color:var(--text-muted); display:flex; justify-content:space-between;">
        <span>🪞 Hipster: ${plantilla?.hipster ? `${esc(plantilla.hipster.username)}${guestTag(plantilla.hipster.username)}` : '—'}</span>
        <span>👥 Mainstream: ${plantilla?.mainstream ? `${esc(plantilla.mainstream.username)}${guestTag(plantilla.mainstream.username)}` : '—'}</span>
      </div>
      <div style="margin-top:8px; font-size:10px; color:var(--text-muted); text-align:center;">Top por posición disponible en Plantillas →</div>
    </div>`;
  }

  function renderPronosticosBody(aggregates){
    let partidos, clasif, elims, squadAgg, plantilla;
    try{ partidos=calcPronosticosPartidosStats(statsFilterMap(AppState.allPredictions), (typeof AppState!=='undefined'&&AppState.leagueMatches)||[]); }catch(e){ partidos={globalCounts:{H:0,D:0,A:0},globalPct:{H:0,D:0,A:0},mostRepeated:null,raro:null,mostConsensus:null,mostDivided:null,localAvg:0,visitanteAvg:0,delta:0,conservador:null,arriesgado:null}; }
    try{ clasif=calcClasificacionPronosticosStats(statsFilterMap(AppState.allPredictions), (typeof AppState!=='undefined'&&AppState.leagueMatches)||[], (typeof AppState!=='undefined'&&AppState.teamsMap)||{}); }catch(e){ clasif={freqPrimero:new Map(),freqTop8:new Map(),freqFuera24:new Map(),mediaPos:new Map(),topMedia5:[],users:0}; }
    try{ elims=calcEliminatoriasPronosticosStats(statsFilterMap(AppState.finalPredictionsCache)); }catch(e){ elims={championTally:{total:0,teams:[]},finalTally:[],semisFreq:new Map(),quadro:{users:0,avgCommon:0,avgPct:0,veryDiffCount:0}}; }
    squadAgg = aggregates?.squadOwnership;
    if(!squadAgg){
      try{
        const squadPointsByUser={};
        for(const p of statsPlayers()){
          try{ const ud=getCachedUserData(p.name); squadPointsByUser[p.name]= ud.squadPoints?.playerDetails?.length? ud.squadPoints:null; }catch(_e){ squadPointsByUser[p.name]=null; }
        }
        squadAgg=aggregateSquads(squadPointsByUser, statsFilterMap(AppState.squadsCache));
      }catch(e){ squadAgg={usersWithSquad:0,uniquePlayers:0,rows:[]}; }
    }
    try{ plantilla=calcPlantillaPronosticosExtras(squadAgg, statsFilterMap(AppState.squadsCache)); }catch(e){ plantilla={top3ByPos:{G:[],D:[],M:[],F:[]},equipoMas:null,equipoMenos:null,imprescindible:[],diferencial:[],hipster:null,mainstream:null}; }
    function stripCardTitle(html){
      return html.replace(/<div class="stats-card-title">.*?<\/div>/, '');
    }
    const partidosRaw = renderPronosticosPartidosCard(partidos);
    const clasifRaw = renderPronosticosClasificacionCard(clasif);
    const elimsRaw = renderPronosticosEliminatoriasCard(elims);
    const plantillaRaw = renderPronosticosPlantillaCard(plantilla, squadAgg);
    const hasPartidos = partidos && ((partidos.globalCounts?.H||0)+(partidos.globalCounts?.D||0)+(partidos.globalCounts?.A||0))>0;
    const pct = partidos?.globalPct || {H:0,D:0,A:0};
    const headPartidosSub = hasPartidos ? `${pct.H}% local · ${pct.D}% empate · ${pct.A}% visitante` : 'Aún sin datos';
    const headClasifSub = clasif?.freqPrimero?.size ? `${[...clasif.freqPrimero.entries()].sort((a,b)=>b[1]-a[1])[0][1]}/${clasif.users} ven al mismo líder` : 'Sin consenso aún';
    const headElimsSub = elims?.championTally?.teams?.[0] ? `${esc((typeof AppState!=='undefined'&&AppState.teamsMap?.[elims.championTally.teams[0].teamId]?.name)||elims.championTally.teams[0].teamId)} · ${Math.round(elims.championTally.teams[0].votes/elims.championTally.total*100)}%` : 'Aún sin campeón claro';
    const headPlantillaSub = plantilla?.imprescindible?.[0] ? `${esc(plantilla.imprescindible[0].player.nombre||'')} · ${plantilla.imprescindible[0].possessionPct}% lo tiene` : 'Plantillas por revelar';
    return `
    <div class="stats-pronosticos-grid">
      <div class="stats-card stats-pronosticos-card open" data-pronostico="partidos">
        <div class="stats-pronosticos-accordion-head" role="button" tabindex="0" aria-expanded="true" aria-controls="panel-partidos" id="head-partidos">
          <div class="stats-accordion-icon" style="background:rgba(16,185,129,0.12);border-color:rgba(16,185,129,0.25);color:var(--accent-primary)">⚽</div>
          <div style="flex:1;min-width:0">
            <div class="stats-accordion-title">Pronósticos de partidos</div>
            <div class="stats-accordion-sub">${esc(headPartidosSub)}</div>
          </div>
          <span class="stats-accordion-chev" aria-hidden="true">▾</span>
        </div>
        <div class="stats-pronosticos-extra" id="panel-partidos" role="region" aria-labelledby="head-partidos">${stripCardTitle(partidosRaw)}</div>
      </div>
      <div class="stats-card stats-pronosticos-card" data-pronostico="clasif">
        <div class="stats-pronosticos-accordion-head" role="button" tabindex="0" aria-expanded="false" aria-controls="panel-clasif" id="head-clasif">
          <div class="stats-accordion-icon" style="background:rgba(6,182,212,0.12);border-color:rgba(6,182,212,0.25);color:var(--accent-cyan)">📊</div>
          <div style="flex:1;min-width:0">
            <div class="stats-accordion-title">Clasificación pronosticada</div>
            <div class="stats-accordion-sub">${esc(headClasifSub)}</div>
          </div>
          <span class="stats-accordion-chev" aria-hidden="true">▾</span>
        </div>
        <div class="stats-pronosticos-extra" id="panel-clasif" role="region" aria-labelledby="head-clasif">${stripCardTitle(clasifRaw)}</div>
      </div>
      <div class="stats-card stats-pronosticos-card" data-pronostico="elims">
        <div class="stats-pronosticos-accordion-head" role="button" tabindex="0" aria-expanded="false" aria-controls="panel-elims" id="head-elims">
          <div class="stats-accordion-icon" style="background:rgba(139,92,246,0.12);border-color:rgba(139,92,246,0.25);color:var(--accent-purple)">🏆</div>
          <div style="flex:1;min-width:0">
            <div class="stats-accordion-title">Eliminatorias</div>
            <div class="stats-accordion-sub">${esc(headElimsSub)}</div>
          </div>
          <span class="stats-accordion-chev" aria-hidden="true">▾</span>
        </div>
        <div class="stats-pronosticos-extra" id="panel-elims" role="region" aria-labelledby="head-elims">${stripCardTitle(elimsRaw)}</div>
      </div>
      <div class="stats-card stats-pronosticos-card" data-pronostico="plantilla">
        <div class="stats-pronosticos-accordion-head" role="button" tabindex="0" aria-expanded="false" aria-controls="panel-plantilla" id="head-plantilla">
          <div class="stats-accordion-icon" style="background:rgba(245,158,11,0.12);border-color:rgba(245,158,11,0.25);color:var(--accent-gold)">👥</div>
          <div style="flex:1;min-width:0">
            <div class="stats-accordion-title">Plantilla</div>
            <div class="stats-accordion-sub">${esc(headPlantillaSub)}</div>
          </div>
          <span class="stats-accordion-chev" aria-hidden="true">▾</span>
        </div>
        <div class="stats-pronosticos-extra" id="panel-plantilla" role="region" aria-labelledby="head-plantilla">${stripCardTitle(plantillaRaw)}</div>
      </div>
    </div>`;
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

  function guestTag(name) {
    if (typeof porraGuest === 'undefined') return '';
    const p = (AppState.players || []).find(x => x.name === name);
    return porraGuest.guestBadgeHtml(p && p.isGuest);
  }

  function statsHideGuests() {
    return typeof porraGuest !== 'undefined' && porraGuest.hideGuestsForViewer(AppState.currentUser);
  }

  function statsPlayers() {
    const list = AppState.players || [];
    return statsHideGuests() ? list.filter(p => !p.isGuest) : list;
  }

  function statsFilterMap(obj) {
    if (!statsHideGuests()) return obj || {};
    const set = new Set(statsPlayers().map(p => p.name));
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) if (set.has(k)) out[k] = v;
    return out;
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
  const EVO_METRIC_DEFAULT = 'posicion';
  const EVO_MODE_DEFAULT = 'acumulado';
  const STATS_CONSISTENCY_SIGMA = 8;
  const DONUT_RADIUS = 42;
  const LINE_COLORS = ['var(--accent-primary)', 'var(--accent-purple)', 'var(--accent-gold)', 'var(--accent-cyan)', '#EC4899', '#F97316', '#22C55E', '#3B82F6'];
  let currentSeriesMap = null;
  let currentEvolutionTimeline = null;

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
      classificationTotal: isClassificationCounting() ? calculateClassificationPoints(username).totalPoints : 0,
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
    const list = statsPlayers();
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
      if (!AppState.matchStats.length && AppState.estadisticasSubTab !== 'pronosticos') {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted)">No hay resultados disponibles aún</div>';
        return;
      }
      for (const p of statsPlayers()) {
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
    for (const p of statsPlayers()) {
      const r = getSeriesBySource(source, getCachedUserData(p.name));
      map.set(p.name, r);
    }
    return map;
  }

  function orderPlayers(seriesMap, opts) {
    const options = opts || {};
    const metric = options.metric || EVO_METRIC_DEFAULT;
    const lastIdx = Number.isInteger(options.lastIdx) ? options.lastIdx : 12;
    const players = [...statsPlayers()];
    const me = AppState.currentUser?.name;
    players.sort((a, b) => {
      if (a.name === me) return -1;
      if (b.name === me) return 1;
      const av = seriesMap.get(a.name)?.series[lastIdx] || 0;
      const bv = seriesMap.get(b.name)?.series[lastIdx] || 0;
      return metric === 'posicion' ? av - bv : bv - av;
    });
    return players;
  }

  function initStatsState(seriesMap, opts) {
    if (!AppState.estadisticasSubTab) AppState.estadisticasSubTab = 'pronosticos';
    if (!AppState.estadisticasPointType) AppState.estadisticasPointType = 'total';
    if (!AppState.estadisticasEvoMetric) AppState.estadisticasEvoMetric = EVO_METRIC_DEFAULT;
    if (!AppState.estadisticasEvoMode) AppState.estadisticasEvoMode = EVO_MODE_DEFAULT;
    if (!AppState.estadisticasVisibleUsers) {
      const me = AppState.currentUser?.name;
      const top = orderPlayers(seriesMap, opts).slice(0, 3).map(p => p.name);
      AppState.estadisticasVisibleUsers = new Set([me, ...top].filter(Boolean));
    }
  }

  function buildStatsAggregates() {
    const matchesById = buildMatchesById();
    const matchStatsById = {};
    for (const ms of AppState.matchStats || []) matchStatsById[ms.eventId] = ms;
    const playedMatches = extractPlayedMatches(AppState.matches, matchStatsById);
    const playerNames = statsPlayers().map(p => p.name);
    const styleByUser = {};
    for (const name of playerNames) {
      styleByUser[name] = calcStyleStats(name, playedMatches, AppState.allPredictions, AppState.userPoints, matchesById, playerNames);
    }
    calcLuckLabels(styleByUser);
    const detailsByUser = {};
    for (const p of statsPlayers()) {
      detailsByUser[p.name] = AppState.userPoints[p.name]?.matchDetails || [];
    }
    const squadPointsByUser = {};
    for (const p of statsPlayers()) {
      const ud = getCachedUserData(p.name);
      squadPointsByUser[p.name] = ud.squadPoints?.playerDetails?.length ? ud.squadPoints : null;
    }
    const league = buildCompletedLeagueData(AppState.leagueMatches, matchStatsById, detailsByUser, squadPointsByUser);
    const realPointsByUser = {};
    const splitByUser = {};
    for (const p of statsPlayers()) {
      const s = sourceSplitFromUserData(AppState.userPoints[p.name]?.totalPoints, getCachedUserData(p.name));
      splitByUser[p.name] = s;
      realPointsByUser[p.name] = s.prediction + s.squad + s.classification + s.eliminatorias;
    }
    return {
      reachedPhases: computeReachedPhases(AppState.matches, AppState.matchStats),
      matchesById,
      matchStatsById,
      playedMatches,
      completedRondas: league.completedRondas,
      leaguePoints: league.pointsByUserByJornada,
      streaks: calcStreaks(league.pointsByUserByJornada),
      positionHistory: calcPositionHistory(league.pointsByUserByJornada),
      timesTopJornada: calcTimesTopJornada(league.pointsByUserByJornada),
      realPointsByUser,
      splitByUser,
      coverage: calcDataCoverage(AppState.matches, AppState.matchStats, AppState.allPredictions, AppState.currentUser?.name),
      sourceRanks: calcSourceRanks(splitByUser, playerNames),
      styleByUser,
      bestJornadas: calcBestJornadas(league.pointsByUserByJornada, 5),
      championsTally: tallyChampions(statsFilterMap(AppState.finalPredictionsCache)),
      quadro: compareQuadroWithCommunity(AppState.currentUser?.name, statsFilterMap(AppState.finalPredictionsCache)),
      squadOwnership: aggregateSquads(squadPointsByUser, statsFilterMap(AppState.squadsCache)),
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
    if (sub === 'pronosticos') body = renderPronosticosBody(aggregates);
    else if (sub === 'evolucion') body = renderEvolucionBody(aggregates);
    else if (sub === 'individual') body = renderIndividualBody(aggregates);
    else if (sub === 'rachas') body = renderRachasBody(aggregates);
    else body = renderPlantillasBody(aggregates);

    return `
      <div class="stats-card">
        <div class="stats-subtabs">${subBar}</div>
        ${renderCoverageNote(aggregates)}
      </div>
      ${body}`;
  }

  function renderRachasBody(aggregates) {
    const streakEntries = Object.entries(aggregates.streaks || {})
      .filter(([, s]) => s)
      .sort((a, b) => b[1].len - a[1].len || b[1].lastPts - a[1].lastPts);
    const me = AppState.currentUser?.name;
    const maxStreak = Math.max(...streakEntries.map(([,s])=>s.len), 1);
    const streakHtml = streakEntries.length ? streakEntries.map(([u, s]) => {
      const pct = Math.round((s.len / maxStreak)*100);
      return `
      <div class="stats-rank-row ${u === me ? 'me' : ''}">
        <span class="stats-rank-pos rank-n">${esc(getPlayerMeta(u).avatar || '⚽')}</span>
        <span class="stats-rank-name">${esc(u)}${guestTag(u)}</span>
        <div class="stats-streak-bar" aria-hidden="true"><div class="stats-streak-fill ${s.dir}" style="width:${pct}%"></div></div>
        ${s.dir === 'up'
          ? `<span class="stats-badge-up">▲ ${s.len}</span>`
          : `<span class="stats-badge-dn">▼ ${s.len}</span>`}
      </div>`;
    }).join('') : '';

    const medals = ['🥇', '🥈', '🥉'];
    const bestHtml = (aggregates.bestJornadas || []).length ? aggregates.bestJornadas.map((b, i) => {
      const ronda = aggregates.completedRondas?.[b.jornadaIdx];
      const pos = i < 3 ? medals[i] : `<span class="stats-rank-pos rank-n">${i + 1}</span>`;
      return `
      <div class="stats-rank-row ${b.username === me ? 'me' : ''}">
        ${pos}
        <span class="stats-rank-name">${esc(getPlayerMeta(b.username).avatar || '⚽')} ${esc(b.username)}${guestTag(b.username)} · J${ronda ?? b.jornadaIdx + 1}</span>
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

  function squadPosLabel(pos) {
    return { G: 'Portero', D: 'Defensa', M: 'Centrocampista', F: 'Delantero' }[pos] || pos || '';
  }

  function squadPosEmoji(pos) {
    return { G: '🧤', D: '🛡️', M: '⚙️', F: '⚽' }[pos] || '⚽';
  }

  function renderPlantillasBody(aggregates) {
    const agg = aggregates.squadOwnership || { rows: [] };
    if (!agg.rows.length) return statsEmpty('Aún no hay plantillas guardadas');
    const posOrder = ['G','D','M','F'];
    const grouped = posOrder.map(pos => ({ pos, label: squadPosLabel(pos), emoji: squadPosEmoji(pos), rows: agg.rows.filter(r => r.player.posicion === pos).slice(0,6) }));
    const hasGrouped = grouped.some(g => g.rows.length);
    if (!hasGrouped) {
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
        <div class="stats-card-title">⭐ Jugadores estrella — top global</div>
        ${rowsHtml}
        <div class="stats-rank-sub">Top 25 de ${agg.uniquePlayers} jugadores únicos · posesión sobre ${agg.usersWithSquad} usuarios con plantilla</div>
      </div>`;
    }
    const groupedHtml = grouped.map(g => {
      if (!g.rows.length) return '';
      const rowsHtml = g.rows.map(r => {
        const badge = r.possessionPct >= 70
          ? '<span class="stats-pill gold">⭐ imprescindible</span>'
          : r.possessionPct <= 30
            ? '<span class="stats-pill cyan">🎯 diferencial</span>'
            : '';
        const ext = r.player.extension || 'webp';
        const img = `<img class="stats-sq-img" src="data/imgJugadores/${r.player.id}.${ext}" alt="" loading="lazy"
          onerror="this.outerHTML='<span class=&quot;stats-sq-img&quot; style=&quot;display:flex;align-items:center;justify-content:center&quot;>${squadPosEmoji(g.pos)}</span>'">`;
        return `<div class="stats-squad-row">${img}<div class="stats-sq-info"><div class="stats-sq-name">${esc(r.player.nombre||'')}</div><div class="stats-sq-pos">${esc(g.label)} · ${r.ownerCount}/${agg.usersWithSquad}</div></div>${badge}<span class="stats-sq-pts">${r.pts} pts</span></div>`;
      }).join('');
      return `<div class="stats-card"><div class="stats-card-title">${g.emoji} ${esc(g.label)} — top ${g.rows.length}</div>${rowsHtml}</div>`;
    }).join('');
    return groupedHtml + `<div class="stats-card"><div class="stats-rank-sub">Agrupado por demarcación G/D/M/F · ${agg.uniquePlayers} únicos · ${agg.usersWithSquad} plantillas</div></div>`;
  }

  function renderEvolucionBody(aggregates) {
    const metric = AppState.estadisticasEvoMetric || EVO_METRIC_DEFAULT;
    const mode = AppState.estadisticasEvoMode || EVO_MODE_DEFAULT;
    const source = AppState.estadisticasPointType || 'total';
    const timeline = trimTimeline(buildTimeline(), lastTimelinePoint(AppState.matches, aggregates.matchStatsById));
    const lastIdx = Math.max(0, timeline.length - 1);
    const sourceSeriesMap = metric === 'puntos'
      ? buildSeriesMap(source, aggregates.reachedPhases, aggregates.matchesById)
      : null;
    const totalSeriesMap = metric === 'posicion'
      ? buildSeriesMap('total', aggregates.reachedPhases, aggregates.matchesById)
      : null;
    const positionSplits = metric === 'posicion'
      ? {
          prediction: buildSeriesMap('pronosticos', aggregates.reachedPhases, aggregates.matchesById),
          squad: buildSeriesMap('plantilla', aggregates.reachedPhases, aggregates.matchesById),
          classification: buildSeriesMap('clasificacion', aggregates.reachedPhases, aggregates.matchesById),
          eliminatorias: buildSeriesMap('eliminatorias', aggregates.reachedPhases, aggregates.matchesById),
        }
      : null;
    const seriesMap = metric === 'posicion'
      ? calcEvolutionPositionsFromSplits(positionSplits)
      : buildEvolutionSeriesMap(metric, mode, sourceSeriesMap, totalSeriesMap);
    currentSeriesMap = seriesMap;
    currentEvolutionTimeline = timeline;
    initStatsState(seriesMap, { metric, lastIdx });
    if (statsHideGuests() && AppState.estadisticasVisibleUsers) {
      const allowed = new Set(statsPlayers().map(p => p.name));
      for (const n of [...AppState.estadisticasVisibleUsers]) {
        if (!allowed.has(n)) AppState.estadisticasVisibleUsers.delete(n);
      }
    }
    const visibleSet = AppState.estadisticasVisibleUsers;
    const players = orderPlayers(seriesMap, { metric, lastIdx });
    const me = AppState.currentUser?.name;
    const search = (AppState.estadisticasEvoSearch || '').toLowerCase();

    const segButtons = SOURCES.map(s =>
      `<button class="stats-source ${s.key === source ? 'active' : ''}" data-source="${s.key}">${s.label}</button>`
    ).join('');
    const metricButtons = [['posicion', 'Posición'], ['puntos', 'Puntos']].map(([key, label]) =>
      `<button class="stats-source stats-evo-metric ${key === metric ? 'active' : ''}" data-metric="${key}">${label}</button>`
    ).join('');
    const modeButtons = [['acumulado', 'Acumulado'], ['jornada', 'Por jornada']].map(([key, label]) =>
      `<button class="stats-source stats-evo-mode ${key === mode ? 'active' : ''}" data-mode="${key}">${label}</button>`
    ).join('');
    const title = metric === 'posicion'
      ? 'Evolución de posición por jornada'
      : (mode === 'jornada' ? 'Puntos por jornada' : 'Evolución de puntos por jornada');
    const extraControls = metric === 'puntos'
      ? `<div class="stats-source-seg stats-evo-source-seg">${segButtons}</div>
         <div class="stats-source-seg stats-evo-mode-seg">${modeButtons}</div>`
      : '<div class="stats-evo-note">Ranking general · todas las fuentes</div>';

    const filtered = search ? players.filter(p => p.name.toLowerCase().includes(search) || (p.avatar||'').includes(search)) : players;
    const chips = filtered.map(p => {
      const on = visibleSet.has(p.name);
      const isMe = p.name === me;
      return `<button class="stats-chip ${on ? 'active' : 'off'} ${isMe ? 'me' : ''}" data-user="${esc(p.name)}" aria-pressed="${on ? 'true' : 'false'}" title="${esc(p.name)}">${esc(p.avatar || '⚽')} ${esc(p.name)}${porraGuest.guestBadgeHtml(p.isGuest)}${isMe ? ' · tú' : ''}</button>`;
    }).join('');
    const hasNoMatch = search && !filtered.length;

    return `
      <div class="stats-card">
        <div class="stats-source-seg stats-evo-metric-seg">${metricButtons}</div>
        ${extraControls}
      </div>
      <div class="stats-card">
        <div class="stats-chips-header">
          <span class="stats-chips-counter">Jugadores: ${visibleSet.size} visibles de ${players.length}</span>
          <button class="stats-chips-action" data-action="todos">Todos</button>
          <button class="stats-chips-action" data-action="nadie">Nadie</button>
        </div>
        <div class="stats-card-title">${title}</div>
        <div class="stats-evo-search-wrap">
          <span class="stats-evo-search-icon">🔍</span>
          <input id="stats-evo-search" class="stats-evo-search" type="search" placeholder="Buscar jugador…" value="${esc(AppState.estadisticasEvoSearch || '')}" aria-label="Buscar jugador" autocomplete="off" spellcheck="false">
          ${search ? '<button class="stats-evo-clear" data-action="clear-search" aria-label="Limpiar búsqueda">×</button>' : ''}
        </div>
        <div class="stats-chips-row">${hasNoMatch ? '<span class="stats-empty" style="padding:8px 0">Sin coincidencias</span>' : chips}</div>
        ${buildLineChart(players, visibleSet, seriesMap, { metric, timeline })}
        ${buildLegend(players, visibleSet, seriesMap, { metric, timeline, pointsMap: totalSeriesMap })}
      </div>`;
  }

  function playersWithData(players, visibleSet, seriesMap) {
    return players.filter(p => visibleSet.has(p.name) && seriesMap.get(p.name)?.hasData);
  }

  function buildLineChart(players, visibleSet, seriesMap, opts) {
    const options = opts || {};
    const metric = options.metric || EVO_METRIC_DEFAULT;
    const timeline = options.timeline || buildTimeline();
    const visible = playersWithData(players, visibleSet, seriesMap);
    if (!visible.length) return statsEmpty('Añade jugadores para ver el gráfico');

    const W = 340, H = 184, PAD = 28;
    const lastPoint = Math.max(0, timeline.length - 1);
    const x = (p) => PAD + (p / Math.max(1, lastPoint)) * (W - PAD * 2);
    let minVal = metric === 'posicion' ? 1 : 0;
    let maxVal = metric === 'posicion' ? 1 : 10;
    for (const p of visible) {
      const series = seriesMap.get(p.name).series;
      for (let i = 0; i <= lastPoint; i++) {
        minVal = Math.min(minVal, series[i] || 0);
        maxVal = Math.max(maxVal, series[i] || 0);
      }
    }
    const y = metric === 'posicion'
      ? (v) => PAD + ((v - 1) / Math.max(1, maxVal - 1)) * (H - PAD * 2)
      : (v) => PAD + ((maxVal - v) / Math.max(1, maxVal - minVal)) * (H - PAD * 2);

    const polylines = [];
    const dots = [];
    const hits = [];
    visible.forEach((p, i) => {
      const color = LINE_COLORS[i % LINE_COLORS.length];
      const series = seriesMap.get(p.name).series;
      const pts = timeline.map((t, pi) => `${x(pi).toFixed(1)},${y(series[pi] || 0).toFixed(1)}`).join(' ');
      const last = lastPoint;
      const lx = x(last), ly = y(series[last] || 0);
      const isMe = p.name === AppState.currentUser?.name;
      polylines.push(`
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${isMe ? 3.2 : 2.2}" stroke-linecap="round" stroke-linejoin="round" opacity="${isMe ? 1 : 0.92}"/>
        <circle cx="${lx}" cy="${ly}" r="${isMe ? 5 : 4}" fill="${color}" stroke="#0F172A" stroke-width="1.5" class="stats-lastpoint" data-user="${esc(p.name)}" pointer-events="none"/>
        <circle cx="${lx}" cy="${ly}" r="12" fill="transparent" class="stats-lastpoint" data-user="${esc(p.name)}" pointer-events="none"/>`);
      timeline.forEach((t, pi) => {
        const px = x(pi), py = y(series[pi] || 0);
        const value = series[pi] || 0;
        dots.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="2" fill="${color}" opacity="0.9" pointer-events="none"/>`);
        hits.push(`<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="9" fill="transparent" pointer-events="all" class="stats-point-hit" data-user="${esc(p.name)}" data-stage="${esc(t.label)}" data-value="${value}"/>`);
      });
    });

    const ticks = buildAxisTicks(metric, maxVal, minVal);
    const strongValue = metric === 'posicion' ? 1 : 0;
    const gridLines = ticks.map(tick =>
      `<line x1="${PAD}" y1="${y(tick.value)}" x2="${W - PAD}" y2="${y(tick.value)}" stroke="${tick.value === strongValue ? '#334155' : '#1E293B'}" stroke-width="1"/>`
    ).join('');
    const axisLabels = ticks.map(tick =>
      `<text x="2" y="${(y(tick.value) + 2.5).toFixed(1)}" font-size="7.5" fill="#64748B" text-anchor="start">${tick.label}</text>`
    ).join('');

    const labels = timeline.map((t, i) =>
      `<text x="${x(i)}" y="${H - 6}" font-size="7.5" fill="#64748B" text-anchor="middle">${t.label}</text>`
    ).join('');

    return `
      <div class="stats-chart-wrap">
        <svg class="stats-line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          ${gridLines}
          ${polylines.join('')}
          ${dots.join('')}
          ${labels}
          ${axisLabels}
          ${hits.join('')}
        </svg>
        <div class="stats-evo-tooltip" role="status" aria-live="polite"></div>
      </div>`;
  }

  function buildLegend(players, visibleSet, seriesMap, opts) {
    const options = opts || {};
    const metric = options.metric || 'puntos';
    const timeline = options.timeline || buildTimeline();
    const lastIdx = Math.max(0, timeline.length - 1);
    const pointsMap = options.pointsMap || null;
    const visible = playersWithData(players, visibleSet, seriesMap);
    if (!visible.length) return `<div class="stats-legend">${statsEmpty('Añade jugadores para ver la leyenda')}</div>`;
    const sorted = [...visible].sort((a, b) => {
      const av = seriesMap.get(a.name).series[lastIdx] || 0;
      const bv = seriesMap.get(b.name).series[lastIdx] || 0;
      return metric === 'posicion' ? av - bv : bv - av;
    });
    const items = sorted.map(p => {
      const idx = visible.indexOf(p);
      const color = LINE_COLORS[idx % LINE_COLORS.length];
      const r = seriesMap.get(p.name);
      const value = r.series[lastIdx] || 0;
      const rank = sorted.indexOf(p) + 1;
      const detail = metric === 'posicion'
        ? `#${value} · ${pointsMap?.get(p.name)?.series?.[lastIdx] || 0} pts`
        : `${value} pts · #${rank}`;
      return `<button class="stats-legend-item" data-user="${esc(p.name)}" style="--legend-color:${color}" title="Ocultar/mostrar ${esc(p.name)}"><i style="background:${color}"></i>${esc(p.avatar||'⚽')} ${esc(p.name)}${porraGuest.guestBadgeHtml(p.isGuest)} · ${detail}</button>`;
    }).join('');
    return `<div class="stats-legend">${items}</div>`;
  }

  function jornadaPtsDeUsuario(aggregates, username) {
    return (aggregates.leaguePoints?.[username] || []).slice();
  }

  function resolveIndividualUsername(players) {
    const list = players || [];
    const wanted = AppState.estadisticasIndividualUser || AppState.currentUser?.name;
    if (list.some(p => p.name === wanted)) return wanted;
    const me = AppState.currentUser?.name;
    if (list.some(p => p.name === me)) return me;
    return list[0]?.name || null;
  }

  function individualOverallRank(realPointsByUser, username, splitByUser) {
    const users = Object.keys(realPointsByUser || {});
    if (!splitByUser) {
      const mine = realPointsByUser?.[username] || 0;
      let rank = 1;
      for (const u of users) {
        if ((realPointsByUser[u] || 0) > mine) rank++;
      }
      return rank;
    }
    const mine = toClasificacionRow(splitByUser[username]);
    let rank = 1;
    for (const u of users) {
      if (u === username) continue;
      if (compareIndividualRows(toClasificacionRow(splitByUser[u]), mine) < 0) rank++;
    }
    return rank;
  }

  /** Adapta un split {prediction,squad,classification,eliminatorias} al comparador de normas. */
  function toClasificacionRow(split) {
    const s = split || {};
    const prediction = s.prediction || 0;
    const squad = s.squad || 0;
    const classification = s.classification || 0;
    const eliminatorias = s.eliminatorias || 0;
    return {
      realPoints: prediction + squad + classification + eliminatorias,
      eliminatoriasPoints: eliminatorias,
      squadPoints: squad,
      classificationPoints: classification,
      predictionPoints: prediction
    };
  }

  function compareIndividualRows(a, b) {
    if (typeof clasificacionApi !== 'undefined' && clasificacionApi && clasificacionApi.compareClasificacionJugadores) {
      return clasificacionApi.compareClasificacionJugadores(a, b);
    }
    return (b.realPoints - a.realPoints)
      || (b.eliminatoriasPoints - a.eliminatoriasPoints)
      || (b.squadPoints - a.squadPoints)
      || (b.classificationPoints - a.classificationPoints)
      || (b.predictionPoints - a.predictionPoints)
      || 0;
  }

  /** Ordena jugadores para el selector Individual según la clasificación con desempate de normas. */
  function orderIndividualPlayers(players, splitByUser) {
    const splits = splitByUser || {};
    return [...(players || [])].sort((a, b) =>
      compareIndividualRows(toClasificacionRow(splits[a.name]), toClasificacionRow(splits[b.name])));
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
      <div class="stats-donut-hero">
        <svg class="stats-donut stats-donut-compact" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="${DONUT_RADIUS}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="18"/>
          ${circles}
          <text x="60" y="57" text-anchor="middle" class="stats-donut-total">${total}</text>
          <text x="60" y="72" text-anchor="middle" class="stats-donut-sub">puntos</text>
        </svg>
        <div class="stats-donut-side">
          <div class="stats-donut-legend compact">${legend}</div>
          <div class="stats-donut-vs">${comparativaHtml(split)}</div>
        </div>
      </div>`;
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

  function renderCoverageNote(aggregates) {
    const coverage = aggregates?.coverage;
    if (!coverage || !coverage.totalLeague) return '';
    const partial = coverage.partial ? '<span class="stats-pill gold">Datos parciales</span>' : '';
    return `<div class="stats-data-note">📊 ${coverage.playedLeague}/${coverage.totalLeague} partidos de liga · ${coverage.completedJornadas}/${coverage.totalJornadas} jornadas completas ${partial}</div>`;
  }

  function renderExactCard(exactStats) {
    const totals = exactStats?.totals || { played: 0, exact: 0, outcomeHits: 0, exactPct: 0 };
    if (!totals.played) {
      return `<div class="stats-card"><div class="stats-card-title">🎯 Exactos por jornada</div>${statsEmpty('Aún no hay partidos con resultado')}</div>`;
    }

    const rows = (exactStats.byJornada || []).map(row => {
      const pct = row.played ? Math.round((row.exact / row.played) * 100) : 0;
      const partial = row.complete ? '' : ' · parcial';
      return `<div class="stats-exact-row">
        <span class="stats-exact-lbl">J${row.ronda}</span>
        <div class="stats-exact-bar"><div style="width:${pct}%"></div></div>
        <span class="stats-exact-txt">${row.exact}/${row.played} · ${row.outcomeHits}/${row.played} 1X2${partial}</span>
      </div>`;
    }).join('');

    return `
      <div class="stats-card">
        <div class="stats-card-title">🎯 Exactos por jornada</div>
        <div class="stats-kpi-grid">
          <div class="stats-kpi"><div class="stats-kv">${totals.exact}</div><div class="stats-kl">exactos</div></div>
          <div class="stats-kpi"><div class="stats-kv">${totals.exactPct}%</div><div class="stats-kl">% exactos</div></div>
          <div class="stats-kpi"><div class="stats-kv">${totals.outcomeHits}</div><div class="stats-kl">aciertos 1X2</div></div>
        </div>
        <div class="stats-kpi-grid" style="grid-template-columns:repeat(2,1fr);margin-top:6px">
          <div class="stats-kpi"><div class="stats-kv">${exactStats.streaks?.currentExact ?? 0}</div><div class="stats-kl">racha actual</div></div>
          <div class="stats-kpi"><div class="stats-kv">${exactStats.streaks?.bestExact ?? 0}</div><div class="stats-kl">mejor racha</div></div>
        </div>
        <div class="stats-rank-sub" style="white-space:normal;margin-top:8px">Solo partidos válidos pronosticados. Los no pronosticados no penalizan.</div>
        <div class="stats-exact-rows">${rows}</div>
      </div>`;
  }

  function renderSourceRanksCard(username, sourceRanks) {
    const definitions = [
      ['total', 'Total'],
      ['prediction', 'Pronóst.'],
      ['squad', 'Plantilla'],
      ['classification', 'Clasif.'],
      ['eliminatorias', 'Elims.'],
    ];
    const mine = sourceRanks?.[username] || {};
    const rows = definitions.map(([key, label]) => {
      const row = mine[key];
      if (!row || !row.hasData || !row.rank) {
        return `<div class="stats-src-row"><span class="stats-src-lbl">${label}</span><div class="stats-src-bar"></div><span class="stats-src-val">—</span></div>`;
      }
      const fillPct = Math.max(0, Math.min(100, 100 - row.topPct));
      return `<div class="stats-src-row">
        <span class="stats-src-lbl">${label}</span>
        <div class="stats-src-bar"><div style="width:${fillPct}%"></div></div>
        <span class="stats-src-val">#${row.rank}/${row.n} · Top ${row.topPct}%</span>
      </div>`;
    }).join('');

    return `
      <div class="stats-card">
        <div class="stats-card-title">📊 Puesto por fuente</div>
        <div class="stats-src-rows">${rows}</div>
        <div class="stats-rank-sub" style="white-space:normal;margin-top:8px">Top X% = mejor posición relativa; los empates comparten puesto.</div>
      </div>`;
  }

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
    const zSign = style.luckZ > 0 ? '+' : '';
    const zText = style.luckZ === null ? '' : ` (z ${zSign}${style.luckZ})`;
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
        <div class="stats-rank-sub" style="white-space:normal;margin-top:8px">${luckLabelHtml(style.luckLabel)} Suerte/partido: ${style.luckPerMatch === null ? '—' : perSign + style.luckPerMatch}${zText} · ${style.excludedLowSample} partidos excluidos por muestra &lt;5.</div>
        <div class="stats-rank-sub" style="white-space:normal;margin-top:6px">Suerte neta = puntos reales − esperados. El esperado combina resultado (8), goles de cada equipo (3+3) y marcador exacto (1). Solo partidos con al menos 5 pronósticos de otros usuarios.</div>
        <div class="stats-rank-sub" style="white-space:normal;margin-top:6px">La etiqueta es relativa a la porra: afortunado = tu suerte/partido está al menos 1 desviación típica por encima de la media del grupo; desafortunado = al menos 1 por debajo.</div>
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

  function renderIndividualBody(aggregates) {
    const players = statsPlayers();
    const splitByUser = aggregates.splitByUser || {};
    const ordered = orderIndividualPlayers(players, splitByUser);
    const username = resolveIndividualUsername(ordered);
    if (!username) return statsEmpty('Sin usuarios disponibles');

    const options = ordered.map(p =>
      `<option value="${esc(p.name)}" ${p.name === username ? 'selected' : ''}>${esc(p.avatar || '⚽')} ${esc(p.name)}${porraGuest.guestBadgeHtml(p.isGuest)}</option>`
    ).join('');

    const rank = individualOverallRank(aggregates.realPointsByUser, username, splitByUser);

    const split = sourceSplitFromUserData(AppState.userPoints[username]?.totalPoints, getCachedUserData(username));
    const exactStats = calcExactStats(username, AppState.leagueMatches, aggregates.matchStatsById, AppState.allPredictions);
    const sourceRanks = aggregates.sourceRanks || {};
    const coverage = calcDataCoverage(AppState.matches, AppState.matchStats, AppState.allPredictions, username);

    const row = calcReliabilityRow(username, aggregates.playedMatches, AppState.allPredictions, AppState.userPoints);
    const fallidos = row.played - row.hits;
    const conversion = row.hits ? Math.round((row.exactScores / row.hits) * 100) : null;
    const extremes = calcMatchExtremes(
      username,
      aggregates.playedMatches,
      statsFilterMap(AppState.allPredictions),
      AppState.userPoints,
      aggregates.matchesById
    );
    const extremeRow = (label, item) => {
      if (!item) {
        return `<div class="stats-extreme"><div class="stats-extreme-top"><span class="stats-extreme-lbl">${label}</span><span class="stats-extreme-pts">—</span></div></div>`;
      }
      const cls = item.delta > 0 ? 'up' : item.delta < 0 ? 'dn' : '';
      const sign = item.delta > 0 ? '+' : '';
      const name = item.match
        ? `${esc(item.match.homeTeam || '')} – ${esc(item.match.awayTeam || '')}`
        : 'Partido';
      return `<div class="stats-extreme">
        <div class="stats-extreme-top">
          <span class="stats-extreme-lbl">${label}</span>
          <span class="stats-extreme-pts">${item.points} pts</span>
          <span class="stats-extreme-delta ${cls}">${sign}${item.delta} vs media</span>
        </div>
        <div class="stats-extreme-sub">${name} · media ${item.avg} (n=${item.sample})</div>
      </div>`;
    };
    const pronosticosCard = `
      <div class="stats-card">
        <div class="stats-card-title">⚽ Pronósticos (${row.played} partidos jugados)</div>
        ${row.played ? `
        <div class="stats-kpi-grid">
          <div class="stats-kpi"><div class="stats-kv">${row.hits}</div><div class="stats-kl">1X2 ✔</div></div>
          <div class="stats-kpi"><div class="stats-kv">${row.exactScores}</div><div class="stats-kl">exactos</div></div>
          <div class="stats-kpi"><div class="stats-kv">${fallidos}</div><div class="stats-kl">fallidos</div></div>
        </div>
        <div class="stats-rank-sub">% conversión de exactos: ${conversion === null ? '—' : conversion + '%'}</div>
        ${extremeRow('Mejor', extremes.best)}
        ${extremeRow('Peor', extremes.worst)}` : statsEmpty('Sin partidos pronosticados con resultado')}
      </div>`;

    const rondas = aggregates.completedRondas || [];
    const hist = aggregates.positionHistory?.[username] || [];
    const tops = aggregates.timesTopJornada?.[username] || 0;
    const userJornadaPts = jornadaPtsDeUsuario(aggregates, username);
    const bestJ = calcUserBestJornada(userJornadaPts);
    const mediaJ = userJornadaPts.length ? Math.round((userJornadaPts.reduce((a, b) => a + b, 0) / userJornadaPts.length) * 10) / 10 : null;
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

    const styleStats = aggregates.styleByUser?.[username] || calcStyleStats(
      username,
      aggregates.playedMatches,
      AppState.allPredictions,
      AppState.userPoints,
      aggregates.matchesById,
      statsPlayers().map(p => p.name)
    );

    const indAvatar = esc(getPlayerMeta(username).avatar || '⚽');
    return `
      <div class="stats-card">
        <div class="stats-ind-pill">
          <span class="stats-ind-avatar" aria-hidden="true">${indAvatar}</span>
          <select id="stats-ind-select" class="stats-ind-select-pill" aria-label="Seleccionar usuario">${options}</select>
          <span class="stats-ind-rank">#${rank}</span>
        </div>
        <div class="stats-rank-sub" style="white-space:normal;text-align:center;margin-top:6px">Pronósticos con resultado: ${coverage.userPredictedPlayed}/${coverage.playedLeague}</div>
      </div>
      <div class="stats-card">
        <div class="stats-card-title">🥧 Desglose de puntos</div>
        ${donutChartHtml(split)}
      </div>
      ${renderExactCard(exactStats)}
      ${renderSourceRanksCard(username, sourceRanks)}
      ${pronosticosCard}
      ${jornadasCard}
      ${sesgoCard}
      ${renderLuckCard(styleStats)}
      ${renderRobosFarolesCard(styleStats)}
      ${renderConfidenceCard(styleStats)}
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

    container.querySelectorAll('.stats-source[data-source]').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasPointType = btn.dataset.source;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-evo-metric').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasEvoMetric = btn.dataset.metric;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    container.querySelectorAll('.stats-evo-mode').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasEvoMode = btn.dataset.mode;
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
          statsPlayers().forEach(p => set.add(p.name));
        } else {
          set.clear();
        }
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    const chartWrap = container.querySelector('.stats-chart-wrap');
    const evoTooltip = chartWrap?.querySelector('.stats-evo-tooltip');
    const hideEvotooltip = () => { if (evoTooltip) evoTooltip.classList.remove('show'); };
    const showEvotooltip = (hit, evt) => {
      if (!chartWrap || !evoTooltip) return;
      const metric = AppState.estadisticasEvoMetric || EVO_METRIC_DEFAULT;
      const value = Number(hit.dataset.value) || 0;
      evoTooltip.textContent = buildPointTooltipText(hit.dataset.user, hit.dataset.stage, metric, value);
      evoTooltip.classList.add('show');
      const rect = chartWrap.getBoundingClientRect();
      const px = evt ? evt.clientX - rect.left : rect.width / 2;
      const py = evt ? evt.clientY - rect.top : rect.height / 2;
      const half = evoTooltip.offsetWidth / 2;
      const left = Math.min(Math.max(px, half + 4), rect.width - half - 4);
      evoTooltip.style.left = `${left}px`;
      if (py < 52) {
        evoTooltip.style.top = `${py + 14}px`;
        evoTooltip.classList.add('below');
      } else {
        evoTooltip.style.top = `${py - 10}px`;
        evoTooltip.classList.remove('below');
      }
    };
    container.querySelectorAll('.stats-point-hit').forEach(hit => {
      hit.addEventListener('pointerenter', (e) => showEvotooltip(hit, e));
      hit.addEventListener('pointermove', (e) => showEvotooltip(hit, e));
      hit.addEventListener('pointerleave', (e) => { if (e.pointerType !== 'touch') hideEvotooltip(); });
      hit.addEventListener('pointerdown', (e) => { e.stopPropagation(); showEvotooltip(hit, e); });
      hit.addEventListener('click', (e) => { e.stopPropagation(); showEvotooltip(hit, e); });
    });
    if (chartWrap) {
      chartWrap.addEventListener('pointerdown', (e) => {
        if (!e.target.closest('.stats-point-hit')) hideEvotooltip();
      });
    }

    const evoSearch = container.querySelector('#stats-evo-search');
    if (evoSearch) {
      evoSearch.addEventListener('input', () => {
        AppState.estadisticasEvoSearch = evoSearch.value;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
        const next = container.querySelector('#stats-evo-search');
        if (next) { next.focus(); const v = next.value; next.setSelectionRange(v.length, v.length); }
      });
    }
    container.querySelectorAll('[data-action="clear-search"]').forEach(btn => {
      btn.addEventListener('click', () => {
        AppState.estadisticasEvoSearch = '';
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });
    container.querySelectorAll('.stats-legend-item').forEach(item => {
      item.addEventListener('click', () => {
        const user = item.dataset.user;
        const set = AppState.estadisticasVisibleUsers;
        if (set.has(user)) set.delete(user); else set.add(user);
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
      item.addEventListener('mouseenter', () => {
        const user = item.dataset.user;
        container.querySelectorAll(`.stats-lastpoint[data-user="${CSS.escape(user)}"]`).forEach(c => {
          const orig = c.getAttribute('r');
          if (c.tagName.toLowerCase() === 'circle' && orig === '4') { c.setAttribute('r','6'); c.style.filter='drop-shadow(0 0 6px currentColor)'; }
        });
      });
      item.addEventListener('mouseleave', () => {
        container.querySelectorAll('.stats-lastpoint').forEach(c => {
          if (c.getAttribute('r') === '6') { c.setAttribute('r','4'); c.style.filter=''; }
        });
      });
    });
    container.querySelectorAll('.stats-ind-select-pill').forEach(sel => {
      sel.addEventListener('change', () => {
        AppState.estadisticasIndividualUser = sel.value;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });
    container.querySelectorAll('.stats-ind-select').forEach(sel => {
      sel.addEventListener('change', () => {
        AppState.estadisticasIndividualUser = sel.value;
        container.innerHTML = renderStatsContent();
        bindStatsEvents();
      });
    });

    function togglePronosticoCard(head){
      const card = head.closest('.stats-pronosticos-card');
      if (!card) return;
      const isOpen = card.classList.contains('open');
      container.querySelectorAll('.stats-pronosticos-card').forEach(c => {
        c.classList.remove('open');
        const h = c.querySelector('.stats-pronosticos-accordion-head');
        if (h) h.setAttribute('aria-expanded','false');
      });
      if (!isOpen) {
        card.classList.add('open');
        head.setAttribute('aria-expanded','true');
      }
    }
    container.querySelectorAll('.stats-pronosticos-accordion-head').forEach(head => {
      head.addEventListener('click', () => togglePronosticoCard(head));
      head.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePronosticoCard(head); }
      });
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
  global.toStagePoints = toStagePoints;
  global.calcEvolutionPositions = calcEvolutionPositions;
  global.calcEvolutionPositionsFromSplits = calcEvolutionPositionsFromSplits;
  global.lastTimelinePoint = lastTimelinePoint;
  global.trimTimeline = trimTimeline;
  global.buildEvolutionSeriesMap = buildEvolutionSeriesMap;
  global.buildAxisTicks = buildAxisTicks;
  global.formatPointValue = formatPointValue;
  global.buildPointTooltipText = buildPointTooltipText;
  global.EVO_METRIC_DEFAULT = EVO_METRIC_DEFAULT;
  global.EVO_MODE_DEFAULT = EVO_MODE_DEFAULT;
  global.positionForMatch = positionForMatch;
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
  global.calcExactStats = calcExactStats;
  global.calcSourceRanks = calcSourceRanks;
  global.calcMatchExtremes = calcMatchExtremes;
  global.calcDataCoverage = calcDataCoverage;
  global.buildMatchConsensus = buildMatchConsensus;
  global.expectedPointsForPrediction = expectedPointsForPrediction;
  global.calcStyleStats = calcStyleStats;
  global.calcLuckLabels = calcLuckLabels;
  global.calcPlayerExtremes = calcPlayerExtremes;
  global.buildDuelContext = buildDuelContext;
  global.calcDuelCategories = calcDuelCategories;
  global.calcDuelScore = calcDuelScore;
  global.buildDonutSegments = buildDonutSegments;
  global.calcPredictionBias = calcPredictionBias;
  global.calcBestMatch = calcBestMatch;
  global.calcBestPlayersByPosition = calcBestPlayersByPosition;
  global.calcMostProfitablePlayer = calcMostProfitablePlayer;
  global.sourceSplitFromUserData = sourceSplitFromUserData;
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
  global.renderPronosticosBody = renderPronosticosBody;
  global.renderPronosticosPartidosCard = renderPronosticosPartidosCard;
  global.renderPronosticosClasificacionCard = renderPronosticosClasificacionCard;
  global.renderPronosticosEliminatoriasCard = renderPronosticosEliminatoriasCard;
  global.renderPronosticosPlantillaCard = renderPronosticosPlantillaCard;
  global.orderIndividualPlayers = orderIndividualPlayers;
  global.individualOverallRank = individualOverallRank;
  global.renderStatsContent = renderStatsContent;
  global.buildStatsAggregates = buildStatsAggregates;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { emptySeries, buildTimeline, calcPredictionSeries, calcSquadSeries, calcClassificationSeries, calcEliminatoriasSeries, sumSeries, isLeagueComplete, getSeriesBySource, matchResultOf, toStagePoints, calcEvolutionPositions, calcEvolutionPositionsFromSplits, lastTimelinePoint, trimTimeline, buildEvolutionSeriesMap, buildAxisTicks, formatPointValue, buildPointTooltipText, EVO_METRIC_DEFAULT, EVO_MODE_DEFAULT, positionForMatch, extractPlayedMatches, calcReliabilityRow, buildCompletedLeagueData, calcStreaks, calcBestJornadas, calcUserBestJornada, calcPositionHistory, calcTimesTopJornada, calcMomentum, calcConsistency, calcExactStats, calcSourceRanks, calcMatchExtremes, calcDataCoverage, buildMatchConsensus, expectedPointsForPrediction, calcStyleStats, calcLuckLabels, calcPlayerExtremes, buildDuelContext, calcDuelCategories, calcDuelScore, buildDonutSegments, calcPredictionBias, calcBestMatch, calcBestPlayersByPosition, calcMostProfitablePlayer, sourceSplitFromUserData, tallyChampions, finalPredictionTeamIds, compareQuadroWithCommunity, aggregateSquads, calcPronosticosPartidosStats, getTeamStatsForPreds, calcPredictedStandingsForPreds, calcClasificacionPronosticosStats, calcEliminatoriasPronosticosStats, calcPlantillaPronosticosExtras, renderPronosticosBody, renderPronosticosPartidosCard, renderPronosticosClasificacionCard, renderPronosticosEliminatoriasCard, renderPronosticosPlantillaCard, renderStatsContent, buildStatsAggregates, orderIndividualPlayers, individualOverallRank };
  }
})(typeof window !== 'undefined' ? window : globalThis);
