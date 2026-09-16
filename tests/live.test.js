const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveLiveRefreshSecs } = require('../js/live.js');

test('el servidor manda, fichero de respaldo, default 60', () => {
  assert.equal(resolveLiveRefreshSecs(45, 30), 30);
  assert.equal(resolveLiveRefreshSecs(45, null), 45);
  assert.equal(resolveLiveRefreshSecs(null, null), 60);
  assert.equal(resolveLiveRefreshSecs(-3, 0), 60);
});
