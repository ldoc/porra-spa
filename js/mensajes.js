(function (global) {
  const TYPES = {
    noticia: { icono: '📢', label: 'Noticia' },
    aviso: { icono: '⚠️', label: 'Aviso' },
    felicitacion: { icono: '🎉', label: 'Felicitación' },
    resumen: { icono: '⚽', label: 'Resumen de jornada' },
    mantenimiento: { icono: '🔧', label: 'Mantenimiento' }
  };

  function typeToIcon(type) {
    return (TYPES[type] || TYPES.noticia).icono;
  }

  function typeLabel(type) {
    return (TYPES[type] || TYPES.noticia).label;
  }

  function localDayKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function isMessageActive(message, now) {
    const hoy = localDayKey(new Date(now));
    if (message.fechaInicio && message.fechaInicio > hoy) return false;
    if (message.fechaFin && message.fechaFin < hoy) return false;
    return true;
  }

  function getActiveUnread(messages, now) {
    return (messages || [])
      .filter(m => m && !m.read && isMessageActive(m, now))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatDateRange(m) {
    if (!m.fechaInicio && !m.fechaFin) return 'Sin fecha límite';
    if (m.fechaInicio && !m.fechaFin) return `Desde ${m.fechaInicio}`;
    if (!m.fechaInicio && m.fechaFin) return `Hasta ${m.fechaFin}`;
    return `${m.fechaInicio} → ${m.fechaFin}`;
  }

  function messageSummaryHtml(m) {
    return `
      <div class="mensajes-card ${m.read ? 'mensajes-card-read' : ''}" data-id="${m.id}">
        <div class="mensajes-card-icon">${typeToIcon(m.type)}</div>
        <div class="mensajes-card-body">
          <div class="mensajes-card-title">${esc(m.title)}</div>
          <div class="mensajes-card-meta">${typeLabel(m.type)} · ${formatDateRange(m)} · ${m.read ? '✅ Leído' : '● Sin leer'}</div>
        </div>
      </div>`;
  }

  const CACHE_TTL = 30000;

  function messagesCacheKey() {
    const username = AppState.currentUser?.username;
    return username && typeof porraCache?.messagesKey === 'function' ? porraCache.messagesKey(username) : null;
  }

  function persistMessages(messages) {
    const key = messagesCacheKey();
    if (key) porraCache.cacheSet(key, messages, new Date().toISOString());
  }

  async function fetchMessages(force) {
    const messages = Array.isArray(AppState.messages) ? AppState.messages : [];
    const key = messagesCacheKey();
    if (key) {
      const cached = porraCache.cacheGet(key);
      const cachedList = cached && Array.isArray(cached.payload) ? cached.payload : null;
      if (cachedList) {
        AppState.messages = cachedList;
        const serverTime = cached.serverTime ? new Date(cached.serverTime).getTime() : 0;
        if (!force && Date.now() - serverTime < CACHE_TTL) return cachedList;
      }
    }
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/messages`, { headers: authHeaders() });
      if (res.status === 401) { logout(); return AppState.messages; }
      const data = await res.json();
      if (data.ok && Array.isArray(data.messages)) {
        AppState.messages = data.messages;
        persistMessages(data.messages);
        return data.messages;
      }
    } catch (e) {
      // Red caída: usar cache/memoria
    }
    return AppState.messages;
  }

  async function markRead(id) {
    const messages = Array.isArray(AppState.messages) ? AppState.messages : [];
    const idx = messages.findIndex(m => m && m.id === id);
    if (idx >= 0) {
      if (messages[idx].read) return;
      messages[idx] = { ...messages[idx], read: true };
      AppState.messages = messages;
      persistMessages(messages);
    }
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/messages/${id}/read`, { method: 'POST', headers: authHeaders() });
      if (res.status === 401) { logout(); return; }
      const data = await res.json();
      if (!data.ok) {
        if (idx >= 0) {
          messages[idx] = { ...messages[idx], read: false };
          AppState.messages = messages;
          persistMessages(messages);
        }
        showToast(data.error || 'Error al marcar como leído');
      }
    } catch (e) {
      if (idx >= 0) {
        messages[idx] = { ...messages[idx], read: false };
        AppState.messages = messages;
        persistMessages(messages);
      }
      showToast('Error de conexión');
    }
  }

  function showMessagesEntryModal() {
    const pendientes = getActiveUnread(AppState.messages || [], Date.now());
    if (!pendientes.length) return;

    const overlay = document.createElement('div');
    overlay.className = 'breakdown-modal-overlay';
    let index = 0;

    function render() {
      const m = pendientes[index];
      if (!m) { overlay.remove(); return; }
      overlay.innerHTML = `
        <div class="breakdown-modal mensajes-entry-modal">
          <div class="breakdown-modal-header">
            <button class="breakdown-modal-close" id="mensajes-entry-skip">✕</button>
            <h3 class="breakdown-modal-title" style="flex: 1; text-align: center; font-size: 1rem;">Mensaje ${index + 1}/${pendientes.length}</h3>
          </div>
          <div class="mensajes-content">
            <div class="mensajes-entry-icon">${typeToIcon(m.type)}</div>
            <div class="mensajes-entry-type">${typeLabel(m.type)}</div>
            <h2 class="mensajes-entry-title">${esc(m.title)}</h2>
            <div class="mensajes-entry-body">${m.content}</div>
          </div>
          <div class="mensajes-entry-actions">
            <button id="mensajes-entry-ok" class="btn-primary">Ok, leído</button>
          </div>
        </div>`;
      overlay.querySelector('#mensajes-entry-skip').addEventListener('click', () => { index++; render(); });
      overlay.querySelector('#mensajes-entry-ok').addEventListener('click', () => {
        markRead(m.id);
        index++;
        render();
      });
    }

    document.body.appendChild(overlay);
    render();
  }

  async function showProfileMessagesModal() {
    const messages = [...(await fetchMessages())].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const overlay = document.createElement('div');
    overlay.className = 'breakdown-modal-overlay';
    overlay.innerHTML = `
      <div class="breakdown-modal mensajes-modal">
        <div class="breakdown-modal-header">
          <button class="breakdown-modal-close" id="mensajes-profile-close">✕</button>
          <h3 class="breakdown-modal-title" style="flex: 1; text-align: center; font-size: 1rem;">💬 Mensajes</h3>
        </div>
        <div class="breakdown-modal-content mensajes-list">
          ${messages.length
            ? messages.map(m => `
              <div class="mensajes-card ${m.read ? 'mensajes-card-read' : ''}" data-id="${m.id}">
                <div class="mensajes-card-icon">${typeToIcon(m.type)}</div>
                <div class="mensajes-card-body">
                  <div class="mensajes-card-title">${esc(m.title)}</div>
                  <div class="mensajes-card-meta">${typeLabel(m.type)} · ${formatDateRange(m)} · ${m.read ? '✅ Leído' : '● Sin leer'}</div>
                  <div class="mensajes-card-content" style="display:none;">${m.content}</div>
                </div>
              </div>`).join('')
            : '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay mensajes</div>'}
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#mensajes-profile-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

    overlay.querySelectorAll('.mensajes-card').forEach(card => {
      card.addEventListener('click', () => {
        const contentEl = card.querySelector('.mensajes-card-content');
        const isOpen = contentEl.style.display !== 'none';
        contentEl.style.display = isOpen ? 'none' : 'block';
        if (!isOpen && !card.classList.contains('mensajes-card-read')) {
          card.classList.add('mensajes-card-read');
          markRead(card.dataset.id);
        }
      });
    });
  }

  async function createMessage(fields) {
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/admin/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(fields)
      });
      if (res.status === 401) { logout(); return false; }
      if (res.status === 403) { showToast('Acceso denegado'); return false; }
      const data = await res.json();
      if (data.ok) return true;
      showToast(data.error || 'Error creando mensaje');
      return false;
    } catch (e) {
      showToast('Error de conexión');
      return false;
    }
  }

  async function deleteMessage(id) {
    if (!confirm('¿Borrar este mensaje?')) return false;
    try {
      const res = await fetchWithPhase(`${API_BASE}/api/admin/messages/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.status === 401) { logout(); return false; }
      if (res.status === 403) { showToast('Acceso denegado'); return false; }
      const data = await res.json();
      if (data.ok) return true;
      showToast(data.error || 'Error borrando mensaje');
      return false;
    } catch (e) {
      showToast('Error de conexión');
      return false;
    }
  }

  function showAdminMessagesModal() {
    const overlay = document.createElement('div');
    overlay.className = 'breakdown-modal-overlay';
    const inputStyle = 'width: 100%; padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--ucl-border); background: var(--ucl-surface); color: var(--text-primary); font-size: 13px; box-sizing: border-box;';
    const labelStyle = 'font-size: 11px; color: var(--text-muted); font-weight: 700; display: block; margin-bottom: 6px;';
    const typeOptions = Object.entries(TYPES).map(([k, v]) => `<option value="${k}">${v.icono} ${v.label}</option>`).join('');

    overlay.innerHTML = `
      <div class="breakdown-modal mensajes-admin-modal">
        <div class="breakdown-modal-header">
          <button class="breakdown-modal-close" id="mensajes-admin-close">✕</button>
          <h3 class="breakdown-modal-title" style="flex: 1; text-align: center; font-size: 1rem;">💬 Gestión de Mensajes</h3>
        </div>
        <div class="breakdown-modal-content">
          <div class="mensajes-admin-form">
            <label style="${labelStyle}">Título</label>
            <input id="mensaje-titulo" style="${inputStyle}" maxlength="200" placeholder="Título del mensaje">
            <label style="${labelStyle} margin-top: 10px;">Tipo</label>
            <select id="mensaje-tipo" style="${inputStyle}">${typeOptions}</select>
            <label style="${labelStyle} margin-top: 10px;">Contenido (admite HTML)</label>
            <textarea id="mensaje-contenido" rows="4" style="${inputStyle}"></textarea>
            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <div style="flex: 1;">
                <label style="${labelStyle}">Fecha inicio</label>
                <input type="date" id="mensaje-inicio" style="${inputStyle}">
              </div>
              <div style="flex: 1;">
                <label style="${labelStyle}">Fecha fin</label>
                <input type="date" id="mensaje-fin" style="${inputStyle}">
              </div>
            </div>
            <button id="btn-crear-mensaje" class="btn-primary" style="width: 100%; margin-top: 12px;">Crear Mensaje</button>
          </div>
          <div id="mensajes-admin-list" style="margin-top: 16px;"></div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const listEl = overlay.querySelector('#mensajes-admin-list');

    async function renderAdminList() {
      listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">Cargando...</div>';
      const messages = await fetchMessages(true);
      listEl.innerHTML = messages.length
        ? messages.map(m => `
            <div class="mensajes-admin-row">
              <div class="mensajes-card-icon">${typeToIcon(m.type)}</div>
              <div class="mensajes-card-body">
                <div class="mensajes-card-title">${esc(m.title)}</div>
                <div class="mensajes-card-meta">${typeLabel(m.type)} · ${formatDateRange(m)}</div>
              </div>
              <button class="mensajes-admin-delete" data-id="${m.id}" title="Borrar">🗑️</button>
            </div>`).join('')
        : '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay mensajes</div>';
      listEl.querySelectorAll('.mensajes-admin-delete').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (await deleteMessage(btn.dataset.id)) {
            showToast('Mensaje borrado');
            renderAdminList();
          }
        });
      });
    }

    overlay.querySelector('#mensajes-admin-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#btn-crear-mensaje').addEventListener('click', async () => {
      const title = overlay.querySelector('#mensaje-titulo').value;
      const type = overlay.querySelector('#mensaje-tipo').value;
      const content = overlay.querySelector('#mensaje-contenido').value;
      const fechaInicio = overlay.querySelector('#mensaje-inicio').value || null;
      const fechaFin = overlay.querySelector('#mensaje-fin').value || null;
      if (!title.trim() || !content.trim()) { showToast('Título y contenido obligatorios'); return; }
      const created = await createMessage({ title, type, content, fechaInicio, fechaFin });
      if (created) {
        showToast('Mensaje creado');
        overlay.querySelector('#mensaje-titulo').value = '';
        overlay.querySelector('#mensaje-contenido').value = '';
        overlay.querySelector('#mensaje-inicio').value = '';
        overlay.querySelector('#mensaje-fin').value = '';
        renderAdminList();
      }
    });

    renderAdminList();
  }

  const mensajesApi = {
    TYPES, typeToIcon, typeLabel, isMessageActive, getActiveUnread, esc, formatDateRange, messageSummaryHtml,
    fetchMessages, markRead,
    showMessagesEntryModal, showProfileMessagesModal, showAdminMessagesModal,
    createMessage, deleteMessage
  };

  global.porraMensajes = mensajesApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mensajesApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);