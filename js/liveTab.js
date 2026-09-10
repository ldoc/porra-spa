(function (global) {
  const API_BASE_FALLBACK = 'https://api-porra.vercel.app';
  function apiBase() {
    try {
      if (typeof window !== 'undefined' && window.location?.hostname === 'localhost') return 'http://localhost:3000';
    } catch (e) {}
    return API_BASE_FALLBACK;
  }
  const ACTIVE = ['FASE_LIGA', 'FASE_16', 'FASE_8', 'FASE_4', 'FASE_SEMIS', 'FASE_FINAL'];
  function isLiveAllowed(fase) { return ACTIVE.includes(fase); }

  function stalenessLabel(scrapedAt, nowMs) {
    const mins = Math.max(0, Math.round(((nowMs || Date.now()) - new Date(scrapedAt).getTime()) / 60000));
    return mins <= 0 ? 'ahora mismo' : `hace ${mins} min`;
  }

  function resultOf(h, a) { return h > a ? 'H' : h < a ? 'A' : 'D'; }
  function livePointsForUser(live, pred) {
    if (!live || !pred || typeof pred.home !== 'number' || typeof pred.away !== 'number') return 0;
    let p = 0;
    if (resultOf(pred.home, pred.away) === resultOf(live.homeGoles, live.awayGoles)) p += 8;
    if (pred.home === live.homeGoles) p += 3;
    if (pred.away === live.awayGoles) p += 3;
    if (pred.home === live.homeGoles && pred.away === live.awayGoles) p += 1;
    return p;
  }

  function squadPlayersInLive(live, squad) {
    const ids = new Set((squad || []).map(s => String(s.id)));
    const teams = new Set([String(live?.homeTeamId), String(live?.awayTeamId)]);
    return ((live?.stats?.jugadores) || []).filter(j => ids.has(String(j.id)) && teams.has(String(j.equipo)));
  }

  function esc(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

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

  function scorersInLive(live) {
    return ((live?.stats?.jugadores) || [])
      .filter(j => (j.goles || 0) > 0)
      .sort((a, b) => (b.goles || 0) - (a.goles || 0));
  }

  function ownersOfPlayer(playerId, squadsCache) {
    const id = String(playerId);
    const owners = [];
    for (const [username, squad] of Object.entries(squadsCache || {})) {
      if ((squad || []).some(s => String(s.id) === id)) owners.push(username);
    }
    return owners.sort();
  }

  function playerImgUrl(id, playerExts) {
    const ext = (playerExts && playerExts[String(id)]) || 'webp';
    return `data/imgJugadores/${id}.${ext}`;
  }

  function ownerChip(u, currentUser, avatars, myAvatar) {
    const isMe = u === currentUser;
    const avatar = isMe ? (myAvatar || '') : ((avatars || {})[u] || '');
    return `<span class="live-owner${isMe ? ' me' : ''}">${avatar ? `<span class="live-owner-avatar">${esc(avatar)}</span>` : ''}${isMe ? 'tú' : esc(u)}</span>`;
  }

  function buildScorersHtml({ live, squadsCache, teamNames, currentUser, avatars, myAvatar, playerExts }) {
    const scorers = scorersInLive(live);
    if (!scorers.length) return `<div class="live-scorers"><div class="live-scorers-empty">Sin goles aún</div></div>`;
    const rows = scorers.map(j => {
      const owners = ownersOfPlayer(j.id, squadsCache);
      const team = teamNames?.[j.equipo] || j.equipo;
      const mark = `⚽${j.goles > 1 ? ` x${j.goles}` : ''}${(j.penaltiMarcado || 0) > 0 ? ' (p)' : ''}`;
      const mine = currentUser ? owners.includes(currentUser) : false;
      const chips = owners.length
        ? owners.map(u => ownerChip(u, currentUser, avatars, myAvatar)).join('')
        : '<span class="live-owner none">nadie lo tiene</span>';
      return `<div class="live-scorer${mine ? ' mine' : ''}"><img class="live-scorer-img" src="${playerImgUrl(j.id, playerExts)}" alt="${esc(j.nombre)}" loading="lazy" onerror="this.style.display='none'"><span class="live-scorer-name">${mark} ${esc(j.nombre)} <span class="live-scorer-team">(${esc(team)})</span></span><span class="live-owners">${chips}</span></div>`;
    }).join('');
    return `<div class="live-scorers"><div class="live-scorers-title">Goleadores</div>${rows}</div>`;
  }

  function buildLiveCardHtml({ live, myPred, livePoints, teamNames, squadsCache, currentUser, avatars, myAvatar, playerExts }) {
    const dot = '<span class="live-dot" aria-hidden="true"></span>';
    const badge = live.estado === 'live' ? `${dot} LIVE${live.minuto ? ` ${live.minuto}’` : ''}` : live.estado === 'descanso' ? '⏸ Descanso' : '🏁 Final';
    return `<div class="live-card" data-event="${live.eventId}">`
      + `<div class="live-head"><span class="live-badge">${badge}</span><span class="live-stale">${esc(stalenessLabel(live.scrapedAt, Date.now()))}</span></div>`
      + `<div class="live-score">${esc(teamNames?.[live.homeTeamId] || live.homeTeamId)} ${live.homeGoles} - ${live.awayGoles} ${esc(teamNames?.[live.awayTeamId] || live.awayTeamId)}</div>`
      + `<div class="live-mine">Tu pronóstico: ${myPred ? `${myPred.home}-${myPred.away} · +${livePoints} pts live` : '—'}</div>`
      + buildScorersHtml({ live, squadsCache, teamNames, currentUser, avatars, myAvatar, playerExts })
      + `</div>`;
  }

  async function fetchLiveUpdated(deps) {
    const { fetchFn, cache } = deps;
    const res = await fetchFn(`${apiBase()}/api/live-matches/updated`);
    if (res.status === 304) return { notModified: true };
    const data = await res.json().catch(() => null);
    return data;
  }

  async function fetchLiveMatches(deps) {
    const { fetchFn, cache, etag } = deps;
    // 1) SWR: si hay caché, el llamante ya pintó; aquí solo revalidamos con ETag
    const res = await fetchFn(`${apiBase()}/api/live-matches`, etag ? { headers: { 'If-None-Match': etag } } : {});
    if (res.status === 304) return { notModified: true };
    const data = await res.json().catch(() => null);
    if (data?.ok && Array.isArray(data.liveMatches)) {
      const merged = cache.mergeLiveMatches(cache.cached || [], data.liveMatches);
      const newEtag = res.headers?.get ? res.headers.get('ETag') : null;
      return { liveMatches: merged, serverTime: data.serverTime, etag: newEtag };
    }
    return null;
  }

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

  const api = { isLiveAllowed, stalenessLabel, livePointsForUser, squadPlayersInLive, esc, shortTeam, buildLiveStripHtml, scorersInLive, ownersOfPlayer, playerImgUrl, buildScorersHtml, buildLiveCardHtml, fetchLiveUpdated, fetchLiveMatches, computeLiveTemporal, buildTemporalTableHtml };
  global.liveTab = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
