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
  // Mismas reglas 8/3/3/1 que calculateMatchPoints en main.js — mantener sincronizados.
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

function computeLivePlayerRanking(liveMatches, squadsCache, scorePlayer, teamNames = {}) {
  const seen = new Map();
  for (const live of liveMatches || []) {
    const label = `${shortTeam(teamNames?.[live.homeTeamId] ?? live.homeTeamId)}-${shortTeam(teamNames?.[live.awayTeamId] ?? live.awayTeamId)}`;
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
  let html = shown.map(u => `<span class="tag${u === currentUser ? ' me' : ''}">${u === currentUser ? 'tú' : esc(u)}</span>`).join('');
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
    if ((nx.homeGoles + nx.awayGoles) > (pv.homeGoles + pv.awayGoles)) {
      if (scorer) {
        const penal = (nm[scorer].penaltiMarcado || 0) > (pm[scorer]?.penaltiMarcado || 0);
        evs.push({ tipo: penal ? 'penalti' : 'gol', eventId: nx.eventId, playerId: scorer, playerName: nm[scorer].nombre, teamId: nm[scorer].equipo, minuto: nx.minuto, homeGoles: nx.homeGoles, awayGoles: nx.awayGoles, homeTeamId: nx.homeTeamId, awayTeamId: nx.awayTeamId });
      } else {
        evs.push({ tipo: 'gol', eventId: nx.eventId, playerId: null, playerName: null, teamId: null, minuto: nx.minuto, homeGoles: nx.homeGoles, awayGoles: nx.awayGoles, homeTeamId: nx.homeTeamId, awayTeamId: nx.awayTeamId });
      }
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
      if (!seen.has(inc.key)) { evs.push({ ...inc, tipo: inc.tipo === 'sub' ? 'cambio' : 'tarjeta', eventId: nx.eventId }); break; }
    }
  }
  return evs;
}

function buildEventToastHtml(ev, ctx) {
  const c = ctx || {};
  const pts = `📋 Tu pronóstico: +${c.myPtsBefore ?? 0} → <strong>+${c.myPtsAfter ?? 0}</strong> (pasas de ${c.tempBefore ?? 0} a ${c.tempAfter ?? 0} pts temporales)`;
  const mine = (n) => c.isMine ? `<div class="imp2">👕 ${esc(n || '')} es tuyo: +${c.plantDelta ?? 0} fantasy en este partido</div>` : '';
  const score = `${esc(ev.homeShort || c.teamNames?.[ev.homeTeamId] || '')} ${ev.homeGoles ?? ''}-${ev.awayGoles ?? ''} ${esc(ev.awayShort || c.teamNames?.[ev.awayTeamId] || '')}`;
  const teamName = ev.teamName || c.teamNames?.[ev.teamId] || '';
  const who = ev.playerName ? `⚽ ${esc(ev.playerName)}${teamName ? ` (${esc(teamName)})` : ''}` : '⚽ ¡Gol!';
  switch (ev.tipo) {
    case 'gol': return `<div class="toast toast-gol play"><div class="goool">¡GOOOL!</div><div><span class="who">${who}</span> · ${ev.minuto || ''}' · ${score}</div><div class="imp">${pts}</div>${mine(ev.playerName)}</div>`;
    case 'penalti': return `<div class="toast toast-penalti play"><span class="stamp">PENALTI</span><div><span class="who">${who}</span> · ${ev.minuto || ''}' · gol sí, pero sin extra por demarcación</div><div class="imp">${pts}</div>${mine(ev.playerName)}</div>`;
    case 'paradon': return `<div class="toast toast-paradon play"><span class="big dive">🧤</span><div class="msg cyan">¡PARADÓN! ${esc(ev.playerName || '')} · ${ev.minuto || ''}'</div>${mine(ev.playerName) || `<div class="imp2">🧤 Paradón de ${esc(ev.playerName || '')}</div>`}</div>`;
    case 'descanso': return `<div class="toast toast-descanso play"><span class="big breathe">⏸️</span><div class="msg">DESCANSO · ${ev.minuto || ''}'</div><div class="imp2">Vas con ${c.tempAfter ?? c.tempBefore ?? 0} pts temporales</div></div>`;
    case 'reanudacion': return `<div class="toast toast-reanudacion play"><div class="msg">▶️ Se reanuda el partido · ${ev.minuto || ''}'</div><div class="imp2">Vas con ${c.tempAfter ?? c.tempBefore ?? 0} pts temporales</div></div>`;
    case 'final': return `<div class="toast toast-final play"><span class="big wave">🏁</span><div class="msg gold finalmsg">FINAL · ${score}</div><div class="imp">Ese partido te dio +${c.myPtsAfter ?? 0} de pronóstico</div></div>`;
    case 'cambio': {
      const out = ev.playerOut || ev.out || '';
      const inn = ev.playerName || ev.in || '';
      return `<div class="toast toast-cambio play"><div class="swap"><div class="chip out">⬇️ sale ${esc(out)}</div><div class="chip in">⬆️ entra ${esc(inn)}</div></div><div class="msg">Cambio · ${ev.minuto || ''}'</div>${c.isMine ? `<div class="imp2">👕 ${esc(out)} es tuyo: ya no suma más hoy</div>` : ''}</div>`;
    }
    case 'tarjeta': {
      const red = ev.color === 'roja' || ev.color === 'red';
      return `<div class="toast toast-tarjeta play"><span class="cardflip ${red ? 'r' : 'y'}"></span><div class="msg">${red ? 'Roja' : 'Amarilla'} · ${esc(ev.playerName || '')} · ${ev.minuto || ''}'</div><div class="imp2">Sin puntos directos, pero puede bajarle la nota ⭐</div></div>`;
    }
    default: return `<div class="toast play"><div class="msg">Evento · ${ev.minuto || ''}'</div></div>`;
  }
}

  const api = { isLiveAllowed, stalenessLabel, livePointsForUser, squadPlayersInLive, esc, shortTeam, buildLiveStripHtml, ownersOfPlayer, playerImgUrl, fetchLiveUpdated, fetchLiveMatches, computeLiveTemporal, buildTemporalTableHtml, computeLivePlayerRanking, buildPlayerRankingHtml, detectLiveEvents, buildEventToastHtml };
  global.liveTab = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
