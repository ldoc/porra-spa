const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../reglas/UCL.html'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../css/styles.css'), 'utf8');
const NEEDED_CSS = [
  '.user-help-pill', '.rules-modal', '.rules-overlay', '.rules-modal-content',
  '.rules-header', '.rules-title', '.rules-close', '.rules-chips', '.rules-chip',
  '.rules-body', '.rules-loading', '.rules-error',
  '.rules-section', '.rules-section-head', '.rules-table', '.rules-pts',
];

function test_tiene_las_secciones() {
  for (const id of ['introduccion', 'acceso-plataforma', 'fase-pretemporada',
    'fase-eliminatorias', 'puntuacion', 'pronostico-partidos',
    'pronostico-clasificacion', 'pronostico-eliminatorias', 'plantilla',
    'clasificacion-final']) {
    assert.ok(html.includes(`id="${id}"`), `falta la sección #${id}`);
  }
}

function test_contenido_clave() {
  const markers = [
    'INTRODUCCIÓN', '5 €', 'bote',
    'ACCESO A LA PLATAFORMA', 'código de invitación',
    'FASE DE PRETEMPORADA', '144 partidos', 'PRONOSTICO DE PARTIDOS DE LA FASE DE LIGA',
    'PRONOSTICO DE RESULTADOS DE LAS ELIMINATORIAS', 'Dieciseisavos de Final',
    'CONFECCIÓN DE LA PLANTILLA', '25 jugadores',
    'FASE DE ELIMINATORIAS', '23:59 horas del día previo',
    'PUNTUACIÓN', 'PRONOSTICO DE PARTIDOS', '189 partidos', '2.835 puntos',
    'PRONÓSTICO DE CLASIFICACIÓN', '420 puntos',
    'PRONÓSTICO DE ELIMINATORIAS', '575 puntos',
    'PLANTILLA', 'SOFASCORE', 'PUNTUACIÓN POR ASISTENCIAS DE GOL',
    'PUNTUACIÓN DE PORTEROS', 'PUNTUACIÓN POR PORTERÍA A CERO',
    'CLASIFICACIÓN FINAL',
  ];
  for (const m of markers) {
    assert.ok(html.toLowerCase().includes(m.toLowerCase()), `falta el contenido: "${m}"`);
  }
}

function test_no_contenido_viejo() {
  const oldMarkers = [
    'JORNADA 1', 'JORNADA 2', '27 de agosto de 2026',
    '4 bombos con 9 equipos', 'coeficiente UEFA',
    'Play-off', 'FASE DE LIGA del torneo participan un total de 36 equipos',
    'DESCRIPCIÓN DEL TORNEO DE PORRA UCL 26-27',
  ];
  for (const m of oldMarkers) {
    assert.ok(!html.includes(m), `no debe estar el contenido viejo: "${m}"`);
  }
}

function test_header_tiene_copa_y_pill_ayuda() {
  assert.ok(indexHtml.includes('🏆'), 'brand-icon debería ser 🏆');
  assert.ok(indexHtml.includes('id="user-help-pill"'), 'falta el pill de ayuda');
}

function test_modal_reglas_presente() {
  assert.ok(indexHtml.includes('id="rules-modal"'), 'falta el modal de reglas');
  assert.ok(indexHtml.includes('id="rules-body"'), 'falta el contenedor rules-body');
  assert.ok(!indexHtml.includes('reglas/UCL.pdf'), 'no debe quedar enlace al PDF original');
}

function test_chips_matched_a_secciones() {
  const chipTargets = [...indexHtml.matchAll(/data-target="(#introduccion|#fase-pretemporada|#fase-eliminatorias|#puntuacion|#pronostico-partidos|#pronostico-clasificacion|#pronostico-eliminatorias|#plantilla|#clasificacion-final)"/g)].map(m => m[1]);
  assert.ok(chipTargets.length >= 8, `debe haber al menos 8 chips, hay ${chipTargets.length}`);
  for (const t of chipTargets) {
    assert.ok(html.includes(`id="${t.slice(1)}"`), `el chip ${t} no tiene sección en UCL.html`);
  }
}

function test_estilos_definidos() {
  for (const cls of NEEDED_CSS) {
    assert.ok(css.includes(cls), `falta la clase CSS ${cls}`);
  }
}

const tests = [
  ['secciones del PDF', test_tiene_las_secciones],
  ['contenido clave del PDF', test_contenido_clave],
  ['sin contenido viejo', test_no_contenido_viejo],
  ['header con copa y pill ayuda', test_header_tiene_copa_y_pill_ayuda],
  ['modal de reglas presente', test_modal_reglas_presente],
  ['chips matched a secciones', test_chips_matched_a_secciones],
  ['estilos definidos', test_estilos_definidos],
];
let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (e) { failed++; console.error(`FAIL - ${name}: ${e.message}`); }
}
process.exit(failed ? 1 : 0);
