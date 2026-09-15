const assert = require('assert');
const { isGuestUser, isFrozenForUser, shouldShowConfirmForUser, guestBadgeHtml, adminShowsGuests, setAdminShowsGuests, hideGuestsForViewer } = require('../js/guestProfile.js');

function test_isGuestUser() {
  assert.strictEqual(isGuestUser({ isGuest: true }), true);
  assert.strictEqual(isGuestUser({ isGuest: false }), false);
  assert.strictEqual(isGuestUser({}), false);
  assert.strictEqual(isGuestUser(null), false);
}

function test_isFrozenForUser() {
  assert.strictEqual(isFrozenForUser(true, { isGuest: true }), false);
  assert.strictEqual(isFrozenForUser(true, { isGuest: false }), true);
  assert.strictEqual(isFrozenForUser(false, { isGuest: false }), false);
}

function test_shouldShowConfirmForUser() {
  assert.strictEqual(shouldShowConfirmForUser({ isGuest: true }), false);
  assert.strictEqual(shouldShowConfirmForUser({ isGuest: false }), true);
}

function test_guestBadgeHtml() {
  assert.strictEqual(guestBadgeHtml(true), ' <span class="guest-tag" title="Invitado">INV</span>');
  assert.strictEqual(guestBadgeHtml(false), '');
  assert.strictEqual(guestBadgeHtml(undefined), '');
}

function test_adminShowsGuests_default_and_set() {
  const store = {
    _s: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; }
  };
  global.localStorage = store;
  store.removeItem('porra_admin_show_guests');
  assert.strictEqual(adminShowsGuests(), false, 'default excluir');

  setAdminShowsGuests(true);
  assert.strictEqual(adminShowsGuests(), true);
  assert.strictEqual(store.getItem('porra_admin_show_guests'), 'true');

  setAdminShowsGuests(false);
  assert.strictEqual(adminShowsGuests(), false);
  assert.strictEqual(store.getItem('porra_admin_show_guests'), 'false');
}

function test_hideGuestsForViewer() {
  global.localStorage = {
    _s: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
    setItem(k, v) { this._s[k] = String(v); },
    removeItem(k) { delete this._s[k]; }
  };
  setAdminShowsGuests(false);
  assert.strictEqual(hideGuestsForViewer({ isAdmin: true }), true, 'admin con pref off oculta invitados');
  assert.strictEqual(hideGuestsForViewer({ isAdmin: false }), false);
  assert.strictEqual(hideGuestsForViewer({ isGuest: true }), false);
  assert.strictEqual(hideGuestsForViewer(null), false);

  setAdminShowsGuests(true);
  assert.strictEqual(hideGuestsForViewer({ isAdmin: true }), false, 'admin con pref on no oculta');
}

const tests = [test_isGuestUser, test_isFrozenForUser, test_shouldShowConfirmForUser, test_guestBadgeHtml, test_adminShowsGuests_default_and_set, test_hideGuestsForViewer];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
