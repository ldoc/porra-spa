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
   * Solo se asignan rangos con resultado real: un cruce resuelto marca al
   * eliminado en esa fase y al ganador avanza una ronda. Los cruces
   * pendientes NO asignan rango (provisional) para no otorgar puntos antes
   * de que existan resultados.
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
        if (!resuelto) continue; // cruce pendiente → no hay rango real aún
        // Eliminado en esta ronda → rango definitivo de esta fase
        reached[eliminado] = rankByFase[fase];
        // El ganador avanza a la siguiente fase (rango +1) de forma provisional
        const ganador = eliminado === tie.teamA ? tie.teamB : tie.teamA;
        if (!reached[ganador] || reached[ganador] <= rankByFase[fase]) {
          reached[ganador] = rankByFase[fase] + 1;
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
        }
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

  const FASES_ELIMINATORIAS = ['16', '8', '4', 'semis'];

  /**
   * Devuelve el estado real de un equipo en las eliminatorias:
   * 'vivo' (sigue en juego), 'eliminado' (cayó en una eliminatoria) o
   * 'noClasificado' (acabó fuera del top 24 real).
   * @param {number} teamId - ID del equipo
   * @param {Object} elimResult - Salida de computeEliminatorias ({ zonas, final })
   * @param {Array<{teamId:number, position:number}>} realStandings - Clasificación real
   * @returns {'vivo'|'eliminado'|'noClasificado'}
   */
  function getTeamEliminatoriasStatus(teamId, elimResult, realStandings) {
    if (elimResult) {
      for (const fase of FASES_ELIMINATORIAS) {
        if ((elimResult.zonas?.[fase] || []).includes(teamId)) return 'eliminado';
      }
      if (elimResult.final?.subcampeon === teamId) return 'eliminado';
    }
    const entry = (realStandings || []).find(t => t.teamId === teamId);
    if (entry && entry.position > 24) return 'noClasificado';
    return 'vivo';
  }

  const POSITION_GROUPS = {
    A: [9, 10, 23, 24],
    B: [11, 12, 21, 22],
    C: [13, 14, 19, 20],
    D: [15, 16, 17, 18]
  };
  const MAX_TEAMS_PER_GROUP = 2;

  /**
   * Devuelve las violaciones de colocación en el cuadro de eliminatorias.
   * Grupos de posiciones A-D: máximo 2 por grupo en dieciseisavos y máximo 2
   * por grupo en el CONJUNTO de cajas fuera de dieciseisavos (campeón,
   * subcampeón, semifinalistas, cuartos y octavos combinadas).
   * @param {Object} finalPredictions - { champion, runnerUp, semiFinalists, quarterFinalists, roundOf16, roundOf32 }
   * @param {Map<number,number>} teamPositionMap - teamId -> posición pronosticada (1-24)
   * @returns {Array<string>} Mensajes de violación (vacío = válido)
   */
  function getFinalPredictionsViolations(finalPredictions, teamPositionMap) {
    const fp = finalPredictions || {};
    const violations = [];

    const countGroupIn = (teamIds, positions) => (teamIds || [])
      .filter(id => {
        const pos = teamPositionMap.get(id);
        return pos && positions.includes(pos);
      })
      .length;

    const restTeams = [
      ...(fp.champion ? [fp.champion] : []),
      ...(fp.runnerUp ? [fp.runnerUp] : []),
      ...(fp.semiFinalists || []),
      ...(fp.quarterFinalists || []),
      ...(fp.roundOf16 || [])
    ];

    for (const positions of Object.values(POSITION_GROUPS)) {
      if (countGroupIn(fp.roundOf32, positions) > MAX_TEAMS_PER_GROUP) {
        violations.push(`Máximo ${MAX_TEAMS_PER_GROUP} equipos de posiciones ${positions.join(',')} en dieciseisavos.`);
      }
      if (countGroupIn(restTeams, positions) > MAX_TEAMS_PER_GROUP) {
        violations.push(`Máximo ${MAX_TEAMS_PER_GROUP} equipos de posiciones ${positions.join(',')} en el conjunto de cajas fuera de dieciseisavos.`);
      }
    }

    return violations;
  }

  /** Selectores de los contenedores con scroll de la pestaña de fase final */
  const FINAL_SCROLL_SELECTORS = ['.final-predictions-fixed', '.final-predictions-scroll', '#teams-pool-scroll'];

  /**
   * Guarda el scrollTop de los contenedores con scroll de la pestaña de fase final.
   * Devuelve { selector: scrollTop } solo para los contenedores presentes en el DOM.
   * @param {Document} [doc] - Documento inyectable para tests (default: document).
   */
  function saveFinalScrollPositions(doc) {
    const d = doc || globalThis.document;
    const positions = {};
    for (const sel of FINAL_SCROLL_SELECTORS) {
      const el = d.querySelector(sel);
      if (el) positions[sel] = el.scrollTop;
    }
    return positions;
  }

  /**
   * Restaura el scrollTop guardado en los contenedores con scroll de la pestaña
   * de fase final. Anula temporalmente el `scroll-behavior: smooth` (inline) para
   * que la restauración sea instantánea y no se perciba el salto "sube y baja".
   * @param {Object<string,number>} positions - Mapa selector -> scrollTop (de saveFinalScrollPositions).
   * @param {Document} [doc] - Documento inyectable para tests (default: document).
   */
  function restoreFinalScrollPositions(positions, doc) {
    const d = doc || globalThis.document;
    for (const sel of Object.keys(positions || {})) {
      const el = d.querySelector(sel);
      if (!el) continue;
      const prevBehavior = el.style.scrollBehavior;
      el.style.scrollBehavior = 'auto';
      el.scrollTop = positions[sel];
      el.style.scrollBehavior = prevBehavior;
    }
  }

  global.groupTies = groupTies;
  global.resolveTie = resolveTie;
  global.computeEliminatorias = computeEliminatorias;
  global.computeReachedPhases = computeReachedPhases;
  global.calculateEliminatoriasPoints = calculateEliminatoriasPoints;
  global.getShootoutWinner = getShootoutWinner;
  global.getFinalPredictionsViolations = getFinalPredictionsViolations;
  global.getTeamEliminatoriasStatus = getTeamEliminatoriasStatus;
  global.saveFinalScrollPositions = saveFinalScrollPositions;
  global.restoreFinalScrollPositions = restoreFinalScrollPositions;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { groupTies, resolveTie, computeEliminatorias, computeReachedPhases, calculateEliminatoriasPoints, getShootoutWinner, getFinalPredictionsViolations, getTeamEliminatoriasStatus, saveFinalScrollPositions, restoreFinalScrollPositions };
  }
})(typeof window !== 'undefined' ? window : globalThis);
