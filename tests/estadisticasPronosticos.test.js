const assert = require('assert');
const fs = require('fs');
const statsSrc = fs.readFileSync('js/stats.js','utf8');
assert(statsSrc.includes("key: 'pronosticos'"), 'SUBTABS debe contener pronosticos');
assert(statsSrc.indexOf("'pronosticos'") < statsSrc.indexOf("'evolucion'"), 'pronosticos debe ser primero');
assert(!statsSrc.includes("key: 'consenso'"), 'consenso debe eliminarse');
const mainSrc = fs.readFileSync('js/main.js','utf8');
assert(mainSrc.includes("estadisticasSubTab: 'pronosticos'"), 'default debe ser pronosticos');
console.log('OK Task1');
