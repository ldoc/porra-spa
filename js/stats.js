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

  function calcReliabilityRows(players, playedMatches, allPredictions, userPoints) {
    const rows = [];
    for (const p of players || []) {
      rows.push(calcReliabilityRow(p.name, playedMatches, allPredictions, userPoints));
    }
    rows.sort((a, b) =>
      b.pctResult - a.pctResult ||
      b.ptsPerMatch - a.ptsPerMatch ||
      String(a.username).localeCompare(String(b.username))
    );
    return rows;
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

  const SOURCES = [
    { key: 'total', label: 'Total' },
    { key: 'pronosticos', label: 'Pronóst.' },
    { key: 'plantilla', label: 'Plantilla' },
    { key: 'clasificacion', label: 'Clasif.' },
    { key: 'eliminatorias', label: 'Eliminat.' },
  ];
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
      const r = getSeriesBySource(source, buildUserData(p.name, reachedPhases, matchesById));
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
    if (!AppState.estadisticasPointType) AppState.estadisticasPointType = 'total';
    if (!AppState.estadisticasVisibleUsers) {
      const me = AppState.currentUser?.name;
      const top = orderPlayers(seriesMap).slice(0, 3).map(p => p.name);
      AppState.estadisticasVisibleUsers = new Set([me, ...top].filter(Boolean));
    }
  }

  function renderStatsContent() {
    const source = AppState.estadisticasPointType || 'total';
    const reachedPhases = computeReachedPhases(AppState.matches, AppState.matchStats);
    const matchesById = buildMatchesById();
    const seriesMap = buildSeriesMap(source, reachedPhases, matchesById);
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

  function bindStatsEvents() {
    const container = document.getElementById('estadisticas-container');
    if (!container) return;

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
  global.calcReliabilityRows = calcReliabilityRows;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { emptySeries, buildTimeline, calcPredictionSeries, calcSquadSeries, calcClassificationSeries, calcEliminatoriasSeries, sumSeries, isLeagueComplete, getSeriesBySource, matchResultOf, extractPlayedMatches, calcReliabilityRow, calcReliabilityRows };
  }
})(typeof window !== 'undefined' ? window : globalThis);
