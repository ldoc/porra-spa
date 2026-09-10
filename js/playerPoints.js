(function (global) {
  /**
   * Convierte una puntuación Sofascore (rating) en puntos de porra.
   * Reglas (AGENTS.md §1.1):
   *  - 6.0 = 0 puntos.
   *  - Por encima de 6: 1 punto por cada 0.3 completos (máx 13).
   *  - Hasta 5.7 inclusive: -1 punto.
   *  - Por debajo de 5.7: -1 punto y 1 negativo adicional por cada 0.3
   *    completos de menos (máx -13).
   *
   * Se opera en décimas enteras para evitar errores de coma flotante
   * (p. ej. (6.6 - 6) / 0.3 = 1.999... en JS, que truncaba a 1).
   */
  function ratingToPoints(rating) {
    if (typeof rating !== 'number' || !isFinite(rating) || rating <= 0) return 0;
    const tenths = Math.round(rating * 10);
    if (tenths >= 60) return Math.min(13, Math.floor((tenths - 60) / 3));
    if (tenths >= 57) return -1;
    return Math.max(-13, -1 - Math.floor((57 - tenths) / 3));
  }

  const api = { ratingToPoints };
  global.playerPointsApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
