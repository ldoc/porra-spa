(function (global) {
  function getCountdownTarget(faseActual, fases, fasesFechas, ahora) {
    const fechas = fasesFechas || {};
    const sorted = [...(fases || [])].sort((a, b) => a.id - b.id);
    const idx = sorted.findIndex(f => f.nombre === faseActual);
    if (idx === -1) return null;
    const current = sorted[idx];
    const next = sorted[idx + 1] || null;
    const cur = fechas[current.nombre];
    const nextF = next ? fechas[next.nombre] : null;

    // Regla 1: dentro de [inicio, fin] de la fase actual → fin
    if (cur && cur.inicio && cur.fin) {
      const ini = new Date(cur.inicio).getTime();
      const fin = new Date(cur.fin).getTime();
      if (ahora >= ini && ahora < fin) {
        return { target: fin, label: 'Fin fase actual' };
      }
    }

    // Regla 2: antes del inicio de la siguiente fase → inicio
    if (next && nextF && nextF.inicio) {
      const nextIni = new Date(nextF.inicio).getTime();
      if (ahora < nextIni) {
        return { target: nextIni, label: `Inicio ${next.desc || next.nombre}` };
      }
    }

    // Regla 3: sin fechas / fase postfinal / fechas pasadas → null
    return null;
  }

  function formatCountdown(ms) {
    if (ms <= 0) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = n => String(n).padStart(2, '0');
    return `${d}d ${pad(h)}h ${pad(m)}m ${pad(s)}s`;
  }

  function formatCountdownHtml(ms) {
    if (ms <= 0) return null;
    const totalSeconds = Math.floor(ms / 1000);
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = n => String(n).padStart(2, '0');
    const num = (n, letter, last) =>
      `<span style="font-size: 15px; font-weight: 800;">${n}</span>` +
      `<span style="font-size: 11px; margin: 0 ${last ? '0' : '7px'} 0 3px;">${letter}</span>`;
    return num(d, 'd') + num(pad(h), 'h') + num(pad(m), 'm') + num(pad(s), 's', true);
  }

  function isoToDatetimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function datetimeLocalToIso(value) {
    if (!value) return null;
    const d = new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  const api = { getCountdownTarget, formatCountdown, formatCountdownHtml, isoToDatetimeLocal, datetimeLocalToIso };
  global.fasesFechasApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
