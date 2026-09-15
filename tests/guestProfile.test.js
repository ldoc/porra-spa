const assert = require('assert');
const { isGuestUser, isFrozenForUser, shouldShowConfirmForUser, guestBadgeHtml } = require('../js/guestProfile.js');

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

const tests = [test_isGuestUser, test_isFrozenForUser, test_shouldShowConfirmForUser, test_guestBadgeHtml];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
