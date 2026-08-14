# Diseño: Tab de Clasificación del perfil — orden por pronosticada + alineación móvil

**Fecha:** 2026-08-14
**Proyecto:** porra-spa

## Contexto

En el menú Clasificación, al pinchar en un usuario y entrar en la pestaña **Clasificación** del modal de perfil (`renderClassificationTab`, js/main.js:1319) se muestra la clasificación **pronosticada vs real** de los 36 equipos.

Estado actual:
- Columnas: `#` (muestra posición **real**) | `Equipo` | `Pron.` | `Real` | `Pts`.
- Ordenada por **real** (`sort((a, b) => a.realPos - b.realPos)`).
- Dividida en dos secciones: "Equipos que puntúan (1º-24º)" y "Equipos sin puntos (25º-36º)", ambas por posición real.
- En móvil, `.col-team` es un flex sin `min-width: 0` ni control de wrap del nombre → los nombres largos empujan las columnas numéricas y las desalinean respecto a la cabecera.

## Objetivos

1. La tabla se ordena por **posición pronosticada** (no real).
2. La primera columna pasa a llamarse **Pron** y muestra la posición pronosticada; se **elimina** la columna que duplicaba ese valor.
3. **Tabla única** de los 36 equipos ordenada por pronosticada (se eliminan las dos secciones). Los equipos con posición real > 24 (no puntúan) se muestran atenuados en el lugar que les toque por su pronóstico.
4. El nombre del equipo se muestra en **2 líneas** y, si no cabe, se **corta** con `…` sin empujar las columnas (fix de alineación móvil).
5. La **cabecera de la tabla queda fija** (`position: sticky`) al hacer scroll en el modal, para saber siempre qué representa cada campo.

## Decisiones acordadas

- **Primera columna = "Pron"** (posición pronosticada). Se elimina la tercera columna (la antigua `Pron.`).
- **Tabla única de 36 equipos** ordenada por `predictedPos` ascendente (1→36).
- Equipos con `realPos > 24`: fila atenuada (`.muted` existente) en su posición pronosticada.
- Equipos sin pronóstico disponible: `predictedPos` ya tiene fallback a 36 en `calculateClassificationPoints`, así que caen al final.
- Se mantienen: el total de puntos arriba (`Puntos totales clasificación`), la leyenda "Solo puntúan equipos en posición 1-24 | Mínimo entre posición pronosticada y real", el escudo, el resaltado de puntos positivos (`.col-pts.positive`).
- **Cabecera sticky**: `.classification-header` con `position: sticky; top: 0; z-index: 2;` y fondo sólido `var(--ucl-card)` (igual al fondo del modal) para que las filas no se transparenten por debajo al hacer scroll. El contenedor de scroll es `.breakdown-modal-content` (`overflow-y: auto`). El total y la leyenda hacen scroll normal; solo la cabecera de la tabla permanece visible.
- El cálculo de puntos (`calculateClassificationPoints`) **no cambia**.

## Cambios propuestos

### 1. JavaScript — `renderClassificationTab` (js/main.js:1319-1415)

Reemplazar el cuerpo por:

- Eliminar el split `scoringTeams` / `nonScoringTeams` y las dos secciones.
- Ordenar `classData.teamDetails` por `predictedPos` ascendente.
- Cabecera de 4 columnas:
  ```
  <span class="col-pos">Pron</span>
  <span class="col-team">Equipo</span>
  <span class="col-real">Real</span>
  <span class="col-pts">Pts</span>
  ```
- Fila (una sola tabla):
  ```
  <div class="classification-row ${muted}">
    <span class="col-pos">${team.predictedPos}</span>
    <span class="col-team">
      <img src="data/imgEquipos/${team.teamId}.${team.badgeExt}" class="classification-badge" alt="${team.name}" loading="lazy" onerror="this.style.display='none'">
      <span class="col-team-name">${team.name}</span>
    </span>
    <span class="col-real">${team.realPos}</span>
    <span class="col-pts ${ptsClass}">${team.points}</span>
  </div>
  ```
  - `muted = team.realPos > 24 ? 'muted' : ''`.
  - `ptsClass = team.points > 0 ? 'positive' : ''`.
  - Se elimina la variable `predDisplay` (ya no hace falta el fallback `'-'`).

