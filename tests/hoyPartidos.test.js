const assert = require('assert');
const {
  isHoyPartidosAllowed, getMatchResult, getTodayMatches,
  computeResultCounts, computeBestResult, getRealResult,
  calcMatchPoints, formatMatchTime
} = require('../js/hoyPartidos.js');

function test_isHoyPartidosAllowed_solo_fases_activas() {
  const activas = ['FASE_LIGA', 'FASE_16', 'FASE_8', 'FASE_4', 'FASE_SEMIS', 'FASE_FINAL'];
  const inactivas = ['FASE_PRETEMPORADA', 'FASE_PRE16', 'FASE_PRE8', 'FASE_PRE4', 'FASE_PRESEMIS', 'FASE_PREFINAL', 'FASE_POSTFINAL'];
  for (const f of activas) assert.strictEqual(isHoyPartidosAllowed(f), true, `${f} debería permitirse`);
  for (const f of inactivas) assert.strictEqual(isHoyPartidosAllowed(f), false, `${f} no debería permitirse`);
}

function test_getMatchResult_tres_casos() {
  assert.strictEqual(getMatchResult(2, 1), 'H');
  assert.strictEqual(getMatchResult(1, 1), 'D');
  assert.strictEqual(getMatchResult(0, 3), 'A');
}

function test_getTodayMatches_misma_fecha_local_y_fase() {
  // 2026-09-08 21:00 local = timestamp en segundos
  const now = new Date(2026, 8, 8, 12, 0, 0).getTime(); // 8 Sep 2026 12:00 local
  const fechaHoy = new Date(2026, 8, 8, 21, 0, 0);
  const fechaOtroDia = new Date(2026, 8, 9, 21, 0, 0);
  const matches = [
    { id: 1, fase: 'liga', fechaTs: Math.floor(fechaHoy.getTime() / 1000) },
    { id: 2, fase: '16', fechaTs: Math.floor(fechaHoy.getTime() / 1000) },   // otra fase
    { id: 3, fase: 'liga', fechaTs: Math.floor(fechaOtroDia.getTime() / 1000) } // otro día
  ];
  const res = getTodayMatches(matches, now, 'liga');
  assert.deepStrictEqual(res.map(m => m.id), [1]);
}

function test_getTodayMatches_sin_partidos_devuelve_vacio() {
  const now = new Date(2026, 8, 9, 12, 0, 0).getTime();
  const matches = [{ id: 1, fase: 'liga', fechaTs: Math.floor(new Date(2026, 8, 8, 21, 0, 0).getTime() / 1000) }];
  assert.deepStrictEqual(getTodayMatches(matches, now, 'liga'), []);
}

function test_computeResultCounts_conteos_y_pct() {
  const allPredictions = {
    a: { 100: { home: 2, away: 1 } },   // H
    b: { 100: { home: 1, away: 1 } },   // D
    c: { 100: { home: 0, away: 2 } },   // A
    d: { 100: { home: 1, away: 0 } },   // H
    e: { 100: { home: null, away: null } }, // sin pronóstico → se ignora
    f: {}                                // sin pronóstico → se ignora
  };
  const r = computeResultCounts(100, allPredictions);
  assert.strictEqual(r.total, 4);
  assert.deepStrictEqual(r.counts, { H: 2, D: 1, A: 1 });
  assert.strictEqual(r.pct.H, 0.5);
  assert.strictEqual(r.pct.D, 0.25);
  assert.strictEqual(r.pct.A, 0.25);
}

function test_computeResultCounts_sin_datos() {
  const r = computeResultCounts(100, { a: {}, b: { 100: { home: null, away: null } } });
  assert.strictEqual(r.total, 0);
  assert.deepStrictEqual(r.pct, { H: 0, D: 0, A: 0 });
}

function test_computeBestResult_pronostico_minoritario_gana() {
  const counts = { counts: { H: 3, D: 1, A: 2 }, total: 6, pct: { H: 0.5, D: 1 / 6, A: 1 / 3 } };
  // Mi pronóstico es D (minoría) → ventaja D = 8*(1-1/6)=6.67 > H=4 > A=8*(2/3)=5.33? no: A no es mío → -8*(1/3)
  const best = computeBestResult(counts, 'D');
  assert.strictEqual(best.result, 'D');
  assert.ok(Math.abs(best.advantage - 8 * (1 - 1 / 6)) < 1e-9);
}

function test_computeBestResult_sin_total_o_sin_pronostico_devuelve_null() {
  const counts = { counts: { H: 0, D: 0, A: 0 }, total: 0, pct: { H: 0, D: 0, A: 0 } };
  assert.strictEqual(computeBestResult(counts, 'H'), null);
  const counts2 = { counts: { H: 3, D: 1, A: 2 }, total: 6, pct: { H: 0.5, D: 1 / 6, A: 1 / 3 } };
  assert.strictEqual(computeBestResult(counts2, null), null);
}

function test_getRealResult_y_calcMatchPoints() {
  const match = { id: 5, homeTeamId: 10, awayTeamId: 20 };
  const matchStats = [
    { eventId: 5, stats: { 10: { goles: 1 }, 20: { goles: 1 } } },
    { eventId: 6, stats: { 10: { goles: 1 } } } // incompleto → null
  ];
  assert.deepStrictEqual(getRealResult(match, matchStats), { home: 1, away: 1 });
  assert.strictEqual(getRealResult({ id: 6, homeTeamId: 10, awayTeamId: 20 }, matchStats), null);
  assert.strictEqual(getRealResult({ id: 99, homeTeamId: 10, awayTeamId: 20 }, matchStats), null);

  // Acierto exacto 1-1 → 8+3+3+1 = 15
  assert.strictEqual(calcMatchPoints({ home: 1, away: 1 }, 1, 1), 15);
  // Resultado distinto (H vs D) y ningún gol → 0
  assert.strictEqual(calcMatchPoints({ home: 2, away: 0 }, 1, 1), 0);
  // Resultado distinto (H vs D), acierto solo de goles local → 3
  assert.strictEqual(calcMatchPoints({ home: 1, away: 0 }, 1, 1), 3);
  // Sin pronóstico → 0
  assert.strictEqual(calcMatchPoints(null, 1, 1), 0);
}

function test_formatMatchTime_formato_esperado() {
  const ts = new Date(2026, 8, 8, 21, 5).getTime() / 1000; // 8 Sep 2026 21:05 local
  const s = formatMatchTime(ts);
  assert.match(s, /Sep/);
  assert.match(s, /21:05/);
}

test_isHoyPartidosAllowed_solo_fases_activas();
test_getMatchResult_tres_casos();
test_getTodayMatches_misma_fecha_local_y_fase();
test_getTodayMatches_sin_partidos_devuelve_vacio();
test_computeResultCounts_conteos_y_pct();
test_computeResultCounts_sin_datos();
test_computeBestResult_pronostico_minoritario_gana();
test_computeBestResult_sin_total_o_sin_pronostico_devuelve_null();
test_getRealResult_y_calcMatchPoints();
test_formatMatchTime_formato_esperado();
