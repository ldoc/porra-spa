const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// `js/main.js` no es un módulo (script de navegador): extraemos la función pura
// de su fuente para poder probarla en Node sin arrancar el DOM.
function loadLiveV2Abbr() {
  const src = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
  const match = src.match(/function liveV2Abbr\(name\) \{[\s\S]*?\n\}/);
  assert.ok(match, 'liveV2Abbr(name) debe existir en js/main.js');
  return new Function(`${match[0]}\nreturn liveV2Abbr;`)();
}

const liveV2Abbr = loadLiveV2Abbr();

test('liveV2Abbr ignora los tokens de club y usa las 3 primeras letras', () => {
  assert.equal(liveV2Abbr('Real Madrid'), 'REA');
  assert.equal(liveV2Abbr('FC Barcelona'), 'BAR');
  assert.equal(liveV2Abbr('AS Roma'), 'ROM');
  assert.equal(liveV2Abbr('Inter'), 'INT');
  assert.equal(liveV2Abbr('SK Slavia Praha'), 'SLA');
});

test('liveV2Abbr normaliza acentos y descarta numeración ("1.")', () => {
  assert.equal(liveV2Abbr('1. FC Köln'), 'KOL');
  assert.equal(liveV2Abbr('Bayern München'), 'BAY');
});

test('liveV2Abbr es determinista y tolera entradas vacías', () => {
  assert.equal(liveV2Abbr('AC Milan'), 'MIL');
  assert.equal(liveV2Abbr('AC Milan'), liveV2Abbr('AC Milan'));
  assert.equal(liveV2Abbr(''), '?');
  assert.equal(liveV2Abbr(null), '?');
});
