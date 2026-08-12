(function (global) {
  /** Agrupa los partidos de una fase en cruces por par desordenado de equipos */
  function groupTies(matches) {
    const byPair = new Map();
    for (const m of matches || []) {
      const tA = Math.min(m.homeTeamId, m.awayTeamId);
      const tB = Math.max(m.homeTeamId, m.awayTeamId);
      const key = `${tA}:${tB}`;
      if (!byPair.has(key)) byPair.set(key, { teamA: tA, teamB: tB, matches: [] });
      byPair.get(key).matches.push(m);
    }
    return [...byPair.values()];
  }

  /**
   * Resuelve un cruce a doble partido por agregado.
   * Devuelve { resuelto, eliminado }. resuelto=false si falta algún resultado
   * o si el agregado queda empatado (tanda de penaltis no implementada).
   */
  function resolveTie(tie, matchStatsById) {
    if (!tie.matches || tie.matches.length < 2) return { resuelto: false, eliminado: null };
    let totA = 0;
    let totB = 0;
    for (const m of tie.matches) {
      const ms = matchStatsById.get(m.id);
      if (!ms) return { resuelto: false, eliminado: null };
      const gA = ms.stats?.[m.homeTeamId]?.goles;
      const gB = ms.stats?.[m.awayTeamId]?.goles;
      if (gA === undefined || gB === undefined) return { resuelto: false, eliminado: null };
      if (m.homeTeamId === tie.teamA) { totA += gA; totB += gB; }
      else { totA += gB; totB += gA; }
    }
    if (totA === totB) return { resuelto: false, eliminado: null };
    return { resuelto: true, eliminado: totA > totB ? tie.teamB : tie.teamA };
  }

  /**
   * Calcula los equipos eliminados en cada ronda de eliminatorias.
   * Devuelve { zonas, final, rondasResueltas }:
   *  - zonas: { '16': [teamId,...], '8': [...], '4': [...], 'semis': [...] } (solo rondas completas)
   *  - final: { campeon: teamId|null, subcampeon: teamId|null }
   *  - rondasResueltas: fases dobles completas + 'final' si la final tiene resultado
   */
  function computeEliminatorias(matches, matchStats) {
    const matchStatsById = new Map((matchStats || []).map(ms => [ms.eventId, ms]));
    const zonas = {};
    const rondasResueltas = [];
    const fasesDobles = ['16', '8', '4', 'semis'];

    for (const fase of fasesDobles) {
      const ties = groupTies((matches || []).filter(m => m.fase === fase));
      if (ties.length === 0) continue; // fase sin cruces aún (no está en el calendario) → no resuelta
      const eliminados = [];
      let completa = true;
      for (const tie of ties) {
        const { resuelto, eliminado } = resolveTie(tie, matchStatsById);
        if (!resuelto) { completa = false; break; }
        eliminados.push(eliminado);
      }
      if (completa) { zonas[fase] = eliminados; rondasResueltas.push(fase); }
    }

    const final = { campeon: null, subcampeon: null };
    const finalMatches = (matches || []).filter(m => m.fase === 'final');
    if (finalMatches.length === 1) {
      const f = finalMatches[0];
      const ms = matchStatsById.get(f.id);
      const gA = ms?.stats?.[f.homeTeamId]?.goles;
      const gB = ms?.stats?.[f.awayTeamId]?.goles;
      if (gA !== undefined && gB !== undefined && gA !== gB) {
        final.campeon = gA > gB ? f.homeTeamId : f.awayTeamId;
        final.subcampeon = gA > gB ? f.awayTeamId : f.homeTeamId;
        rondasResueltas.push('final');
      }
    }

    return { zonas, final, rondasResueltas };
  }

  global.groupTies = groupTies;
  global.resolveTie = resolveTie;
  global.computeEliminatorias = computeEliminatorias;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { groupTies, resolveTie, computeEliminatorias };
  }
})(typeof window !== 'undefined' ? window : globalThis);
