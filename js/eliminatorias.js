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
   * Devuelve el teamId ganador de la tanda de penaltis de un conjunto de
   * partidos, o null si ningún partido tiene tanda completa.
   */
  function getShootoutWinner(matches, matchStatsById) {
    for (const m of matches) {
      const ms = matchStatsById.get(m.id);
      if (!ms) continue;
      const pHome = ms.stats?.[m.homeTeamId]?.tandaPenaltis;
      const pAway = ms.stats?.[m.awayTeamId]?.tandaPenaltis;
      if (pHome !== undefined && pAway !== undefined) {
        if (pHome > pAway) return m.homeTeamId;
        if (pAway > pHome) return m.awayTeamId;
        return null;
      }
    }
    return null;
  }

  /**
   * Resuelve un cruce a doble partido por agregado.
   * Devuelve { resuelto, eliminado }. resuelto=false si falta algún resultado.
   * Si el agregado queda empatado, se desempata por tanda de penaltis
   * (getShootoutWinner); sin tanda, el cruce queda sin resolver.
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
    if (totA === totB) {
      const winner = getShootoutWinner(tie.matches, matchStatsById);
      if (winner === null) return { resuelto: false, eliminado: null };
      return { resuelto: true, eliminado: winner === tie.teamA ? tie.teamB : tie.teamA };
    }
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
      if (gA !== undefined && gB !== undefined) {
        if (gA !== gB) {
          final.campeon = gA > gB ? f.homeTeamId : f.awayTeamId;
          final.subcampeon = gA > gB ? f.awayTeamId : f.homeTeamId;
          rondasResueltas.push('final');
        } else {
          const winner = getShootoutWinner([f], matchStatsById);
          if (winner !== null) {
            final.campeon = winner;
            final.subcampeon = winner === f.homeTeamId ? f.awayTeamId : f.homeTeamId;
            rondasResueltas.push('final');
          }
        }
      }
    }

    return { zonas, final, rondasResueltas };
  }

  /**
   * Calcula el rango de fase final alcanzado por cada equipo del cuadro real.
   * Rangos: 0=no llega, 1=dieciseisavos, 2=octavos, 3=cuartos, 4=semis,
   * 5=final(subcampeón), 6=campeón.
   * Provisional con fase mínima: un equipo que avanza de ronda o cuyo cruce
   * está pendiente se queda en el rango de la fase en la que está.
   */
  function computeReachedPhases(matches, matchStats) {
    const matchStatsById = new Map((matchStats || []).map(ms => [ms.eventId, ms]));
    const reached = {};
    const fasesDobles = ['16', '8', '4', 'semis'];
    const rankByFase = { '16': 1, '8': 2, '4': 3, 'semis': 4 };

    for (const fase of fasesDobles) {
      const ties = groupTies((matches || []).filter(m => m.fase === fase));
      for (const tie of ties) {
        const { resuelto, eliminado } = resolveTie(tie, matchStatsById);
        if (resuelto) {
          // Eliminado en esta ronda → rango definitivo de esta fase
          reached[eliminado] = rankByFase[fase];
          // El ganador avanza a la siguiente fase (rango +1) de forma provisional
          const ganador = eliminado === tie.teamA ? tie.teamB : tie.teamA;
          if (!reached[ganador] || reached[ganador] <= rankByFase[fase]) {
            reached[ganador] = rankByFase[fase] + 1;
          }
        } else {
          // Cruce pendiente: ambos siguen vivos en esta fase (fase mínima)
          if (!reached[tie.teamA]) reached[tie.teamA] = rankByFase[fase];
          if (!reached[tie.teamB]) reached[tie.teamB] = rankByFase[fase];
        }
      }
    }

    const finalMatches = (matches || []).filter(m => m.fase === 'final');
    for (const f of finalMatches) {
      const ms = matchStatsById.get(f.id);
      const gA = ms?.stats?.[f.homeTeamId]?.goles;
      const gB = ms?.stats?.[f.awayTeamId]?.goles;
      if (gA !== undefined && gB !== undefined && gA !== gB) {
        reached[gA > gB ? f.homeTeamId : f.awayTeamId] = 6;
        reached[gA > gB ? f.awayTeamId : f.homeTeamId] = 5;
      } else if (gA !== undefined && gB !== undefined) {
        const winner = getShootoutWinner([f], matchStatsById);
        if (winner !== null) {
          reached[winner] = 6;
          reached[winner === f.homeTeamId ? f.awayTeamId : f.homeTeamId] = 5;
        } else {
          // Final empatada sin tanda: ambos alcanzaron la final (provisional)
          reached[f.homeTeamId] = 5;
          reached[f.awayTeamId] = 5;
        }
      } else {
        // Final pendiente: ambos alcanzaron la final (provisional)
        reached[f.homeTeamId] = 5;
        reached[f.awayTeamId] = 5;
      }
    }

    return reached;
  }

  const PUNTOS_ELIMINATORIAS = [0, 10, 15, 25, 50, 75, 100]; // index = rango

  /**
   * Calcula los puntos de eliminatorias de un usuario.
   * Regla: puntos = PUNTOS[min(rangoPronosticado, rangoAlcanzado)].
   * max = 100+75+2*50+4*25+8*15+8*10 = 575.
   */
  function calculateEliminatoriasPoints(finalPredictions, reachedPhases) {
    if (!finalPredictions) return { totalPoints: 0, teamDetails: [] };
    const reached = reachedPhases || {};
    const teamDetails = [];
    let totalPoints = 0;

    const zones = [
      { key: 'champion', rank: 6 },
      { key: 'runnerUp', rank: 5 },
      { key: 'semiFinalists', rank: 4 },
      { key: 'quarterFinalists', rank: 3 },
      { key: 'roundOf16', rank: 2 },
      { key: 'roundOf32', rank: 1 },
    ];

    for (const zone of zones) {
      const ids = Array.isArray(finalPredictions[zone.key])
        ? finalPredictions[zone.key]
        : [finalPredictions[zone.key]];
      for (const teamId of ids) {
        if (!teamId) continue;
        const reachedRank = reached[teamId] || 0;
        const rank = Math.min(zone.rank, reachedRank);
        const points = PUNTOS_ELIMINATORIAS[rank] || 0;
        totalPoints += points;
        teamDetails.push({ teamId, predictedRank: zone.rank, reachedRank, points });
      }
    }

    return { totalPoints, teamDetails };
  }

  global.groupTies = groupTies;
  global.resolveTie = resolveTie;
  global.computeEliminatorias = computeEliminatorias;
  global.computeReachedPhases = computeReachedPhases;
  global.calculateEliminatoriasPoints = calculateEliminatoriasPoints;
  global.getShootoutWinner = getShootoutWinner;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints, getShootoutWinner };
  }
})(typeof window !== 'undefined' ? window : globalThis);
