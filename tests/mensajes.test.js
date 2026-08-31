const { test } = require('node:test');
const assert = require('node:assert/strict');

const { TYPES, typeToIcon, typeLabel, isMessageActive, getActiveUnread, formatDateRange, messageSummaryHtml } = require('../js/mensajes.js');

function localDayKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

test('TYPES tiene los 5 tipos con icono y label', () => {
  assert.deepEqual(Object.keys(TYPES).sort(), ['aviso', 'felicitacion', 'mantenimiento', 'noticia', 'resumen']);
  assert.equal(TYPES.noticia.icono, '📢');
  assert.equal(TYPES.resumen.label, 'Resumen de jornada');
});

test('typeToIcon y typeLabel con fallback', () => {
  assert.equal(typeToIcon('resumen'), '⚽');
  assert.equal(typeLabel('mantenimiento'), 'Mantenimiento');
  assert.equal(typeToIcon('desconocido'), '📢');
  assert.equal(typeLabel('desconocido'), 'Noticia');
});

test('isMessageActive sin fechas es siempre activo', () => {
  assert.equal(isMessageActive({ fechaInicio: null, fechaFin: null }, Date.parse('2026-09-08T10:00:00Z')), true);
});

test('isMessageActive respeta inicio y fin inclusivos', () => {
  const msg = { fechaInicio: '2026-09-01', fechaFin: '2026-09-10' };
  const dentro = ['2026-09-03T12:00:00Z', '2026-09-05T12:00:00Z', '2026-09-08T12:00:00Z'];
  const fuera = ['2026-08-29T12:00:00Z', '2026-09-12T12:00:00Z'];
  for (const ts of dentro) {
    const hoy = localDayKey(Date.parse(ts));
    assert.ok(hoy >= '2026-09-01' && hoy <= '2026-09-10', `dentro esperado en rango (${hoy})`);
    assert.equal(isMessageActive(msg, Date.parse(ts)), true);
  }
  for (const ts of fuera) {
    const hoy = localDayKey(Date.parse(ts));
    assert.ok(hoy < '2026-09-01' || hoy > '2026-09-10', `fuera esperado fuera de rango (${hoy})`);
    assert.equal(isMessageActive(msg, Date.parse(ts)), false);
  }
});

test('isMessageActive con solo un límite', () => {
  assert.equal(isMessageActive({ fechaInicio: '2026-09-01', fechaFin: null }, Date.parse('2026-10-01T00:00:00Z')), true);
  assert.equal(isMessageActive({ fechaInicio: null, fechaFin: '2026-09-10' }, Date.parse('2026-09-12T12:00:00Z')), false);
});

test('getActiveUnread filtra activos no leídos y ordena por createdAt desc', () => {
  const now = Date.parse('2026-09-08T12:00:00Z');
  const messages = [
    { id: 'a', createdAt: '2026-09-01T00:00:00.000Z', read: false, fechaInicio: '2026-09-01', fechaFin: null },
    { id: 'b', createdAt: '2026-09-05T00:00:00.000Z', read: true, fechaInicio: null, fechaFin: null },
    { id: 'c', createdAt: '2026-09-06T00:00:00.000Z', read: false, fechaInicio: null, fechaFin: '2026-09-06' },
    { id: 'd', createdAt: '2026-09-07T00:00:00.000Z', read: false, fechaInicio: null, fechaFin: null }
  ];
  const result = getActiveUnread(messages, now);
  assert.deepEqual(result.map(m => m.id), ['d', 'a']); // c inactivo (fin 09-06), b leído
});

test('formatDateRange', () => {
  assert.equal(formatDateRange({ fechaInicio: null, fechaFin: null }), 'Sin fecha límite');
  assert.equal(formatDateRange({ fechaInicio: '2026-09-01', fechaFin: null }), 'Desde 2026-09-01');
  assert.equal(formatDateRange({ fechaInicio: null, fechaFin: '2026-09-10' }), 'Hasta 2026-09-10');
  assert.equal(formatDateRange({ fechaInicio: '2026-09-01', fechaFin: '2026-09-10' }), '2026-09-01 → 2026-09-10');
});

test('messageSummaryHtml escapa el título', () => {
  const html = messageSummaryHtml({ id: 'x', title: '<b>Hola</b>', type: 'aviso', fechaInicio: null, fechaFin: null, read: false });
  assert.ok(html.includes('&lt;b&gt;Hola&lt;/b&gt;'));
  assert.ok(!html.includes('<b>Hola</b>'));
  assert.ok(html.includes('⚠️'));
});