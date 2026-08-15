const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '../reglas/UCL.html'), 'utf8');

function test_tiene_las_4_secciones() {
  for (const id of ['fase-liga', 'fase-final', 'puntuacion', 'plantilla']) {
    assert.ok(html.includes(`id="${id}"`), `falta la sección #${id}`);
  }
}

function test_contenido_clave() {
  const markers = ['FASE DE LIGA', '36 equipos', 'JORNADA 1', 'PLAY-OFF', 'OCTAVOS DE FINAL',
    'CUARTOS DE FINAL', 'SEMIFINALES', '15 puntos', '60 puntos', '575 puntos',
    '25 jugadores', 'SOFASCORE', 'portería a cero'];
  for (const m of markers) {
    assert.ok(html.toLowerCase().includes(m.toLowerCase()), `falta el contenido: "${m}"`);
  }
}

// runner
const tests = [
  ['4 secciones con id', test_tiene_las_4_secciones],
  ['contenido clave del PDF', test_contenido_clave],
];
let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (e) { failed++; console.error(`FAIL - ${name}: ${e.message}`); }
}
process.exit(failed ? 1 : 0);
