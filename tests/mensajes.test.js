const { test } = require('node:test');
const assert = require('node:assert/strict');

const { TYPES, typeToIcon, typeLabel, isMessageActive, getActiveUnread, formatDateRange, messageSummaryHtml } = require('../js/mensajes.js');

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
  const base = Date.parse('2026-09-08T10:00:00Z');
  const msg = { fechaInicio: '2026-09-01', fechaFin: '2026-09-10' };
  assert.equal(isMessageActive(msg, base), true);                                        // dentro
  assert.equal(isMessageActive(msg, Date.parse('2026-09-01T12:00:00Z')), true);          // día de inicio
  assert.equal(isMessageActive(msg, Date.parse('2026-09-10T12:00:00Z')), true);          // día de fin
  assert.equal(isMessageActive(msg, Date.parse('2026-08-29T12:00:00Z')), false);         // antes (1 día de margen)
  assert.equal(isMessageActive(msg, Date.parse('2026-09-12T12:00:00Z')), false);         // después (1 día de margen)
});

test('isMessageActive con solo un límite', () => {
  assert.equal(isMessageActive({ fechaInicio: '2026-09-01', fechaFin: null }, Date.parse('2026-10-01T00:00:00Z')), true);
  assert.equal(isMessageActive({ fechaInicio: null, fechaFin: '2026-09-10' }, Date.parse('2026-09-11T00:00:00Z')), false);
});

test('getActiveUnread filtra activos no leídos y ordena por createdAt desc', () => {
  const now = Date.parse('2026-09-08T10:00:00Z');
  const messages = [
    { id: 'a', createdAt: '2026-09-01T00:00:00.000Z', read: false, fechaInicio: '2026-09-01', fechaFin: null },
    { id: 'b', createdAt: '2026-09-05T00:00:00.000Z', read: true, fechaInicio: null, fechaFin: null },
    { id: 'c', createdAt: '2026-09-06T00:00:00.000Z', read: false, fechaInicio: null, fechaFin: '2026-09-07' },
    { id: 'd', createdAt: '2026-09-07T00:00:00.000Z', read: false, fechaInicio: null, fechaFin: null }
  ];
  const result = getActiveUnread(messages, now);
  assert.deepEqual(result.map(m => m.id), ['d', 'a']); // c inactivo (fin 09-07), b leído
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