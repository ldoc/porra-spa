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
          ${key === myResult ? '<span class="hoy-badge">★ tu pronóstico</span>' : ''}
        </div>`;
    }).join('');

    const bestNote = best
      ? `<div class="hoy-best-note">⚡ <strong>Mejor para ti: ${esc(bestNameOf(best.result, homeTeam, awayTeam))}</strong> — si aciertas este resultado ganas <strong>≈ ${best.advantage.toFixed(1)} pts sobre la media</strong>.</div>`
      : '';

    const realNote = real
      ? `<div class="hoy-real-note"><b>Resultado real: ${real.home} - ${real.away}</b> · Acertaron el resultado: ${counts.counts[realResult]}/${counts.total} (${Math.round(counts.pct[realResult] * 100)}%)</div>`
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

  const hoyPartidosApi = {
    isHoyPartidosAllowed, getMatchResult, getTodayMatches,
    computeResultCounts, computeBestResult, getRealResult,
    calcMatchPoints, formatMatchTime, esc,
    buildMatchCardHtml, buildStatsHtml, renderHoyPartidos
  };
  global.hoyPartidosApi = hoyPartidosApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = hoyPartidosApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