### 2. CSS (css/styles.css)

- Cambiar el grid de `.classification-header` y `.classification-row` de `32px 1fr 50px 50px 50px` a `32px 1fr 50px 50px` (se elimina una columna de 50px).
- En `.classification-row .col-team` añadir `min-width: 0;`.
- Añadir la clase del nombre del equipo con clamp a 2 líneas:
  ```css
  .classification-row .col-team-name {
    min-width: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    line-height: 1.15;
  }
  ```
- Centrar las celdas de cabecera numéricas para que coincidan con las filas (`.col-pos`, `.col-real`, `.col-pts` centradas; `.col-team` a la izquierda):
  ```css
  .classification-header .col-pos,
  .classification-header .col-real,
  .classification-header .col-pts {
    text-align: center;
  }
  .classification-header .col-team {
    text-align: left;
  }
  ```
  (La cabecera actual no centra las celdas numéricas mientras que las filas sí, lo que también contribuye al desalineo.)
- Cabecera sticky en el scroll del modal (`.breakdown-modal-content`):
  ```css
  .classification-header {
    position: sticky;
    top: 0;
    z-index: 2;
    background: var(--ucl-card);
  }
  ```
  (Si la regla base `.classification-header` ya tiene `display: grid`, etc., solo se añaden las propiedades sticky.)

### 3. Cache-busting (norma de AGENTS.md)

- `index.html`: `css/styles.css?v=54` → `?v=55`.
- `index.html`: `js/main.js?v=75` → `?v=76`.

### 4. Tests

No existe test actual para `renderClassificationTab`. Como la función construye HTML directamente con estado global, se extrae el **constructor de la fila/ordenación** a funciones puras testables (patrón espejo de `tests/`):

- `sortTeamsByPredicted(teamDetails)` → ordena por `predictedPos` ascendente.
- `buildClassificationRowHtml(team)` → devuelve la fila de 4 columnas con clases `classification-row`, `col-team-name`, `muted` (si `realPos > 24`) y `positive` (si `points > 0`).

Nuevo fichero `tests/classificationProfileTable.test.js`:

- `sortTeamsByPredicted` ordena correctamente y mantiene equipos sin pronóstico al final (predictedPos 36).
- `buildClassificationRowHtml` incluye `col-team-name`, el nombre, el `predictedPos` en la primera columna y `muted` cuando `realPos > 24`.
- `buildClassificationRowHtml` incluye `positive` solo cuando `points > 0`.

Ejecución: `node tests/classificationProfileTable.test.js`.

## Validación manual

1. Abrir `index.html` con vista móvil vertical (o `python3 -m http.server 8000`).
2. Clasificación → pinchar un usuario → pestaña **Clasificación**.
3. La tabla muestra 36 equipos en una sola tabla ordenados por **Pron** ascendente.
4. Primera columna = "Pron" (posición pronosticada); columna "Real" muestra la posición real; no hay columna duplicada.
5. Equipos con posición real 25-36 atenuados.
6. En móvil, los nombres largos se parten en 2 líneas y se cortan con `…` sin desalinear las columnas respecto a la cabecera.
7. Puntos positivos resaltados en verde; total y leyenda intactos.
8. Al hacer scroll en el modal, la cabecera (`Pron | Equipo | Real | Pts`) permanece visible pegada arriba; las filas pasan por debajo.

## Fuera de alcance

- Cambiar el cálculo de puntos (`calculateClassificationPoints`, `calculateRealStandings`, `calculateUserPredictedStandings`).
- Cambiar otras pestañas del modal de perfil ni `showUserProfileModal`.
- Cambiar la tabla principal de Clasificación de usuarios (`renderClasificacionTab`).
- Cambiar la pantalla de "Clasificación pronosticada" propia (`showPredictedStandings`).
