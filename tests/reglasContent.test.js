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

function test_tiene_las_7_secciones() {
  for (const id of ['fase-liga', 'fase-final', 'la-porra', 'puntuacion',
    'eliminatorias', 'plantilla', 'pronostico-fase-final']) {
    assert.ok(html.includes(`id="${id}"`), `falta la sección #${id}`);
  }
}

function test_contenido_clave() {
  const markers = ['FASE DE LIGA', '36 equipos', 'JORNADA 1', 'PLAY-OFF', 'OCTAVOS DE FINAL',
    'CUARTOS DE FINAL', 'SEMIFINALES', '15 puntos', '60 puntos', '575 puntos',
    '25 jugadores', 'SOFASCORE', 'portería a cero',
    'DESCRIPCIÓN DEL TORNEO DE PORRA', '5 de septiembre de 2026',
    'PRONÓSTICO DE PARTIDOS DE LA FASE DE LIGA', '144 partidos',
    'Guardar en servidor', 'Ver Clasificación',
    'PRONÓSTICO DE EQUIPOS QUE PASAN A CADA RONDA', 'SUBCAMPEÓN',
    'PRONÓSTICO DE PARTIDOS DE LA FASE FINAL', '29 de enero de 2027 al 15 de febrero de 2027',
    'PUNTUACIÓN POR PRONÓSTICO DE PARTIDOS', 'PUNTUACIÓN POR PRONÓSTICO DE CLASIFICACIÓN'];
  for (const m of markers) {
    assert.ok(html.toLowerCase().includes(m.toLowerCase()), `falta el contenido: "${m}"`);
  }
}

function test_header_tiene_copa_y_pill_ayuda() {
  assert.ok(indexHtml.includes('🏆'), 'brand-icon debería ser 🏆');
  assert.ok(indexHtml.includes('id="user-help-pill"'), 'falta el pill de ayuda');
  assert.ok(indexHtml.includes('user-help-pill'), 'falta la clase user-help-pill');
}

function test_modal_reglas_presente() {
  assert.ok(indexHtml.includes('id="rules-modal"'), 'falta el modal de reglas');
  assert.ok(indexHtml.includes('id="rules-body"'), 'falta el contenedor rules-body');
  assert.ok(indexHtml.includes('header-right'), 'falta el contenedor header-right');
  assert.ok(indexHtml.includes('id="user-help-pill"'), 'falta el pill de ayuda');
  assert.ok(!indexHtml.includes('onclick="openRulesModal()"'), 'openRulesModal debe bindearse solo en main.js (single binding)');
  assert.ok(indexHtml.includes('closeRulesModal()'), 'falta el handler closeRulesModal');
  assert.ok(!indexHtml.includes('reglas/UCL.pdf'), 'no debe quedar enlace al PDF original');
}

function test_chips_matched_a_secciones() {
  const chipTargets = [...indexHtml.matchAll(/data-target="(#fase-liga|#fase-final|#la-porra|#puntuacion|#eliminatorias|#plantilla|#pronostico-fase-final)"/g)].map(m => m[1]);
  assert.strictEqual(chipTargets.length, 7, 'debe haber 7 chips');
  for (const t of chipTargets) {
    assert.ok(html.includes(`id="${t.slice(1)}"`), `el chip ${t} no tiene sección en UCL.html`);
  }
}

function test_estilos_definidos() {
  for (const cls of NEEDED_CSS) {
    assert.ok(css.includes(cls), `falta la clase CSS ${cls}`);
  }
}

// runner
const tests = [
  ['7 secciones con id', test_tiene_las_7_secciones],
  ['contenido clave del PDF', test_contenido_clave],
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
