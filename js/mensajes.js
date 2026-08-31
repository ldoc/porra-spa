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

  const mensajesApi = { TYPES, typeToIcon, typeLabel, isMessageActive, getActiveUnread, esc, formatDateRange, messageSummaryHtml };

  global.porraMensajes = mensajesApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mensajesApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);