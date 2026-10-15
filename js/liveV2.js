(function (global) {
  'use strict';

  function newPlayer(id) {
    return { id, equipo: null, rating: 6, goals: 0, assists: 0, penaltyScored: 0,
      penaltySaved: 0, cards: [], onPitch: false, entryMinute: 0, exitMinute: null, goalsReceived: 0 };
  }

  function createMatchState() {
    return { status: 'NS', score: { home: 0, away: 0 }, period: null,
      kickoffTs: null, htTs: null, ftTs: null, goals: [], players: {} };
  }

  function ensure(state, id) {
    if (id == null) return null;
    if (!state.players[id]) state.players[id] = newPlayer(id);
    return state.players[id];
  }

  // lado al que acredita el gol (own goal invierte)
  function creditedHome(payload) {
    return payload.isOwnGoal ? !payload.isHome : !!payload.isHome;
  }

  function applyEvent(state, ev, ctx) {
    const p = ev.payload || {};
    switch (ev.type) {
      case 'lineup':
        for (const id of p.starters || []) { const pl = ensure(state, id); pl.onPitch = true; pl.entryMinute = 0; }
        break;
      case 'status':
        state.status = p.status || state.status;
        state.period = p.period || state.period;
        if (p.status === 'LIVE' && !state.kickoffTs) state.kickoffTs = ev.ts || null;
        if (p.status === 'HT') state.htTs = ev.ts || null;
        if (p.status === 'FT') state.ftTs = ev.ts || null;
        break;
      case 'goal': {
        const home = creditedHome(p);
        const scorer = ensure(state, p.scorerId);
        if (scorer && !p.isOwnGoal) scorer.goals += 1;
        if (p.isPenalty && scorer && !p.isOwnGoal) scorer.penaltyScored += 1;
        state.goals.push({ sourceId: ev.sourceId, home, scorerId: p.scorerId ?? null, cancelled: false });
        if (home) state.score.home += 1; else state.score.away += 1;
        break;
      }
      case 'goal_cancelled': {
        const g = state.goals.find(x => x.sourceId === p.ofSourceId);
        if (g && !g.cancelled) {
          g.cancelled = true;
          if (g.home) state.score.home = Math.max(0, state.score.home - 1);
          else state.score.away = Math.max(0, state.score.away - 1);
          const scorer = g.scorerId != null ? state.players[g.scorerId] : null;
          if (scorer) scorer.goals = Math.max(0, scorer.goals - 1);
        }
        break;
      }
      case 'penalty_saved': { const gk = ensure(state, p.keeperId); if (gk) gk.penaltySaved += 1; break; }
      case 'assist': { const a = ensure(state, ev.playerId); if (a) a.assists = p.asistencias ?? (a.assists + 1); break; }
      case 'card': { const c = ensure(state, ev.playerId); if (c) c.cards.push(p.cardType || 'yellow'); break; }
      case 'substitution': {
        const out = ensure(state, p.outId); if (out) { out.onPitch = false; out.exitMinute = ev.minute ?? null; }
        const inn = ensure(state, p.inId); if (inn) { inn.onPitch = true; inn.entryMinute = ev.minute ?? 0; }
        break;
      }
      case 'rating': { const pl = ensure(state, ev.playerId); if (pl) pl.rating = p.rating; break; }
      case 'score': state.score = { home: p.scoreHome ?? state.score.home, away: p.scoreAway ?? state.score.away }; break;
      case 'match_final': {
        state.status = 'FT';
        if (p.scoreHome != null) state.score = { home: p.scoreHome, away: p.scoreAway };
        for (const [id, r] of Object.entries(p.ratings || {})) { const pl = ensure(state, Number(id)); if (pl) pl.rating = r; }
        for (const [id, m] of Object.entries(p.minutes || {})) { const pl = ensure(state, Number(id)); if (pl) { pl.authoritativeMinutes = m; } }
        break;
      }
      default: break;
    }
    // asignar equipo a cada jugador tocado no es trivial sin ctx de plantilla; lo resuelve matchStateToStats con ctx.
    return state;
  }

  function matchClockAt(state, playheadTs) {
    if (!state.kickoffTs || state.status === 'NS') return null;
    const start = new Date(state.kickoffTs).getTime();
    const end = playheadTs;
    let mins = Math.floor((end - start) / 60000);
    if (state.htTs && new Date(state.htTs).getTime() <= end) {
      const resumed = state.period && state.period !== 'period1' && state.period !== 'halftime';
      if (resumed) mins -= 15; else mins = Math.min(mins, 45); // durante el descanso, tope 45'
    }
    return Math.max(0, mins);
  }

  function minutesOf(state, playerId, playheadTs) {
    const p = state.players[playerId];
    if (!p) return 0;
    if (p.authoritativeMinutes != null) return p.authoritativeMinutes;
    const clock = matchClockAt(state, playheadTs);
    const end = p.onPitch ? (clock == null ? (p.entryMinute || 0) : clock) : (p.exitMinute || 0);
    return Math.max(0, end - (p.entryMinute || 0));
  }

  function byTs(a, b) { return new Date(a.ts) - new Date(b.ts); }

  function foldMatch(events, ctx) {
    const state = createMatchState();
    for (const ev of [...events].sort(byTs)) applyEvent(state, ev, ctx);
    return state;
  }

  function foldAll(events, ctxById) {
    const groups = {};
    for (const ev of events) (groups[ev.eventId] = groups[ev.eventId] || []).push(ev);
    const out = {};
    for (const [id, list] of Object.entries(groups)) out[id] = foldMatch(list, ctxById[id] || {});
    return out;
  }

  function stateAt(events, T, ctxById) {
    return foldAll(events.filter(e => new Date(e.ts).getTime() <= T), ctxById);
  }

  function matchStateToStats(state, ctx, playheadTs) {
    const playhead = playheadTs != null ? playheadTs : Date.now();
    const jugadores = Object.values(state.players).map(pl => {
      const meta = (ctx.playersById && ctx.playersById[pl.id]) || {};
      const esPortero = meta.posicion === 'G';
      let golesRecibidos = pl.goalsReceived;
      if (esPortero && meta.equipo != null) {
        golesRecibidos = meta.equipo === ctx.homeTeamId ? state.score.away
                       : meta.equipo === ctx.awayTeamId ? state.score.home
                       : golesRecibidos;
      }
      return {
        id: String(pl.id),
        nombre: meta.nombre || String(pl.id),
        posicion: meta.posicion || null,
        equipo: meta.equipo ?? null,
        puntos: pl.rating,
        goles: pl.goals,
        minutos: minutesOf(state, pl.id, playhead),
        paradas: 0,
        esSuplente: !pl.onPitch && (pl.entryMinute || 0) > 0,
        penaltiMarcado: pl.penaltyScored,
        penaltiParado: pl.penaltySaved,
        golesRecibidos,
        asistencias: pl.assists
      };
    });
    return {
      [ctx.homeTeamId]: { goles: state.score.home },
      [ctx.awayTeamId]: { goles: state.score.away },
      jugadores
    };
  }

  function rankRows(rows, prevRankByName) {
    const sorted = [...rows].sort((a, b) => b.livePoints - a.livePoints || a.name.localeCompare(b.name));
    return sorted.map((r, i) => {
      const rank = i + 1;
      const prev = prevRankByName ? prevRankByName[r.name] : null;
      return { ...r, rank, delta: prev ? prev - rank : 0 };
    });
  }

  function reasonLabel(event, ctx) {
    const c = ctx || {};
    const min = event.minute != null ? `${event.minute}' ` : '';
    const d = c.delta != null ? c.delta : 0;
    const scorer = c.scorer || event.playerName || 'un jugador';
    switch (event.type) {
      case 'goal': return { icon: '⚽', text: `${min}Gol de ${scorer}`, delta: d };
      case 'goal_cancelled': return { icon: '↩️', text: `${min}Gol anulado · VAR`, delta: d };
      case 'penalty_saved': return { icon: '🧤', text: `${min}Penalti parado`, delta: d };
      case 'assist': return { icon: '🅰️', text: `${min}Asistencia`, delta: d };
      case 'rating': return { icon: d >= 0 ? '📈' : '📉', text: `${min}Nota del jugador`, delta: d };
      default: return null;
    }
  }

  function flipDelta(firstRects, lastRects) {
    const out = {};
    for (const id of Object.keys(lastRects)) {
      if (firstRects[id]) out[id] = firstRects[id].top - lastRects[id].top;
    }
    return out;
  }

  const liveV2Api = { createMatchState, applyEvent, newPlayer, matchClockAt, minutesOf, foldMatch, foldAll, stateAt, matchStateToStats, rankRows, reasonLabel, flipDelta };
  global.liveV2Api = liveV2Api;
  if (typeof module !== 'undefined' && module.exports) module.exports = liveV2Api;
})(typeof window !== 'undefined' ? window : globalThis);
