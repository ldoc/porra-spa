const assert = require('assert');

const FASE_ORDER = ['liga', '16', '8', '4', 'semis', 'final'];

function journeySortValue(journey, matchesByJourney) {
  const first = matchesByJourney[journey]?.[0]?.match;
  if (!first) return [999, 0];
  const faseIdx = FASE_ORDER.indexOf(first.fase);
  return [faseIdx < 0 ? 999 : faseIdx, first.ronda || 0];
}

function sortJourneys(journeys, matchesByJourney) {
  return [...journeys].sort((a, b) => {
    const [fa, ra] = journeySortValue(a, matchesByJourney);
    const [fb, rb] = journeySortValue(b, matchesByJourney);
    if (fa !== fb) return fa - fb;
    return ra - rb;
  });
}

function test_dieciseisavos_despues_de_jornada8() {
  const mbj = {
    'Dieciseisavos': [{ match: { fase: '16', ronda: 1 } }],
    'Liga - Jornada 8': [{ match: { fase: 'liga', ronda: 8 } }],
    'Liga - Jornada 1': [{ match: { fase: 'liga', ronda: 1 } }],
    'Liga - Jornada 3': [{ match: { fase: 'liga', ronda: 3 } }],
  };
  const sorted = sortJourneys(Object.keys(mbj), mbj);
  assert.deepStrictEqual(sorted, [
    'Liga - Jornada 1',
    'Liga - Jornada 3',
    'Liga - Jornada 8',
    'Dieciseisavos'
  ]);
}

function test_octavos_despues_de_dieciseisavos() {
  const mbj = {
    'Octavos': [{ match: { fase: '8', ronda: 1 } }],
    'Dieciseisavos': [{ match: { fase: '16', ronda: 1 } }],
    'Liga - Jornada 8': [{ match: { fase: 'liga', ronda: 8 } }],
  };
  const sorted = sortJourneys(Object.keys(mbj), mbj);
  assert.deepStrictEqual(sorted, [
    'Liga - Jornada 8',
    'Dieciseisavos',
    'Octavos'
  ]);
}

function test_orden_no_importa_la_insercion() {
  const mbj = {
    'Cuartos': [{ match: { fase: '4', ronda: 1 } }],
    'Liga - Jornada 2': [{ match: { fase: 'liga', ronda: 2 } }],
    'Semifinal': [{ match: { fase: 'semis', ronda: 1 } }],
    'Dieciseisavos': [{ match: { fase: '16', ronda: 1 } }],
  };
  const sorted = sortJourneys(Object.keys(mbj), mbj);
  assert.deepStrictEqual(sorted, [
    'Liga - Jornada 2',
    'Dieciseisavos',
    'Cuartos',
    'Semifinal'
  ]);
}

const tests = [test_dieciseisavos_despues_de_jornada8, test_octavos_despues_de_dieciseisavos, test_orden_no_importa_la_insercion];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
