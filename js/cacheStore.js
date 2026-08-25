(function (global) {
  const KEYS = {
    matchstats: 'porra_cache_matchstats_v1'
  };
  const PREDALL_PREFIX = 'porra_cache_predall_v1_';
  const MAX_BYTES = 2 * 1024 * 1024;

  function predKey(username) {
    return `${PREDALL_PREFIX}${username}`;
  }

  function serialize(payload, serverTime) {
    return JSON.stringify({ payload, serverTime: serverTime || null });
  }

  function cacheGet(key) {
    try {
      const raw = global.localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !('payload' in parsed)) return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function cacheSet(key, payload, serverTime) {
    try {
      const wrapped = serialize(payload, serverTime);
      if (wrapped.length > MAX_BYTES) return false;
      global.localStorage.setItem(key, wrapped);
      return true;
    } catch (e) {
      try {
        clearPorraCaches();
        const wrapped = serialize(payload, serverTime);
        if (wrapped.length <= MAX_BYTES) {
          global.localStorage.setItem(key, wrapped);
          return true;
        }
      } catch (e2) {
        // Cuota insuperable: seguir sin cache
      }
      return false;
    }
  }

  function cacheRemove(key) {
    try {
      global.localStorage.removeItem(key);
    } catch (e) {
      // noop
    }
  }

  function clearPorraCaches() {
    try {
      const toRemove = [];
      for (let i = 0; i < global.localStorage.length; i++) {
        const k = global.localStorage.key(i);
        if (k && (k === KEYS.matchstats || k.indexOf(PREDALL_PREFIX) === 0)) toRemove.push(k);
      }
      toRemove.forEach(k => global.localStorage.removeItem(k));
    } catch (e) {
      // noop
    }
  }

  /**
   * Fusiona un delta de match-stats sobre el array actual.
   * El delta sobreescribe por eventId; los nuevos se añaden al final.
   * Idempotente: aplicar el conjunto completo dos veces da el mismo resultado.
   */
  function mergeMatchStats(current, delta) {
    const map = new Map((Array.isArray(current) ? current : []).map(m => [m.eventId, m]));
    if (Array.isArray(delta)) {
      for (const item of delta) map.set(item.eventId, item);
    }
    return Array.from(map.values());
  }

  const porraCache = { KEYS, predKey, cacheGet, cacheSet, cacheRemove, clearPorraCaches, mergeMatchStats };

  global.porraCache = porraCache;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = porraCache;
  }
})(typeof window !== 'undefined' ? window : globalThis);
