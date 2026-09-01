# Avisos en Tab Clasificación del Perfil

## Contexto

El tab "Clasificación" dentro del modal de perfil de usuario muestra una tabla de 36 equipos con columnas: Pron (posición pronosticada), Equipo, Real (posición real), Pts (puntos). Actualmente, si no hay `matchStats`, muestra un mensaje genérico sin tabla. Se necesita mostrar la tabla con 0 puntos y un aviso antes de que empiece la jornada 1, y un aviso diferente cuando ya haya empezado.

## Diseño

### Dos estados del tab

#### Estado 1: Antes de jornada 1 (ningún partido de liga con resultado)

- **Tabla visible** con los 36 equipos ordenados por posición pronosticada
- Columna **Real**: muestra `-` (sin datos reales aún)
- Columna **Pts**: muestra `0` para todos los equipos
- **Aviso** debajo del legend: *"Los puntos de clasificación empezarán a contarse cuando empiece la jornada 1"* (color `var(--accent-gold)`)
- `totalPoints` mostrado: `0`

#### Estado 2: Jornada 1 en adelante (al menos 1 partido de liga con resultado)

- **Tabla completa** con cálculo real (comportamiento actual)
- **Aviso** debajo del legend: *"Los puntos por clasificación varían según la clasificación real después de cada partido"* (color `var(--text-muted)`)
- `totalPoints` calculado normalmente

### Detección del estado

```javascript
const leagueMatches = AppState.matches.filter(m => m.fase === 'liga');
const hasLeagueResult = leagueMatches.some(m =>
  AppState.matchStats.some(ms =>
    ms.eventId === m.id &&
    ms.stats?.[m.homeTeamId] !== undefined &&
    ms.stats?.[m.awayTeamId] !== undefined
  )
);
```

### Cambios en `calculateClassificationPoints` (línea 5659)

Cuando no hay `realStandings` pero sí `predictedStandings`, devolver `teamDetails` con las posiciones pronosticadas y `points: 0` (en lugar de array vacío). Esto permite que `renderClassificationTab` muestre la tabla con posiciones pronosticadas aunque no haya resultados reales.

```javascript
// Nueva lógica: si no hay realStandings pero sí predictedStandings,
// devolver teamDetails con predictedPos y points=0
const realStandings = calculateRealStandings();
if (!realStandings.length) {
  const predictedStandings = calculateUserPredictedStandings(username);
  if (!predictedStandings.length) {
    return { totalPoints: 0, teamDetails: [] };
  }
  // Devolver tabla con posiciones pronosticadas y 0 puntos
  const teamDetails = predictedStandings.map(t => ({
    teamId: t.teamId,
    name: t.name,
    badgeExt: t.badgeExt,
    predictedPos: t.position,
    realPos: '-',
    points: 0
  }));
  return { totalPoints: 0, teamDetails };
}
```

### Cambios en `renderClassificationTab` (línea 1399)

Reemplazar el early return de "no matchStats" por lógica de2 estados:

```javascript
function renderClassificationTab(container, username) {
  const classData = calculateClassificationPoints(username);

  if (!classData.teamDetails.length) {
    container.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No hay datos de clasificación disponibles.</div>';
    return;
  }

  // Detectar si algún partido de liga tiene resultado
  const leagueMatches = AppState.matches.filter(m => m.fase === 'liga');
  const hasLeagueResult = leagueMatches.some(m =>
    AppState.matchStats.some(ms =>
      ms.eventId === m.id &&
      ms.stats?.[m.homeTeamId] !== undefined &&
      ms.stats?.[m.awayTeamId] !== undefined
    )
  );

  const sortedTeams = sortTeamsByPredicted(classData.teamDetails);

  // Aviso según estado
  const noticeHtml = hasLeagueResult
    ? '<div class="classification-notice" style="...">Los puntos por clasificación varían según la clasificación real después de cada partido</div>'
    : '<div class="classification-notice notice-pre-jornada" style="...">Los puntos de clasificación empezarán a contarse cuando empiece la jornada 1</div>';

  // Renderizar tabla + aviso
  ...
}
```

### Cambios en `buildClassificationRowHtml` (línea 1382)

Adaptar para manejar `realPos` como string `'-'` (cuando no hay datos reales):

```javascript
function buildClassificationRowHtml(team) {
  const isPreJornada = team.realPos === '-';
  const muted = isPreJornada ? '' : (team.realPos > 24 ? ' muted' : '');
  const ptsClass = team.points > 0 ? ' positive' : '';
  return `
    <div class="classification-row${muted}">
      <span class="col-pos">${team.predictedPos}</span>
      <span class="col-team">...</span>
      <span class="col-real">${team.realPos}</span>
      <span class="col-pts${ptsClass}">${team.points}</span>
    </div>
  `;
}
```

### Estilos CSS

Añadir en `css/styles.css`:

```css
.classification-notice {
  padding: 8px 16px;
  font-size: 11px;
  text-align: center;
  border-bottom: 1px solid var(--border-color);
  color: var(--text-muted);
}
.classification-notice.notice-pre-jornada {
  color: var(--accent-gold);
}
```

## Archivos a modificar

| Archivo | Línea | Cambio |
|---------|-------|--------|
| `js/main.js` | ~1399 | `renderClassificationTab`: lógica de 2 estados + avisos |
| `js/main.js` | ~5659 | `calculateClassificationPoints`: devolver teamDetails con predictedPos aunque no haya realStandings |
| `js/main.js` | ~1382 | `buildClassificationRowHtml`: manejar `realPos === '-'` |
| `css/styles.css` | nuevo | Estilos `.classification-notice` y `.notice-pre-jornada` |

## Verificación

1. Abrir modal de perfil de un usuario → tab Clasificación
2. Sin matchStats: debe mostrar tabla con 36 equipos, Real=`-`, Pts=0, aviso dorado
3. Con matchStats de al menos 1 partido de liga: debe mostrar tabla con puntos calculados, aviso gris
4. Verificar que `totalPoints` es 0 en estado pre-jornada
