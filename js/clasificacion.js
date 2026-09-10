(function (global) {
  function num(v) {
    return typeof v === 'number' && isFinite(v) ? v : 0;
  }

  /**
   * Comparador de clasificación de jugadores según normas
   * (reglas/UCL.html #clasificacion-final): total desc,
   * luego eliminatorias > plantilla > clasificación > pronósticos.
   * Todo igual -> 0 (comparten puesto).
   */
  function compareClasificacionJugadores(a, b) {
    const r = num(b.realPoints) - num(a.realPoints);
    if (r !== 0) return r;
    const e = num(b.eliminatoriasPoints) - num(a.eliminatoriasPoints);
    if (e !== 0) return e;
    const s = num(b.squadPoints) - num(a.squadPoints);
    if (s !== 0) return s;
    const c = num(b.classificationPoints) - num(a.classificationPoints);
    if (c !== 0) return c;
    const p = num(b.predictionPoints) - num(a.predictionPoints);
    if (p !== 0) return p;
    return 0;
  }

  function sortClasificacionJugadores(rows) {
    return [...(rows || [])].sort(compareClasificacionJugadores);
  }

  const api = { compareClasificacionJugadores, sortClasificacionJugadores };
  global.clasificacionApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
