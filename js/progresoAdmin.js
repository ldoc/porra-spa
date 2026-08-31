(function (global) {
  const FASE_LABELS = { liga: 'Liguilla', '16': '16avos', '8': 'Octavos', '4': 'Cuartos', semis: 'Semifinales', final: 'Final' };

  function countPredictedMatches(matches, predictions) {
    let done = 0;
    for (const m of matches || []) {
      const p = predictions && predictions[m.id];
      if (p && typeof p.home === 'number' && typeof p.away === 'number') done++;
    }
    return done;
  }

  function computeFinalSlotsFilled(fp) {
    if (!fp) return 0;
    const slots = [
      fp.champion != null ? 1 : 0,
      fp.runnerUp != null ? 1 : 0,
      (fp.semiFinalists || []).filter(Boolean).length,
      (fp.quarterFinalists || []).filter(Boolean).length,
      (fp.roundOf16 || []).filter(Boolean).length,
      (fp.roundOf32 || []).filter(Boolean).length
    ];
    return slots.reduce((a, b) => a + b, 0);
  }

  function computeProgressForUser(user, matchesByFase) {
    const byFase = {};
    for (const [fase, matches] of Object.entries(matchesByFase || {})) {
      byFase[fase] = {
        done: countPredictedMatches(matches, user.predictions),
        total: (matches || []).length
      };
    }
    return {
      username: user.username,
      avatar: user.avatar || '👤',
      isAdmin: user.isAdmin === true,
      predictionsConfirmed: user.predictionsConfirmed === true,
      byFase,
      finalFilled: computeFinalSlotsFilled(user.finalPredictions),
      finalTotal: 24,
      finalLocked: user.predictionsConfirmed !== true,
      squadCount: typeof user.squadCount === 'number' ? user.squadCount : (Array.isArray(user.squad) ? user.squad.length : 0),
      squadTotal: 25
    };
  }

  function computeSummaries(progressList) {
    const total = progressList.length;
    const ligaComplete = progressList.filter(p => {
      const liga = p.byFase && p.byFase.liga;
      return liga && liga.total > 0 && liga.done === liga.total;
    }).length;
    const confirmed = progressList.filter(p => p.predictionsConfirmed).length;
    const squadComplete = progressList.filter(p => p.squadCount === p.squadTotal).length;
    const finalComplete = progressList.filter(p => !p.finalLocked && p.finalFilled === p.finalTotal).length;
    return { total, ligaComplete, confirmed, squadComplete, finalComplete };
  }

  function sortUsers(progressList, sortKey) {
    const arr = [...progressList];
    const byName = (a, b) => String(a.username).localeCompare(String(b.username));
    if (sortKey === 'name') return arr.sort(byName);
    if (sortKey === 'confirmed') return arr.sort((a, b) => (Number(b.predictionsConfirmed) - Number(a.predictionsConfirmed)) || byName(a, b));
    const ligaDone = p => (p.byFase && p.byFase.liga) ? p.byFase.liga.done : 0;
    return arr.sort((a, b) => (ligaDone(a) - ligaDone(b)) || byName(a, b));
  }

  function countCellHtml(done, total) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const state = (done >= total && total > 0) ? 'state-done' : 'state-pending';
    return `<td class="count ${state}">${done}/${total}<span class="bar"><span style="width:${pct}%"></span></span></td>`;
  }

  function buildProgressTableHtml(progressList, phaseOrder, sortKey) {
    const sorted = sortUsers(progressList, sortKey || 'liga');
    const s = computeSummaries(progressList);
    const summary = `
      <div class="admin-progress-summary">
        <span class="chip">👥 ${s.total}</span>
        <span class="chip">✅ Liguilla ${s.ligaComplete}/${s.total}</span>
        <span class="chip">🏆 Validados ${s.confirmed}</span>
        <span class="chip">🧩 Plantilla ${s.squadComplete}/${s.total}</span>
        <span class="chip">🗓️ Eliminatorias ${s.finalComplete}/${s.total}</span>
      </div>`;
    const headerCells = ['Jugador'].concat(
      phaseOrder.map(f => FASE_LABELS[f] || f),
      ['Validado', 'Eliminatorias', 'Plantilla']
    );
    const thead = `<thead><tr>${headerCells.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
    const rows = sorted.map(p => {
      const phaseCells = phaseOrder.map(f => {
        const c = p.byFase[f];
        return c ? countCellHtml(c.done, c.total) : '<td class="count state-pending">-</td>';
      });
      const valCell = p.predictionsConfirmed
        ? '<td class="val state-done">✅ Validado</td>'
        : '<td class="val state-pending">⏳ Pendiente</td>';
      const finalCell = p.finalLocked
        ? '<td class="count state-locked">🔒</td>'
        : countCellHtml(p.finalFilled, p.finalTotal);
      const squadCell = countCellHtml(p.squadCount, p.squadTotal);
      return `<tr>
        <td class="col-user"><span class="avatar">${p.avatar}</span> ${p.username}</td>
        ${phaseCells.join('')}
        ${valCell}
        ${finalCell}
        ${squadCell}
      </tr>`;
    }).join('');
    return `${summary}<div class="admin-progress-table-wrap"><table class="admin-progress-table">${thead}<tbody>${rows}</tbody></table></div>`;
  }

  async function loadAdminProgress(contentEl) {
    contentEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando...</div>';
    let data;
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/admin/progress`, { headers: authHeaders() });
      if (res.status === 401) { logout(); return; }
      if (res.status === 403) {
        contentEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444;">Acceso denegado</div>';
        return;
      }
      data = await res.json();
      if (!data.ok || !data.users) {
        contentEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444;">Error del servidor</div>';
        return;
      }
    } catch (e) {
      contentEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444;">Error de conexión<br><button id="admin-progress-retry" class="btn-primary" style="margin-top: 12px;">Reintentar</button></div>';
      contentEl.querySelector('#admin-progress-retry')?.addEventListener('click', () => loadAdminProgress(contentEl));
      return;
    }

    const matchesByFase = {};
    for (const m of AppState.matches || []) {
      (matchesByFase[m.fase] = matchesByFase[m.fase] || []).push(m);
    }
    const phaseOrder = ['liga', '16', '8', '4', 'semis', 'final'].filter(f => (matchesByFase[f] || []).length);
    const progressList = (data.users || []).map(u => computeProgressForUser(u, matchesByFase));
    let sortKey = 'liga';

    function render() {
      contentEl.innerHTML = `
        <div class="admin-progress-toolbar">
          <select id="admin-progress-sort" class="admin-progress-sort">
            <option value="liga"${sortKey === 'liga' ? ' selected' : ''}>Orden: Liguilla ↑</option>
            <option value="name"${sortKey === 'name' ? ' selected' : ''}>Orden: Nombre</option>
            <option value="confirmed"${sortKey === 'confirmed' ? ' selected' : ''}>Orden: Validados</option>
          </select>
          <span class="admin-progress-time">Actualizado ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        ${buildProgressTableHtml(progressList, phaseOrder, sortKey)}
      `;
      contentEl.querySelector('#admin-progress-sort').addEventListener('change', e => {
        sortKey = e.target.value;
        render();
      });
    }
    render();
  }

  function showAdminProgressModal() {
    const existing = document.querySelector('.breakdown-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'breakdown-modal-overlay';
    overlay.innerHTML = `
      <div class="breakdown-modal admin-progress-modal">
        <div class="breakdown-modal-header">
          <button class="breakdown-modal-close" id="admin-progress-close">✕</button>
          <h3 class="breakdown-modal-title" style="flex: 1; text-align: center; font-size: 1rem;">📊 Progreso de jugadores</h3>
          <button class="breakdown-modal-close" id="admin-progress-refresh" title="Refrescar">↻</button>
        </div>
        <div class="admin-progress-content" id="admin-progress-content">
          <div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#admin-progress-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    const contentEl = overlay.querySelector('#admin-progress-content');
    overlay.querySelector('#admin-progress-refresh').addEventListener('click', () => loadAdminProgress(contentEl));
    loadAdminProgress(contentEl);
  }

  global.FASE_LABELS = FASE_LABELS;
  global.countPredictedMatches = countPredictedMatches;
  global.computeFinalSlotsFilled = computeFinalSlotsFilled;
  global.computeProgressForUser = computeProgressForUser;
  global.computeSummaries = computeSummaries;
  global.sortUsers = sortUsers;
  global.buildProgressTableHtml = buildProgressTableHtml;
  global.showAdminProgressModal = showAdminProgressModal;
  global.loadAdminProgress = loadAdminProgress;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FASE_LABELS, countPredictedMatches, computeFinalSlotsFilled, computeProgressForUser, computeSummaries, sortUsers, buildProgressTableHtml };
  }
})(typeof window !== 'undefined' ? window : globalThis);