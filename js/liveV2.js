(function (global) {
  'use strict';

  function newPlayer(id) {
    return { id, equipo: null, rating: 6, goals: 0, assists: 0, penaltyScored: 0,
      penaltySaved: 0, cards: [], onPitch: false, entered: false, entryMinute: 0, exitMinute: null, goalsReceived: 0 };
  }

  function createMatchState() {
    return { status: 'NS', score: { home: 0, away: 0 }, period: null,
      kickoffTs: null, htTs: null, ftTs: null, lastMinute: null, goals: [], players: {} };
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
        for (const id of p.starters || []) { const pl = ensure(state, id); pl.onPitch = true; pl.entered = true; pl.entryMinute = 0; }
        break;
      case 'status':
        state.status = p.status || state.status;
        state.period = p.period || state.period;
        if (p.kickoffTs) state.kickoffTs = p.kickoffTs;
        else if (p.status === 'LIVE' && !state.kickoffTs) state.kickoffTs = ev.ts || null;
        if (p.status === 'HT') state.htTs = ev.ts || null;
        if (p.status === 'FT') state.ftTs = ev.ts || null;
        if (ev.minute != null) state.lastMinute = ev.minute;
        break;
      case 'goal': {
        const home = creditedHome(p);
        const scorer = ensure(state, p.scorerId);
        if (scorer && !p.isOwnGoal) scorer.goals += 1;
        if (p.isPenalty && scorer && !p.isOwnGoal) scorer.penaltyScored += 1;
        state.goals.push({ sourceId: ev.sourceId, home, scorerId: p.scorerId ?? null, penalty: !!p.isPenalty, ownGoal: !!p.isOwnGoal, cancelled: false, minute: ev.minute ?? null });
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
          if (scorer && !g.ownGoal) {
            scorer.goals = Math.max(0, scorer.goals - 1);
            if (g.penalty && scorer.penaltyScored > 0) scorer.penaltyScored -= 1;
          }
        }
        break;
      }
      case 'penalty_saved': { const gk = ensure(state, p.keeperId); if (gk) gk.penaltySaved += 1; break; }
      case 'assist': { const a = ensure(state, ev.playerId); if (a) a.assists = p.asistencias ?? (a.assists + 1); break; }
      case 'card': {
        const c = ensure(state, ev.playerId);
        if (c) {
          const type = p.cardType || 'yellow';
          c.cards.push(type);
          if (type === 'red' || type === 'yellowRed' || type === 'secondYellow') {
            c.onPitch = false;
            c.exitMinute = ev.minute ?? null;
          }
        }
        break;
      }
      case 'substitution': {
        const out = ensure(state, p.outId); if (out) { out.onPitch = false; out.exitMinute = ev.minute ?? null; }
        const inn = ensure(state, p.inId); if (inn) { inn.onPitch = true; inn.entered = true; inn.entryMinute = ev.minute ?? 0; }
        break;
      }
      case 'rating': { const pl = ensure(state, ev.playerId); if (pl) pl.rating = p.rating; break; }
      case 'score': state.score = { home: p.scoreHome ?? state.score.home, away: p.scoreAway ?? state.score.away }; break;
      case 'match_final': {
        state.status = 'FT';
        if (p.scoreHome != null) state.score = { home: p.scoreHome, away: p.scoreAway };
        if (state.lastMinute == null && ev.minute != null) state.lastMinute = ev.minute;
        if (!state.ftTs) state.ftTs = ev.ts || null;
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
    if (state.status === 'FT' || state.ftTs) return state.lastMinute != null ? state.lastMinute : 90;
    const start = new Date(state.kickoffTs).getTime();
    const end = playheadTs != null ? playheadTs : Date.now();
    let mins = Math.floor((end - start) / 60000);
    if (state.period && state.period !== 'period1' && state.period !== 'halftime') {
      mins -= 15;
    } else if (state.htTs && new Date(state.htTs).getTime() <= end) {
      mins = Math.min(mins, 45); // durante el descanso, tope 45'
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

  /** Clave de dedupe de un evento: la API de fase 3 ya no envía `_id`. */
  function eventKey(e) { return String(e.eventId) + '|' + String(e.sourceId); }

  /**
   * Solo en local (localhost/127.0.0.1) y con `?liveSim=1`, pide los eventos del
   * simulador (`source=sim`). En producción/cualquier otro host siempre false.
   */
  function wantSimSource(search, hostname) {
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return false;
    try { return new URLSearchParams(search || '').get('liveSim') === '1'; }
    catch { return false; }
  }

  function parseTs(v) {
    if (v == null) return 0;
    const t = v instanceof Date ? v.getTime() : new Date(v).getTime();
    return isNaN(t) ? 0 : t;
  }

  // Orden determinista de plegado: `ts` (eje del timeline, minuto), `ingestedAt`
  // (instante de detección monótono), `seq`, tipo y, por último, `sourceId`.
  // `score` y `match_final` van después de goles/anulaciones para que el marcador
  // autoritativo no se aplique antes de los eventos que lo modifican.
  function typeRank(t) {
    if (t === 'goal') return 1;
    if (t === 'goal_cancelled') return 2;
    if (t === 'score') return 3;
    if (t === 'match_final') return 4;
    return 1;
  }

  function byTs(a, b) {
    const d = parseTs(a.ts) - parseTs(b.ts);
    if (d !== 0) return d;
    const ing = parseTs(a.ingestedAt) - parseTs(b.ingestedAt);
    if (ing !== 0) return ing;
    const seq = (Number(a.seq) || 0) - (Number(b.seq) || 0);
    if (seq !== 0) return seq;
    const tr = typeRank(a.type) - typeRank(b.type);
    if (tr !== 0) return tr;
    const sa = String(a.sourceId || '');
    const sb = String(b.sourceId || '');
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  }

  function sortEvents(events) { return [...(events || [])].sort(byTs); }

  function foldMatch(events, ctx) {
    const state = createMatchState();
    for (const ev of sortEvents(events)) applyEvent(state, ev, ctx);
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
    const concededByTeam = {
      [ctx.homeTeamId]: state.score.away,
      [ctx.awayTeamId]: state.score.home
    };
    // Un solo portero recibe los goles encajados por equipo: el que está en el campo
    // en el playhead; si ninguno lo está, el de más minutos. Nunca se carga el mismo
    // gol a dos porteros (p. ej. tras un cambio de portero).
    const gkByTeam = {};
    for (const pl of Object.values(state.players)) {
      const meta = (ctx.playersById && ctx.playersById[pl.id]) || {};
      if (meta.posicion !== 'G' || meta.equipo == null) continue;
      const team = String(meta.equipo);
      if (team !== String(ctx.homeTeamId) && team !== String(ctx.awayTeamId)) continue;
      const cand = { id: pl.id, onPitch: !!pl.onPitch, mins: minutesOf(state, pl.id, playhead) };
      const cur = gkByTeam[team];
      if (!cur
        || (cand.onPitch && !cur.onPitch)
        || (cand.onPitch === cur.onPitch && cand.mins > cur.mins)) {
        gkByTeam[team] = cand;
      }
    }
    const gkIdByTeam = {};
    for (const [team, gk] of Object.entries(gkByTeam)) gkIdByTeam[team] = gk.id;

    // Goles encajados por cada portero según quién estaba en el campo en el minuto
    // del gol. Así un cambio de portero reparte los goles como lo hace matchStats.
    const concededByGk = {};
    const gkAtMinute = (teamId, minute) => {
      if (minute == null) return null;
      const cands = [];
      for (const pl of Object.values(state.players)) {
        const meta = (ctx.playersById && ctx.playersById[String(pl.id)]) || {};
        if (meta.posicion !== 'G' || meta.equipo == null) continue;
        if (String(meta.equipo) !== String(teamId)) continue;
        if (!pl.entered) continue;
        const start = pl.entryMinute || 0;
        const end = pl.exitMinute == null ? Infinity : pl.exitMinute;
        if (minute < start || minute > end) continue;
        cands.push({ id: pl.id, start });
      }
      if (!cands.length) return null;
      cands.sort((a, b) => b.start - a.start);
      return cands[0].id;
    };
    for (const g of state.goals) {
      if (g.cancelled) continue;
      const team = g.home ? ctx.awayTeamId : ctx.homeTeamId; // equipo que encaja
      const gkId = gkAtMinute(team, g.minute);
      if (gkId != null) {
        const k = String(gkId);
        concededByGk[k] = (concededByGk[k] || 0) + 1;
      }
    }
    const attributedByTeam = {};
    for (const pl of Object.values(state.players)) {
      const meta = (ctx.playersById && ctx.playersById[String(pl.id)]) || {};
      if (meta.posicion !== 'G' || meta.equipo == null) continue;
      const team = String(meta.equipo);
      attributedByTeam[team] = (attributedByTeam[team] || 0) + (concededByGk[String(pl.id)] || 0);
    }
    const unattributedByTeam = {};
    for (const team of Object.keys(concededByTeam)) {
      unattributedByTeam[team] = Math.max(0, (concededByTeam[team] || 0) - (attributedByTeam[team] || 0));
    }
    const jugadores = Object.values(state.players).map(pl => {
      const meta = (ctx.playersById && ctx.playersById[pl.id]) || {};
      const esPortero = meta.posicion === 'G';
      let golesRecibidos = pl.goalsReceived;
      if (esPortero && meta.equipo != null) {
        const team = String(meta.equipo);
        const own = concededByGk[String(pl.id)] || 0;
        const responsible = gkIdByTeam[team];
        const extra = String(responsible) === String(pl.id) ? (unattributedByTeam[team] || 0) : 0;
        golesRecibidos = own + extra;
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
        asistencias: pl.assists,
        expulsado: pl.cards.some(c => c === 'red' || c === 'yellowRed' || c === 'secondYellow')
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
    const scorerSuffix = c.scorer && c.scorer !== 'un jugador' ? ` de ${c.scorer}` : '';
    const isRed = event.payload?.cardType === 'red'
      || event.payload?.cardType === 'yellowRed'
      || event.payload?.cardType === 'secondYellow';
    switch (event.type) {
      case 'goal': return { icon: '⚽', text: `${min}Gol de ${scorer}`, delta: d };
      case 'goal_cancelled': return { icon: '↩️', text: `${min}Gol anulado · VAR`, delta: d };
      case 'penalty_saved': return { icon: '🧤', text: `${min}Penalti parado`, delta: d };
      case 'assist': return { icon: '🅰️', text: `${min}Asistencia${scorerSuffix}`, delta: d };
      case 'rating': return { icon: d >= 0 ? '📈' : '📉', text: `${min}Nota del jugador`, delta: d };
      case 'score': return { icon: '🔧', text: `${min}Corrección de marcador`, delta: d };
      case 'match_final': return { icon: '🏁', text: `${min}Final del partido`, delta: d };
      case 'substitution': return { icon: '🔁', text: `${min}Cambio`, delta: d };
      case 'card': return {
        icon: isRed ? '🟥' : '🟨',
        text: `${min}${isRed ? 'Roja' : 'Tarjeta'}${scorerSuffix}`,
        delta: d
      };
      default: return null;
    }
  }

  // id del jugador protagonista de un evento (los eventos del backend NO traen
  // playerName; el nombre se resuelve vía playersById a partir de estos ids).
  function eventScorerId(ev) {
    if (!ev) return null;
    const p = ev.payload || {};
    switch (ev.type) {
      case 'goal': return p.scorerId != null ? p.scorerId : (ev.playerId != null ? ev.playerId : null);
      case 'assist': return ev.playerId != null ? ev.playerId : null;
      case 'penalty_saved': return p.keeperId != null ? p.keeperId : null;
      case 'rating': return ev.playerId != null ? ev.playerId : null;
      default: return ev.playerId != null ? ev.playerId : null;
    }
  }

  function eventPlayerName(ev, playersById) {
    const pid = eventScorerId(ev);
    if (pid == null || !playersById) return null;
    const meta = playersById[String(pid)];
    return meta && meta.nombre ? meta.nombre : null;
  }

  /** reasonLabel resolviendo el nombre del protagonista desde playersById. */
  function liveV2ReasonForEvent(ev, playersById, delta) {
    const scorer = eventPlayerName(ev, playersById) || 'un jugador';
    return reasonLabel(ev, { scorer, delta: delta != null ? delta : 0 });
  }

  /** Etiqueta compacta para el feed de última hora (cubre más tipos que reasonLabel). */
  function feedLabel(ev, playersById) {
    if (!ev) return null;
    const p = ev.payload || {};
    const min = ev.minute != null ? `${ev.minute}' ` : '';
    const nameOf = (id) => {
      if (id == null || !playersById) return null;
      const meta = playersById[String(id)];
      return meta && meta.nombre ? meta.nombre : null;
    };
    switch (ev.type) {
      case 'goal': {
        const n = nameOf(p.scorerId != null ? p.scorerId : ev.playerId);
        return { icon: '⚽', text: n ? `${min}Gol de ${n}` : `${min}Gol` };
      }
      case 'goal_cancelled': return { icon: '↩️', text: `${min}Gol anulado · VAR` };
      case 'penalty_saved': {
        const n = nameOf(p.keeperId);
        return { icon: '🧤', text: n ? `${min}Penalti parado por ${n}` : `${min}Penalti parado` };
      }
      case 'penalty_missed': {
        const n = nameOf(p.takerId);
        return { icon: '❌', text: n ? `${min}Penalti fallado · ${n}` : `${min}Penalti fallado` };
      }
      case 'assist': {
        const n = nameOf(ev.playerId);
        return { icon: '🅰️', text: n ? `${min}Asistencia de ${n}` : `${min}Asistencia` };
      }
      case 'card': {
        const red = p.cardType === 'red' || p.cardType === 'yellowRed' || p.cardType === 'secondYellow';
        const n = nameOf(ev.playerId);
        return { icon: red ? '🟥' : '🟨', text: n ? `${min}${red ? 'Roja' : 'Amarilla'} · ${n}` : `${min}${red ? 'Roja' : 'Amarilla'}` };
      }
      case 'substitution': return { icon: '🔁', text: `${min}Cambio` };
      case 'rating': {
        const n = nameOf(ev.playerId);
        return { icon: '⭐', text: n ? `${min}Nota · ${n}` : `${min}Nota` };
      }
      case 'status': {
        const s = p.status;
        const txt = s === 'HT' ? 'Descanso' : s === 'FT' ? 'Final' : s === 'LIVE' ? 'En juego' : '';
        return txt ? { icon: '●', text: txt } : null;
      }
      case 'score': return { icon: '🔧', text: 'Corrección de marcador' };
      case 'match_final': return { icon: '🏁', text: 'Final del partido' };
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

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g,
      c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  const FEED_TYPES = new Set([
    'goal', 'goal_cancelled', 'card',
    'penalty_saved', 'penalty_missed', 'substitution',
  ]);

  function formatMinute(minute, addedTime) {
    if (minute == null) return '';
    return `${minute}${addedTime ? `+${addedTime}` : ''}'`;
  }

  function playerName(id, playersById) {
    const meta = id != null && playersById ? playersById[String(id)] : null;
    return meta && meta.nombre ? meta.nombre : (id != null ? `Jugador #${id}` : null);
  }

  function feedTeamName(ev, playerId, playersById, ctx, preferPlayerTeam) {
    if (!ctx) return null;
    const meta = playerId != null && playersById ? playersById[String(playerId)] : null;
    const teamId = preferPlayerTeam && meta && meta.equipo != null
      ? meta.equipo
      : (ev.teamId != null ? ev.teamId : (meta ? meta.equipo : null));
    if (teamId == null) return null;
    if (String(teamId) === String(ctx.homeTeamId)) return ctx.homeTeam || null;
    if (String(teamId) === String(ctx.awayTeamId)) return ctx.awayTeam || null;
    return null;
  }

  function feedScore(ev, ctx, useGoalScore) {
    const p = ev.payload || {};
    const scoreHome = useGoalScore && p.scoreHome != null ? p.scoreHome : (ctx ? ctx.scoreHome : 0);
    const scoreAway = useGoalScore && p.scoreAway != null ? p.scoreAway : (ctx ? ctx.scoreAway : 0);
    return { scoreHome, scoreAway };
  }

  function assistText(ids, playersById) {
    if (!Array.isArray(ids)) return null;
    const names = ids.map(id => playerName(id, playersById)).filter(Boolean);
    if (!names.length) return null;
    if (names.length === 1) return `asistencia de ${names[0]}`;
    if (names.length === 2) return `asistencias de ${names[0]} y ${names[1]}`;
    return `asistencias de ${names[0]}, ${names[1]} y ${names.length - 2} más`;
  }

  function feedBase(ev, ctx, useGoalScore) {
    return {
      key: eventKey(ev),
      type: ev.type,
      minuteText: formatMinute(ev.minute, ev.addedTime),
      match: {
        eventId: ev.eventId,
        homeTeam: ctx ? ctx.homeTeam || null : null,
        awayTeam: ctx ? ctx.awayTeam || null : null,
        homeBadge: ctx ? ctx.homeBadge || null : null,
        awayBadge: ctx ? ctx.awayBadge || null : null,
        ...feedScore(ev, ctx, useGoalScore),
      },
    };
  }

  function isValidFeedTs(ev) {
    if (!ev || ev.ts == null) return false;
    if (typeof ev.ts === 'string' && !ev.ts.trim()) return false;
    return isFinite(new Date(ev.ts).getTime());
  }

  function isValidFeedEvent(ev) {
    return !!ev && FEED_TYPES.has(ev.type) && isValidFeedTs(ev);
  }

  /** true si `a` es una versión más reciente de la misma clave que `b`. */
  function isLaterDuplicate(a, b) {
    const ingA = parseTs(a.ingestedAt);
    const ingB = parseTs(b.ingestedAt);
    if (ingA !== ingB) return ingA > ingB;
    const tsA = parseTs(a.ts);
    const tsB = parseTs(b.ts);
    if (tsA !== tsB) return tsA > tsB;
    const seqA = Number(a.seq) || 0;
    const seqB = Number(b.seq) || 0;
    if (seqA !== seqB) return seqA > seqB;
    return String(a.sourceId || '') >= String(b.sourceId || '');
  }

  /**
   * Entrada canónica única por eventId|sourceId. Dedupe y resolución de
   * `goal_cancelled` comparten este mismo mapa para no discrepar entre polls.
   */
  function canonicalEventsByKey(events) {
    const byKey = new Map();
    for (const e of (Array.isArray(events) ? events : [])) {
      if (!e) continue;
      const key = eventKey(e);
      const cur = byKey.get(key);
      if (!cur || isLaterDuplicate(e, cur)) byKey.set(key, e);
    }
    return byKey;
  }

  function feedEventView(ev, ctx, playersById, byKey) {
    if (!isValidFeedEvent(ev)) return null;
    const p = ev.payload || {};
    const base = feedBase(ev, ctx, ev.type === 'goal');

    if (ev.type === 'goal') {
      const scorerId = p.scorerId != null ? p.scorerId : ev.playerId;
      const own = !!p.isOwnGoal;
      const details = [];
      const assist = own ? null : assistText(p.assistPlayerIds, playersById);
      if (assist) details.push(assist);
      if (p.isPenalty) details.push('penalti');
      return {
        ...base, icon: '⚽', tone: 'goal', playerId: scorerId,
        text: `${own ? 'Gol en propia de' : 'Gol de'} ${playerName(scorerId, playersById) || 'un jugador'}`,
        teamName: feedTeamName(ev, scorerId, playersById, ctx, true),
        detail: details.length ? details.join(' · ') : null,
      };
    }

    if (ev.type === 'goal_cancelled') {
      const origKey = p.ofSourceId != null
        ? eventKey({ eventId: ev.eventId, sourceId: p.ofSourceId })
        : null;
      const orig = origKey != null && byKey ? byKey.get(origKey) : null;
      const scorerId = orig ? (orig.payload?.scorerId ?? orig.playerId) : ev.playerId;
      return {
        ...base, icon: '↩️', tone: 'cancelled', playerId: scorerId,
        text: orig ? `Gol anulado a ${playerName(scorerId, playersById) || 'un jugador'}` : 'Gol anulado',
        teamName: orig ? feedTeamName(orig, scorerId, playersById, ctx, true) : null,
        detail: 'VAR',
      };
    }

    if (ev.type === 'card') {
      const ct = p.cardType || 'yellow';
      const double = ct === 'yellowRed' || ct === 'secondYellow';
      const red = ct === 'red' || double;
      const neutral = !red && ct !== 'yellow';
      return {
        ...base, icon: double ? '🟨🟥' : red ? '🟥' : '🟨',
        tone: red ? 'card-red' : 'card-yellow', playerId: ev.playerId,
        text: `${neutral ? 'Tarjeta' : double ? 'Doble amarilla' : red ? 'Roja' : 'Amarilla'} · ${playerName(ev.playerId, playersById) || 'un jugador'}`,
        teamName: feedTeamName(ev, ev.playerId, playersById, ctx, false),
        detail: null,
      };
    }

    if (ev.type === 'penalty_saved') {
      return {
        ...base, icon: '🧤', tone: 'penalty', playerId: p.keeperId,
        text: `Penalti parado por ${playerName(p.keeperId, playersById) || 'un jugador'}`,
        teamName: feedTeamName(ev, p.keeperId, playersById, ctx, true),
        detail: null,
      };
    }

    if (ev.type === 'penalty_missed') {
      return {
        ...base, icon: '❌', tone: 'penalty', playerId: p.takerId,
        text: `Penalti fallado · ${playerName(p.takerId, playersById) || 'un jugador'}`,
        teamName: feedTeamName(ev, p.takerId, playersById, ctx, true),
        detail: null,
      };
    }

    if (ev.type === 'substitution') {
      const inName = playerName(p.inId, playersById);
      const outName = playerName(p.outId, playersById);
      let text = 'Cambio';
      if (inName && outName) text = `Entra ${inName} · Sale ${outName}`;
      else if (inName) text = `Entra ${inName}`;
      else if (outName) text = `Sale ${outName}`;
      return {
        ...base, icon: '🔁', tone: 'sub', playerId: p.inId != null ? p.inId : p.outId,
        text, teamName: feedTeamName(ev, p.inId != null ? p.inId : p.outId, playersById, ctx, false),
        detail: null,
      };
    }

    return null;
  }

  function feedEvents(events, ctxById, playersById, allEvents = events) {
    const list = Array.isArray(events) ? events : [];
    const byKey = canonicalEventsByKey(Array.isArray(allEvents) ? allEvents : list);
    const keys = new Set();
    for (const e of list) {
      if (!e) continue;
      const key = eventKey(e);
      if (!byKey.has(key)) byKey.set(key, e);
      keys.add(key);
    }
    return sortEvents([...keys].map(k => byKey.get(k)).filter(isValidFeedEvent))
      .map(e => feedEventView(e, ctxById && ctxById[String(e.eventId)], playersById, byKey))
      .filter(Boolean)
      .reverse();
  }

  function feedEventsForMatch(events, eventId, ctxById, playersById, opts = {}) {
    const includeSeed = !!(opts && opts.includeSeed);
    const all = (Array.isArray(events) ? events : [])
      .filter(e => e && String(e.eventId) === String(eventId));
    const visible = includeSeed
      ? all
      : all.filter(e => !(e.payload && e.payload.seed));
    return feedEvents(visible, ctxById, playersById, all);
  }

  const liveV2Api = { createMatchState, applyEvent, escapeHtml, newPlayer, matchClockAt, minutesOf, sortEvents, foldMatch, foldAll, stateAt, eventKey, wantSimSource, matchStateToStats, rankRows, reasonLabel, liveV2ReasonForEvent, feedLabel, flipDelta, FEED_TYPES, formatMinute, feedEventView, feedEvents, feedEventsForMatch };
  global.liveV2Api = liveV2Api;
  if (typeof module !== 'undefined' && module.exports) module.exports = liveV2Api;
})(typeof window !== 'undefined' ? window : globalThis);
