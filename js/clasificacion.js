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

  function sortClasificacionJugadores(rows, sortBy) {
    return sortClasificacionJugadoresPorFuente(rows, sortBy);
  }

  /**
   * Orden por fuente elegida en la tabla de Clasificacion:
   * columna desc y, en empate, desempate de normas (total > elim > plantilla > clasif > pron).
   */
  function sortClasificacionJugadoresPorFuente(rows, sortBy) {
    const keys = {
      pronosticos: 'predictionPoints',
      plantilla: 'squadPoints',
      clasificacion: 'classificationPoints',
      eliminatorias: 'eliminatoriasPoints'
    };
    const key = keys[sortBy];
    if (!key) return [...(rows || [])].sort(compareClasificacionJugadores);
    return [...(rows || [])].sort((a, b) => num(b[key]) - num(a[key]) || compareClasificacionJugadores(a, b));
  }

  /**
   * Decide si los puntos por clasificación entran en el total:
   * en fases donde ya cuentan manda el comportamiento por fase;
   * fuera de ellas, solo si la pantalla lo pide explícitamente (toggle).
   */
  function shouldCountClassification(countsNow, includeClassification) {
    return countsNow ? true : includeClassification === true;
  }

  const api = { compareClasificacionJugadores, sortClasificacionJugadores, sortClasificacionJugadoresPorFuente, shouldCountClassification };
  global.clasificacionApi = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
