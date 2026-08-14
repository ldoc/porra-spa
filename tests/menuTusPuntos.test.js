const assert = require('assert');

const POINTS_MENU_TABS = [
  { tab: 'pronosticos', label: 'Pronósticos', cls: 'tile-pronosticos', icon: '<svg viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>' },
  { tab: 'plantilla', label: 'Plantilla', cls: 'tile-plantilla', icon: '<svg viewBox="0 0 24 24"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>' },
  { tab: 'clasificacion', label: 'Clasificación', cls: 'tile-clasificacion', icon: '<svg viewBox="0 0 24 24"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>' },
  { tab: 'final-predictions', label: 'Eliminatorias', cls: 'tile-eliminatorias', icon: '<svg viewBox="0 0 24 24"><path d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0"/></svg>' },
];

function buildPointsMenuHtml(totalPoints) {
  const tiles = POINTS_MENU_TABS.map(t => `
      <div class="points-tile ${t.cls}" data-tab="${t.tab}">${t.icon}<span>${t.label}</span></div>`).join('');
  return `
    <div class="points-menu">
      <button class="points-trigger" id="points-trigger" type="button" aria-haspopup="true" aria-expanded="false">
        <span class="points-lbl">Tus puntos</span>
        <span class="points-row">
          <span class="points-star">⭐</span>
          <span class="points-num">${totalPoints}</span>
          <span class="points-chev"><svg viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg></span>
        </span>
      </button>
      <div class="points-dropdown" id="points-dropdown" hidden>
        <div class="points-grid">
          ${tiles}
        </div>
      </div>
    </div>`;
}

function test_mapping_correcto() {
  const esperado = [
    ['pronosticos', 'Pronósticos', 'tile-pronosticos'],
    ['plantilla', 'Plantilla', 'tile-plantilla'],
    ['clasificacion', 'Clasificación', 'tile-clasificacion'],
    ['final-predictions', 'Eliminatorias', 'tile-eliminatorias'],
  ];
  assert.strictEqual(POINTS_MENU_TABS.length, 4, '4 pestañas');
  POINTS_MENU_TABS.forEach((t, i) => {
    const [tab, label, cls] = esperado[i];
    assert.strictEqual(t.tab, tab, `tab ${i}`);
    assert.strictEqual(t.label, label, `label ${i}`);
    assert.strictEqual(t.cls, cls, `cls ${i}`);
  });
}

function test_html_incluye_puntos_y_estrella() {
  const html = buildPointsMenuHtml(123);
  assert.ok(html.includes('⭐'), 'estrella');
  assert.ok(html.includes('>123<'), 'número de puntos');
  assert.ok(html.includes('Tus puntos'), 'etiqueta');
}

function test_html_estado_inicial_cerrado() {
  const html = buildPointsMenuHtml(0);
  assert.ok(html.includes('aria-expanded="false"'), 'aria-expanded cerrado');
  assert.ok(html.includes('hidden'), 'dropdown oculto');
  assert.ok(html.includes('points-dropdown'), 'clase dropdown');
}

function test_html_celdas_con_data_tab() {
  const html = buildPointsMenuHtml(0);
  for (const t of POINTS_MENU_TABS) {
    assert.ok(html.includes(`data-tab="${t.tab}"`), `data-tab ${t.tab}`);
    assert.ok(html.includes(`<span>${t.label}</span>`), `label ${t.label}`);
    assert.ok(html.includes(t.cls), `clase ${t.cls}`);
  }
}

function test_html_chevron() {
  assert.ok(buildPointsMenuHtml(0).includes('M19 9l-7 7-7-7'), 'chevron abajo');
}

const tests = [
  test_mapping_correcto,
  test_html_incluye_puntos_y_estrella,
  test_html_estado_inicial_cerrado,
  test_html_celdas_con_data_tab,
  test_html_chevron,
];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
