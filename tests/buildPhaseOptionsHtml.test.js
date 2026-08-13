const assert = require('assert');

function buildPhaseOptionsHtml(fases, faseActual) {
  return (fases || [])
    .map(f => `<option value="${f.nombre}"${f.nombre === faseActual ? ' selected' : ''}>${f.desc || f.nombre}</option>`)
    .join('');
}

const FASE = { id: 1, nombre: 'FASE_PRETEMPORADA', desc: 'Pretemporada' };
const LIGA = { id: 2, nombre: 'FASE_LIGA', desc: 'Liga' };

const tests = [
  {
    name: 'genera una opcion por fase en el orden dado',
    fn: () => {
      const html = buildPhaseOptionsHtml([FASE, LIGA], 'FASE_LIGA');
      assert.strictEqual(html, '<option value="FASE_PRETEMPORADA">Pretemporada</option>' +
        '<option value="FASE_LIGA" selected>Liga</option>');
    }
  },
  {
    name: 'marca selected solo en la fase actual',
    fn: () => {
      const html = buildPhaseOptionsHtml([FASE, LIGA], 'FASE_PRETEMPORADA');
      assert.ok(html.includes('value="FASE_PRETEMPORADA" selected'));
      assert.ok(!html.includes('value="FASE_LIGA" selected'));
    }
  },
  {
    name: 'usa nombre como fallback cuando no hay desc',
    fn: () => {
      const sinDesc = { id: 3, nombre: 'FASE_X' };
      const html = buildPhaseOptionsHtml([sinDesc], 'FASE_X');
      assert.strictEqual(html, '<option value="FASE_X" selected>FASE_X</option>');
    }
  },
  {
    name: 'devuelve string vacio con fases vacio o ausente',
    fn: () => {
      assert.strictEqual(buildPhaseOptionsHtml([], 'FASE_X'), '');
      assert.strictEqual(buildPhaseOptionsHtml(undefined, 'FASE_X'), '');
    }
  }
];

let failed = 0;
for (const t of tests) {
  try {
    t.fn();
    console.log(`PASS ${t.name}`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${t.name}: ${e.message}`);
  }
}
process.exit(failed > 0 ? 1 : 0);
