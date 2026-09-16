(function (global) {
  const LIVE_DEFAULT_SECS = 60;

  function validSecs(v) {
    return Number.isInteger(v) && v > 0 ? v : null;
  }

  function resolveLiveRefreshSecs(fileSecs, serverSecs) {
    return validSecs(serverSecs) ?? validSecs(fileSecs) ?? LIVE_DEFAULT_SECS;
  }

  const liveApi = { resolveLiveRefreshSecs, LIVE_DEFAULT_SECS };
  global.liveApi = liveApi;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = liveApi;
  }
})(typeof window !== 'undefined' ? window : globalThis);
