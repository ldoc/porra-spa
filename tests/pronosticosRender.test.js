const assert=require('assert');
const fs=require('fs');
const src=fs.readFileSync('js/stats.js','utf8');
assert(src.includes('renderPronosticosBody'), 'debe existir renderPronosticosBody');
assert(src.includes('pronosticos-partidos') || src.includes('Pronósticos de partidos'), 'debe renderizar partidos card');
console.log('OK render');
