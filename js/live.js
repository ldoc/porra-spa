(function (global) {
  const LIVE_DEFAULT_SECS = 60;

  function validSecs(v) {
    return Number.isInteger(v) && v > 0 ? v : null;
  }

  function resolveLiveRefreshSecs(fileSecs, serverSecs) {
    return validSecs(serverSecs) ?? validSecs(fileSecs) ?? LIVE_DEFAULT_SECS;
  }

  function goalsOf(m) {
    return liveGoalsOf(m.stats);
  }

  function liveGoalsOf(stats) {
    const out = {};
    for (const [k, v] of Object.entries(stats || {})) {
      if (k === 'jugadores') continue;
      if (v && typeof v.goles === 'number') out[k] = v.goles;
    }
    return out;
  }

  function diffLiveMatches(prev, next) {
    const events = [];
    const prevById = new Map((prev || []).map(m => [m.eventId, m]));
    for (const m of (next || [])) {
      const p = prevById.get(m.eventId);
      if (!p) {
        if (m.status === 'LIVE') events.push({ type: 'start', eventId: m.eventId });
        continue;
      }
      const pg = goalsOf(p), ng = goalsOf(m);
      for (const teamId of Object.keys(ng)) {
        if ((ng[teamId] || 0) > (pg[teamId] || 0)) {
          events.push({ type: 'goal', eventId: m.eventId, teamId });
        }
      }
      if (p.status !== m.status) {
        if (p.status === 'NS' && m.status === 'LIVE') events.push({ type: 'start', eventId: m.eventId });
        events.push({ type: 'status', eventId: m.eventId, from: p.status, to: m.status });
        if (m.status === 'FT') events.push({ type: 'end', eventId: m.eventId });
      }
    }
    return events;
  }

  function computeLiveGaps(sortedDesc, username) {
    const i = sortedDesc.findIndex(r => r.name === username);
    if (i < 0) return { above: null, me: null, below: null };
    const me = sortedDesc[i];
    const above = i > 0 ? sortedDesc[i - 1] : null;
    const below = i < sortedDesc.length - 1 ? sortedDesc[i + 1] : null;
    return {
      above, me, below,
      pointsToAbove: above ? above.livePoints - me.livePoints : 0,
      pointsOverBelow: below ? me.livePoints - below.livePoints : 0
    };
  }

  function ringOffset(secsLeft, total) {
    const C = 2 * Math.PI * 26;
    return C * (1 - Math.max(0, Math.min(1, secsLeft / total)));
  }

  function buildLiveTabsHtml(currentTab) {
    const tabs = [['jornadas', 'Jornadas'], ['live', '🔴 Live'], ['clasificacion', 'Clasif.'], ['eliminatorias', 'Elim.']];
    return '<div class="resultados-tabs">' + tabs.map(([key, label]) =>
      `<button class="resultados-tab ${currentTab === key ? 'active' : ''}" data-tab="${key}">${label}</button>`
    ).join('') + '</div>';
  }

  function buildRingHtml(secsLeft, total) {
    const C = 2 * Math.PI * 26;
    const off = ringOffset(secsLeft, total).toFixed(1);
    return `<div style="text-align:center"><div style="position:relative;width:64px;height:64px;margin-left:auto">`
      + `<svg width="64" height="64" viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="6"/>`
      + `<circle cx="32" cy="32" r="26" fill="none" stroke="#F59E0B" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off}" transform="rotate(-90 32 32)"/></svg>`
      + `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center"><div style="font-size:18px;font-weight:900;color:#F8FAFC;line-height:1">${secsLeft}</div><div style="font-size:8px;color:#94A3B8;font-weight:700">SEG</div></div>`
      + `</div></div>`;
  }

  function zoneRow(rank, avatar, name, sub, right, highlight) {
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;${highlight ? 'background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.4)' : ''}">`
      + `<div style="font-size:11px;color:#94A3B8;font-weight:800;width:16px">${rank}</div>`
      + `<div style="width:30px;height:30px;border-radius:50%;background:#1B2B54;display:flex;align-items:center;justify-content:center;font-size:16px">${avatar}</div>`
      + `<div style="flex:1"><div style="font-size:12px;font-weight:700">${name}</div><div style="font-size:10px;color:#64748B">${sub}</div></div>`
      + `<div style="font-size:10px;font-weight:800">${right}</div></div>`;
  }

  function buildZoneHtml(gaps, ranks, open, sub) {
    const isOpen = !!open;
    const r = ranks || {};
    const rows = [];
    rows.push(gaps.above
      ? zoneRow(r.above || '', gaps.above.avatar, gaps.above.name, `${gaps.above.livePoints} pts`, `a ${gaps.pointsToAbove} pts ▲`, false)
      : `<div style="padding:8px;font-size:11px;color:#64748B">Lideras el live 🏆</div>`);
    rows.push(zoneRow(r.me || '', gaps.me.avatar, `${gaps.me.name} <span>TÚ</span>`, `${gaps.me.livePoints} pts`, `${gaps.me.livePoints}`, true));
    rows.push(gaps.below
      ? zoneRow(r.below || '', gaps.below.avatar, gaps.below.name, `${gaps.below.livePoints} pts`, `+${gaps.pointsOverBelow} ▼`, false)
      : `<div style="padding:8px;font-size:11px;color:#64748B">Sin perseguidor</div>`);
    return `<div style="margin-top:10px;background:rgba(0,0,0,0.28);border-radius:10px;overflow:hidden">`
      + `<div class="live-zone-toggle" style="display:flex;align-items:center;gap:8px;padding:10px 12px;min-height:44px">`
      + `<div style="font-size:11px;color:#F8FAFC;font-weight:800;flex:1">🏆 TU ZONA EN DIRECTO${sub ? ` <span style="font-weight:400;color:#94A3B8">· ${sub}</span>` : ''}</div>`
      + `<div class="live-zone-chev" style="font-size:14px;color:#94A3B8">${isOpen ? '▾' : '▸'}</div></div>`
      + `<div class="live-zone-body" style="padding:0 6px 6px;display:${isOpen ? 'block' : 'none'}">${rows.join('')}</div></div>`;
  }

  const LIVE_POS_LABEL = { G: 'Portero', D: 'Defensa', M: 'Centrocampista', F: 'Delantero' };

  function buildLiveSquadPlayerRow(eventId, p, status) {
    const desglose = (p.desglose || []).map(d => (d.concepto === 'Portería a cero' && status !== 'FT')
      ? { ...d, concepto: d.concepto + ' (provisional)' } : d);
    const desgloseTxt = desglose.map(d => `${d.concepto} ${d.puntos > 0 ? '+' : ''}${d.puntos}`).join(' · ');
    const events = [p.goles ? `⚽ ${p.goles}` : '', p.asistencias ? `🅰️ ${p.asistencias}` : ''].filter(Boolean).join(' · ');
    const pos = LIVE_POS_LABEL[p.posicion] || p.posicion || '';
    const ext = p.extension || 'webp';
    const pts = Number(p.puntos) || 0;
    return `<button class="live-squad-player" data-live-event="${eventId}" data-live-player="${p.id}" style="display:flex;align-items:center;gap:8px;width:100%;min-height:44px;background:none;border:none;border-bottom:1px solid rgba(255,255,255,0.06);color:inherit;cursor:pointer;text-align:left;padding:5px 0">`
      + `<img src="data/imgJugadores/${p.id}.${ext}" alt="${p.nombre}" loading="lazy" style="width:32px;height:32px;border-radius:50%;object-fit:cover;background:#1B2B54" onerror="this.style.visibility='hidden'">`
      + `<span style="flex:1;min-width:0">`
      + `<span style="display:block;font-size:12px;font-weight:700;color:#F8FAFC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nombre} <span style="font-weight:400;color:#94A3B8">· ${pos} · ${p.minutos}'${events ? ' ' + events : ''}</span></span>`
      + (desgloseTxt ? `<span style="display:block;font-size:10px;color:#64748B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${desgloseTxt}</span>` : '')
      + `</span>`
      + `<span style="font-size:13px;font-weight:800;color:${pts >= 0 ? '#10B981' : '#F87171'}">${pts > 0 ? '+' : ''}${pts}</span>`
      + `</button>`;
  }

  function buildLiveSquadPlayersHtml(eventId, players, status) {
    if (!Array.isArray(players) || players.length === 0) {
      const msg = status === 'NS'
        ? 'Alineación no disponible todavía.'
        : 'Ningún jugador de tu plantilla juega este partido.';
      return `<div style="padding:8px 0;font-size:12px;color:#94A3B8">${msg}</div>`;
    }
    return players.map(p => buildLiveSquadPlayerRow(eventId, p, status)).join('');
  }

  function liveStatusStyle(status, minute) {
    if (status === 'NS') return { label: '⏳ SIN EMPEZAR', color: '#94A3B8', border: 'rgba(255,255,255,0.15)' };
    if (status === 'FT') return { label: 'FINAL', color: '#94A3B8', border: 'rgba(255,255,255,0.1)' };
    if (status === 'HT') return { label: '⏸ DESCANSO', color: '#F59E0B', border: '#F59E0B' };
    const m = (minute !== null && minute !== undefined) ? `${minute}' ` : '';
    return { label: `● ${m}EN JUEGO`, color: '#EF4444', border: '#EF4444' };
  }

  function buildLivePredictionPill(pred, matchPts, status) {
    if (!pred || pred.home === null || pred.home === undefined || pred.away === null || pred.away === undefined) {
      return `<div style="font-size:10px;color:#64748B;margin-top:4px">Sin pronóstico</div>`;
    }
    const pts = Number(matchPts) || 0;
    const color = pts > 0 ? '#10B981' : '#94A3B8';
    const bg = pts > 0 ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)';
    const live = status !== 'FT' && status !== 'NS';
    return `<div style="font-size:10px;color:${color};font-weight:700;background:${bg};border-radius:99px;padding:2px 8px;margin-top:4px;display:inline-block">Tu ${pred.home}-${pred.away} → ${pts > 0 ? '+' : ''}${pts}${live ? ' <i style="color:#64748B;font-weight:400">de momento</i>' : ''}</div>`;
  }

  function buildLiveTeamCell(teamId, ext, name, size) {
    if (teamId === undefined || teamId === null) {
      return `<div style="flex:1;text-align:center"><div style="font-size:11px;font-weight:700">${name || '?'}</div></div>`;
    }
    const e = ext || 'webp';
    const s = size || 38;
    return `<div style="flex:1;text-align:center"><img src="data/imgEquipos/${teamId}.${e}" alt="${name}" loading="lazy" style="width:${s}px;height:${s}px;object-fit:contain" onerror="this.onerror=null;this.src='data/imgEquipos/default.webp'"><div style="font-size:11px;font-weight:700;margin-top:4px">${name}</div></div>`;
  }

  const LIVE_EVENTS_MAX = 50;

  function liveDayKey(nowMs) {
    const d = new Date(nowMs);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function pruneLiveEvents(store, nowMs, max) {
    const day = liveDayKey(nowMs);
    const cap = (Number.isInteger(max) && max > 0) ? max : LIVE_EVENTS_MAX;
    if (!store || store.day !== day || !Array.isArray(store.events)) {
      return { day, updatedAt: nowMs, events: [], baseline: null };
    }
    const events = store.events.length > cap ? store.events.slice(store.events.length - cap) : store.events;
    return { day, updatedAt: nowMs, events, baseline: store.baseline || null };
  }

  function appendLiveEvent(events, ev, max) {
    const cap = (Number.isInteger(max) && max > 0) ? max : LIVE_EVENTS_MAX;
    const next = (Array.isArray(events) ? events : []).concat([ev]);
    return next.length > cap ? next.slice(next.length - cap) : next;
  }

  function buildLiveEventRow(e) {
    const time = new Date(e.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const text = e.text || '';
    if (e.mine) {
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 4px;position:relative;background:#0E3B2E;border:1px solid rgba(16,185,129,0.55);border-radius:8px;margin:3px 0">`
        + `<span style="position:absolute;left:-8px;top:5px;bottom:5px;width:4px;border-radius:3px;background:#10B981"></span>`
        + `<span style="flex:1;font-size:12px;font-weight:800;color:#FFFFFF;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text}</span>`
        + `<span style="font-size:10px;color:#6EE7B7">${time}</span></div>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,0.06)">`
      + `<span style="flex:1;font-size:12px;font-weight:700;color:#F8FAFC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${text}</span>`
      + `<span style="font-size:10px;color:#64748B">${time}</span></div>`;
  }

  function buildLiveEventsFeed(events, open) {
    const list = Array.isArray(events) ? events : [];
    const isOpen = !!open;
    const rows = [...list].reverse().map(buildLiveEventRow).join('');
    const badge = list.length ? ` <span style="font-size:9px;color:#10B981;background:rgba(16,185,129,0.16);border-radius:99px;padding:1px 6px">${list.length}</span>` : '';
    return `<div style="margin-top:10px;background:rgba(0,0,0,0.28);border-radius:10px;overflow:hidden">`
      + `<div class="live-events-toggle" style="display:flex;align-items:center;gap:8px;padding:10px 12px;min-height:44px">`
      + `<div style="font-size:11px;color:#F8FAFC;font-weight:800;flex:1">📣 ÚLTIMA HORA <span style="font-weight:400;color:#94A3B8">· hoy</span>${badge}</div>`
      + `<div class="live-events-chev" style="font-size:14px;color:#94A3B8">${isOpen ? '▾' : '▸'}</div></div>`
      + `<div class="live-events-body" style="padding:0 8px 6px;display:${isOpen ? 'block' : 'none'}">`
      + (list.length ? rows : `<div style="padding:8px 4px;font-size:12px;color:#94A3B8">Aún no hay eventos.</div>`)
      + `</div></div>`;
  }

  function describeLiveEvent(ev, ctx) {
    ctx = ctx || {};
    if (ev.type === 'goal') {
      const who = ctx.scorer ? ` ${ctx.scorer}` : '';
      const min = (ctx.minute !== null && ctx.minute !== undefined) ? ` (${ctx.minute}')` : '';
      const team = ctx.team ? ` · ${ctx.team}` : '';
      return `⚽ ¡GOL!${who}${min}${team}`;
    }
    if (ev.type === 'rankUp') return `▲ Subes al ${ctx.rank}º`;
    if (ev.type === 'rankDown') return `▼ Bajas al ${ctx.rank}º`;
    if (ev.type === 'start') return ctx.match ? `🟢 ¡Empieza el partido · ${ctx.match}` : '🟢 ¡Empieza el partido!';
    if (ev.type === 'end') return '🏁 FINAL';
    if (ev.type === 'status') {
      const m = ctx.match ? ` · ${ctx.match}` : '';
      if (ev.to === 'HT') return `⏸ DESCANSO${m}`;
      if (ev.to === 'FT') return `🏁 FINAL${m}`;
      return `▶️ ${ev.to}${m}`;
    }
    return '';
  }

  function liveCountsLabel(liveMatches) {
    const list = Array.isArray(liveMatches) ? liveMatches : [];
    const enJuego = list.filter(m => m.status === 'LIVE' || m.status === 'HT').length;
    const proximos = list.filter(m => m.status === 'NS').length;
    if (proximos > 0) return `${enJuego} en juego · ${proximos} próximo${proximos === 1 ? '' : 's'}`;
    return `${enJuego} partido${enJuego === 1 ? '' : 's'} en juego`;
  }

  const liveApi = { resolveLiveRefreshSecs, LIVE_DEFAULT_SECS, liveGoalsOf, diffLiveMatches, computeLiveGaps, ringOffset, buildLiveTabsHtml, buildRingHtml, buildZoneHtml, buildLiveSquadPlayersHtml, liveStatusStyle, buildLivePredictionPill, buildLiveTeamCell, describeLiveEvent, liveDayKey, pruneLiveEvents, appendLiveEvent, buildLiveEventsFeed, liveCountsLabel, LIVE_EVENTS_MAX };
  global.liveApi = liveApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = liveApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
