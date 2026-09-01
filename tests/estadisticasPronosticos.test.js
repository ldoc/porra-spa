const assert = require('assert');
const fs = require('fs');
const statsSrc = fs.readFileSync('js/stats.js','utf8');
assert(statsSrc.includes("key: 'pronosticos'"), 'SUBTABS debe contener pronosticos');
assert(statsSrc.indexOf("'pronosticos'") < statsSrc.indexOf("'evolucion'"), 'pronosticos debe ser primero');
assert(!statsSrc.includes("key: 'consenso'"), 'consenso debe eliminarse');
const mainSrc = fs.readFileSync('js/main.js','utf8');
assert(mainSrc.includes("estadisticasSubTab: 'pronosticos'"), 'default debe ser pronosticos');
// Stronger: parse SUBTABS block and assert exact 5 and order
const subTabsMatch = statsSrc.match(/const SUBTABS\s*=\s*\[([\s\S]*?)\];/);
assert(subTabsMatch, 'SUBTABS block debe existir');
const subTabsBlock = subTabsMatch[1];
const keys = [...subTabsBlock.matchAll(/key:\s*'([^']+)'/g)].map(m => m[1]);
assert.deepStrictEqual(keys, ['pronosticos','evolucion','individual','rachas','plantillas'], `SUBTABS debe ser exactamente pronosticos,evolucion,individual,rachas,plantillas, got ${keys.join(',')}`);
assert.strictEqual(keys.length, 5, 'SUBTABS debe tener exactamente 5 entradas');
console.log('OK Task1');
