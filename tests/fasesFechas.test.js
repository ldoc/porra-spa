const assert = require('assert');
const { getCountdownTarget, formatCountdown, formatCountdownHtml, isoToDatetimeLocal, datetimeLocalToIso } = require('../js/fasesFechas.js');

const FASES = [
  { id: 1, nombre: 'FASE_PRETEMPORADA', desc: 'Pretemporada' },
  { id: 2, nombre: 'FASE_LIGA', desc: 'Liga' },
  { id: 3, nombre: 'FASE_PRE16', desc: 'Previa Knockouts' },
  { id: 4, nombre: 'FASE_16', desc: 'Knockouts' },
  { id: 13, nombre: 'FASE_POSTFINAL', desc: 'Fin de porra' }
];

const ISO = {
  ligaIni: '2026-09-08T20:00:00.000Z',
  ligaFin: '2026-12-11T20:00:00.000Z'
};

function test_dentro_de_fase_cuenta_al_fin() {
  const t = getCountdownTarget('FASE_LIGA', FASES, { FASE_LIGA: { inicio: ISO.ligaIni, fin: ISO.ligaFin } }, Date.parse('2026-10-01T12:00:00Z'));
  assert.strictEqual(t.target, Date.parse(ISO.ligaFin));
  assert.strictEqual(t.label, 'Fin fase actual');
}

function test_antes_de_siguiente_fase_cuenta_al_inicio() {
  const t = getCountdownTarget('FASE_PRETEMPORADA', FASES, { FASE_LIGA: { inicio: ISO.ligaIni, fin: ISO.ligaFin } }, Date.parse('2026-08-15T12:00:00Z'));
  assert.strictEqual(t.target, Date.parse(ISO.ligaIni));
  assert.match(t.label, /Inicio/);
}

function test_sin_fechas_devuelve_null() {
  const t = getCountdownTarget('FASE_LIGA', FASES, {}, Date.parse('2026-10-01T12:00:00Z'));
  assert.strictEqual(t, null);
}

function test_fase_postfinal_devuelve_null() {
  const t = getCountdownTarget('FASE_POSTFINAL', FASES, {}, Date.parse('2026-10-01T12:00:00Z'));
  assert.strictEqual(t, null);
}

function test_fase_postfinal_con_fechas_en_rango_devuelve_null() {
  // Aunque el admin haya definido fechas para FASE_POSTFINAL, la porra terminó → no hay countdown
  const t = getCountdownTarget('FASE_POSTFINAL', FASES, { FASE_POSTFINAL: { inicio: '2026-09-01T20:00:00.000Z', fin: '2026-12-31T20:00:00.000Z' } }, Date.parse('2026-10-01T12:00:00Z'));
  assert.strictEqual(t, null);
}

function test_antes_del_inicio_de_la_propia_fase_cuenta_al_inicio_de_siguiente() {
  // FASE_LIGA activa pero ahora < inicio de FASE_LIGA y PRE16 sin fechas → sigue regla 2 con siguiente fase (sin fechas) → null
  const t = getCountdownTarget('FASE_LIGA', FASES, { FASE_LIGA: { inicio: ISO.ligaIni, fin: ISO.ligaFin } }, Date.parse('2026-08-15T12:00:00Z'));
  assert.strictEqual(t, null);
}

function test_formatCountdown_basico() {
  // 2d 14h 03m 25s
  const ms = ((2 * 86400) + (14 * 3600) + (3 * 60) + 25) * 1000;
  assert.strictEqual(formatCountdown(ms), '2d 14h 03m 25s');
}

function test_formatCountdown_cero_o_negativo() {
  assert.strictEqual(formatCountdown(0), null);
  assert.strictEqual(formatCountdown(-5), null);
}

function test_formatCountdown_unidades_pequeñas() {
  const ms = ((0 * 86400) + (1 * 3600) + (5 * 60) + 9) * 1000;
  assert.strictEqual(formatCountdown(ms), '0d 01h 05m 09s');
}

function test_formatCountdownHtml_cero_o_negativo() {
  assert.strictEqual(formatCountdownHtml(0), null);
  assert.strictEqual(formatCountdownHtml(-5), null);
}

function test_formatCountdownHtml_estilos_y_contenido() {
  const ms = ((2 * 86400) + (14 * 3600) + (3 * 60) + 25) * 1000;
  const html = formatCountdownHtml(ms);
  assert.ok(html.includes('<span style="font-size: 15px; font-weight: 800;">2</span>'));
  assert.ok(html.includes('<span style="font-size: 15px; font-weight: 800;">14</span>'));
  assert.ok(html.includes('<span style="font-size: 15px; font-weight: 800;">03</span>'));
  assert.ok(html.includes('<span style="font-size: 15px; font-weight: 800;">25</span>'));
  assert.ok(html.includes('<span style="font-size: 11px; margin: 0 7px 0 3px;">d</span>'));
  assert.ok(html.includes('<span style="font-size: 11px; margin: 0 7px 0 3px;">h</span>'));
  assert.ok(html.includes('<span style="font-size: 11px; margin: 0 7px 0 3px;">m</span>'));
}

function test_formatCountdownHtml_ultima_letra_sin_margen_derecho() {
  const ms = ((2 * 86400) + (14 * 3600) + (3 * 60) + 25) * 1000;
  const html = formatCountdownHtml(ms);
  assert.ok(html.includes('<span style="font-size: 11px; margin: 0 0 0 3px;">s</span>'));
  assert.ok(!html.includes('<span style="font-size: 11px; margin: 0 7px 0 3px;">s</span>'));
}

function test_isoToDatetimeLocal_vacio() {
  assert.strictEqual(isoToDatetimeLocal(null), '');
  assert.strictEqual(isoToDatetimeLocal(''), '');
}

function test_datetimeLocalToIso_vacio() {
  assert.strictEqual(datetimeLocalToIso(''), null);
  assert.strictEqual(datetimeLocalToIso(null), null);
}

function test_datetimeLocalToIso_redondea_minutos() {
  const iso = datetimeLocalToIso('2026-09-08T20:00');
  assert.ok(iso.startsWith('2026-09-08T'));
}

const tests = [
  test_dentro_de_fase_cuenta_al_fin,
  test_antes_de_siguiente_fase_cuenta_al_inicio,
  test_sin_fechas_devuelve_null,
  test_fase_postfinal_devuelve_null,
  test_fase_postfinal_con_fechas_en_rango_devuelve_null,
  test_antes_del_inicio_de_la_propia_fase_cuenta_al_inicio_de_siguiente,
  test_formatCountdown_basico,
  test_formatCountdown_cero_o_negativo,
  test_formatCountdown_unidades_pequeñas,
  test_formatCountdownHtml_cero_o_negativo,
  test_formatCountdownHtml_estilos_y_contenido,
  test_formatCountdownHtml_ultima_letra_sin_margen_derecho,
  test_isoToDatetimeLocal_vacio,
  test_datetimeLocalToIso_vacio,
  test_datetimeLocalToIso_redondea_minutos,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
