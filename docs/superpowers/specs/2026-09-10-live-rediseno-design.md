# Rediseño tab Live — spec de diseño

Fecha: 2026-09-10. Rama: `live-matchs` (porra-spa). Validado con mockups visuales.

## Objetivo

Convertir la sub-tab Live (dentro de Resultados) en un centro de seguimiento en directo
con 3 secciones: marcadores compactos, clasificación temporal y ranking de futbolistas.

## Enfoque técnico (A — todo en cliente)

Sin cambios de backend. Se reutiliza, solo sobre los partidos live actuales:

- `calculateMatchPoints(pred, liveComoMatchStats, match)` → puntos de pronóstico.
- `calculatePlayerMatchPoints(playerData, squadPlayer, matchStat)` → puntos fantasy.
- `computeRankingForStats(subset)` si encaja; si no, agregación local equivalente.
- Datos: `livematchs` vía polling existente (60 s dot/updated, 120 s matches, SWR
  `porra_cache_live_v1`), pronósticos de `allPredictions`, plantillas de `squadsCache`.
- Recalcular en cada render live (2-9 partidos: coste despreciable).

## Sección 1 — Marcadores compactos

- Rejilla de **3 mini-tarjetas por fila** (wrap a más filas si hay más partidos).
- Cada mini: línea superior con minuto live (`● 67'`, o `Fin`) a la izquierda y
  **mis puntos de pronóstico** a la derecha (`+8` verde, resto neutro);
  debajo abreviatura de 3 letras (primeras 3 del nombre en mayúsculas) + resultado
  (`STU 3-1 VIK`).
- Sustituye a las tarjetas completas actuales en la parte superior. La tarjeta completa
  con goleadores desaparece (su info vive en la sección 3).
- Sin partidos live: mensaje vacío actual, secciones 2-3 ocultas.

## Sección 2 — Clasificación temporal única

- Una sola tabla para todos los jugadores de la porra, solo partidos live actuales
  (incluye finalizados recientes aún no borrados, ventana 30 min).
- Columnas: `# | Jugador | Pron. | Plant. | Total` (Total dorado), ordenada por Total
  desc; desempates: Pron. desc, luego Plant. desc.
- `Pron.` = suma de `calculateMatchPoints` con reglas oficiales (8/3/3/1).
- `Plant.` = suma de `calculatePlayerMatchPoints` con baremo fantasy oficial.
- Fila propia resaltada en verde (clase `me`, como en Clasificación).

## Sección 3 — Ranking de futbolistas (nivel esencial + ⭐)

- Una sola tabla con todos los futbolistas de plantillas de usuarios que aparecen en
  `stats.jugadores` de los partidos live con **minutos > 0**, ordenados por puntos
  fantasy live desc (desempates: goles, asistencias, nota).
- Columnas: `# | Futbolista | ⭐ | G | A | Pts`.
- `⭐` = nota Sofascore live (`jugadores[].puntos`); si aún no hay, `–`.
- Celda de futbolista: foto (fallback inicial/emoji si falta), nombre, partido
  (`VFB-VIK`) y chips de dueños: **Tú primero en verde** (si lo tienes), hasta 3
  dueños más y `(+N)` con el resto.
- Sin minutos ni desglose expandible (nivel esencial decidido; posible ampliación futura).

## Estilos

- Reutilizar tokens `:root` y clases existentes (`.standings-table`, `.rank-1/2/3`,
  `.live-dot`, `.live-owner(.me)`); añadir solo `.mini`, `.mrow`-like grid y
  `.rate`. Sin cambios de layout global; respeta portrait 460 px.
- `?v=` bump en `index.html` para `css/styles.css`, `js/main.js`, `js/liveTab.js`.

## Tests

- `tests/liveTemporal.test.js`: tabla temporal con fixture de 2 partidos (incluye caso
  Viking/Stuttgart: id visitante < id local no voltea nada al agregar).
- `tests/livePlayers.test.js`: orden del ranking, chips de dueños (Tú primero + (+N)),
  `⭐` ausente → `–`, filtro minutos > 0.
- Suites existentes en verde (38/38).
