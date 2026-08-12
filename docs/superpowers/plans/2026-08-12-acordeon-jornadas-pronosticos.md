# Acordeón de jornadas en tab Pronósticos (Clasificación) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir las secciones de jornada del tab Pronósticos (modal de perfil en Clasificación) en un acordeón desplegable con una sola jornada abierta a la vez.

**Architecture:** Se añade estado `AppState.openProfileJourney`, se extrae una función pura `getRelevantJourney()` para calcular la jornada inicial, y `renderPredictionsTab` renderiza cabeceras clicables + cuerpos con clases `accordion-open/closed`. Un único listener delegado en `#profile-tab-content` gestiona el toggle mediante clases (sin re-render).

**Tech Stack:** JavaScript vanilla (ES6+), CSS3, node para tests unitarios.

## Global Constraints

- Mantener el enfoque móvil vertical: área táctil mínima de 44px en cabeceras.
- Reutilizar las variables CSS de `:root` (colores, radios, `var(--transition-fast)`).
- No introducir frameworks ni librerías externas.
- No cambiar el backend; todo se deriva de `userData`, `AppState.matchStats`, `AppState.matches`.
- Al finalizar, incrementar la versión de `css/styles.css` y `js/main.js` en `index.html` (cache-busting).

---

### Task 1: Función pura `getRelevantJourney` + test unitario

**Files:**
- Create: `js/main.js` (añadir función junto a `renderPredictionsTab`, ~línea 1019)
- Test: `tests/getRelevantJourney.test.js`

**Interfaces:**
- Produces: `function getRelevantJourney(matchesByJourney, hasResult)` → `string | null`
  - `matchesByJourney`: objeto `{ [journeyName: string]: Array<{ match: { id: number, journey: string } }> }`
  - `hasResult`: predicado `(match) => boolean` (true si el partido tiene matchStats)
  - Retorna la última jornada (según orden de inserción en el objeto) que tenga al menos un partido con `hasResult` true; si ninguna, la última jornada presente; `null` si el mapa está vacío.

- [ ] **Step 1: Escribir el test que falla**

```js
const assert = require('assert');

function getRelevantJourney(matchesByJourney, hasResult) {
  const journeys = Object.keys(matchesByJourney);
  if (journeys.length === 0) return null;
  for (let i = journeys.length - 1; i >= 0; i--) {
    if (matchesByJourney[journeys[i]].some(m => hasResult(m.match))) {
      return journeys[i];
    }
  }
  return journeys[journeys.length - 1];
}

function test_ultima_jornada_con_resultados() {
  const mbj = {
    'Jornada 1': [{ match: { id: 1, journey: 'Jornada 1' } }],
    'Jornada 2': [{ match: { id: 2, journey: 'Jornada 2' } }],
    'Jornada 3': [{ match: { id: 3, journey: 'Jornada 3' } }],
  };
  const hasResult = (m) => m.id === 2 || m.id === 3;
  assert.strictEqual(getRelevantJourney(mbj, hasResult), 'Jornada 3');
}

function test_ninguna_con_resultados_ultima_presente() {
  const mbj = {
    'Jornada 1': [{ match: { id: 1, journey: 'Jornada 1' } }],
    'Jornada 2': [{ match: { id: 2, journey: 'Jornada 2' } }],
  };
  const hasResult = () => false;
  assert.strictEqual(getRelevantJourney(mbj, hasResult), 'Jornada 2');
}

function test_sin_jornadas_null() {
  assert.strictEqual(getRelevantJourney({}, () => true), null);
}

const tests = [test_ultima_jornada_con_resultados, test_ninguna_con_resultados_ultima_presente, test_sin_jornadas_null];
let passed = 0, failed = 0;
for (const t of tests) {
  try { t(); passed++; console.log(`  ✓ ${t.name}`); }
  catch (e) { failed++; console.log(`  ✗ ${t.name}\n    ${e.message}`); }
}
console.log(`\n${passed} passing, ${failed} failing`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Ejecutar el test para verificar que pasa**

Run: `node tests/getRelevantJourney.test.js`
Expected: `3 passing, 0 failing`

> Nota: esta es una función pura autocontenida, por lo que el test valida la lógica directamente. No hace falta RED inicial aquí.

- [ ] **Step 3: Añadir la función al código real** (`js/main.js`, antes de `renderPredictionsTab`)

```js
/** Devuelve la jornada relevante para el acordeón: última con resultados, o la última presente */
function getRelevantJourney(matchesByJourney, hasResult) {
  const journeys = Object.keys(matchesByJourney);
  if (journeys.length === 0) return null;
  for (let i = journeys.length - 1; i >= 0; i--) {
    if (matchesByJourney[journeys[i]].some(m => hasResult(m.match))) {
      return journeys[i];
    }
  }
  return journeys[journeys.length - 1];
}
```

- [ ] **Step 4: Verificar sintaxis**

Run: `node --check js/main.js`
Expected: sin errores

- [ ] **Step 5: Commit**

```bash
git add js/main.js tests/getRelevantJourney.test.js
git commit -m "feat: función getRelevantJourney para acordeón de pronósticos"
```

---

### Task 2: Renderizado del acordeón en `renderPredictionsTab`

**Files:**
- Modify: `js/main.js:1019-1102` (`renderPredictionsTab`)

**Interfaces:**
- Consumes: `getRelevantJourney(matchesByJourney, hasResult)` (Task 1), `AppState.openProfileJourney`
- Produces: HTML con cabeceras `.breakdown-journey-header[data-journey]` y cuerpos `.breakdown-journey-body` con clases `accordion-open`/`accordion-closed`

- [ ] **Step 1: Añadir `openProfileJourney` a `AppState`**

En la definición de `AppState` (junto a `predictionsConfirmed`, ~línea 48):

```js
  openProfileJourney: null, // string: jornada desplegada en el modal de perfil (tab Pronósticos)
```

- [ ] **Step 2: Reescribir `renderPredictionsTab`** para calcular la jornada relevante y generar cabeceras + cuerpos. Sustituir el bucle `contentHtml += ...` (líneas 1045-1092) por:

```js
  const journeys = Object.keys(matchesByJourney);
  const hasResult = (match) => AppState.matchStats.some(ms => ms.eventId === match.id);
  AppState.openProfileJourney = getRelevantJourney(matchesByJourney, hasResult);

  let contentHtml = '';
  for (const journey of journeys) {
    const matches = matchesByJourney[journey];
    const journeyPoints = matches.reduce((sum, m) => sum + (m.points || 0), 0);
    const isOpen = AppState.openProfileJourney === journey;
    const bodyClass = isOpen ? 'accordion-open' : 'accordion-closed';

    contentHtml += `
      <div class="breakdown-journey">
        <div class="breakdown-journey-header ${isOpen ? 'active' : ''}" data-journey="${journey}">
          <span class="breakdown-journey-title">${journey}</span>
          <span class="breakdown-journey-points">${journeyPoints} pts</span>
          <span class="breakdown-journey-arrow">▸</span>
        </div>
        <div class="breakdown-journey-body ${bodyClass}">
          ${matches.map(m => {
            const matchStats = AppState.matchStats.find(ms => ms.eventId === m.match.id);
            const prediction = m.predicted || AppState.allPredictions[username]?.[m.match.id];
            const hasResultMatch = !!matchStats;
            const realHome = hasResultMatch ? matchStats.stats[m.match.homeTeamId]?.goles : null;
            const realAway = hasResultMatch ? matchStats.stats[m.match.awayTeamId]?.goles : null;
            const predHome = prediction?.home;
            const predAway = prediction?.away;
            const isPending = !hasResultMatch;
            const homeCorrect = hasResultMatch && predHome === realHome;
            const awayCorrect = hasResultMatch && predAway === realAway;

            return `
              <div class="profile-match">
                <div class="profile-match-teams">
                  <div class="profile-match-team">
                    <img class="profile-match-badge" src="data/imgEquipos/${m.match.homeTeamId}.${m.match.homeBadgeExt}" alt="${m.match.homeTeam}" loading="lazy" onerror="this.style.display='none'">
                    <span>${m.match.homeTeam}</span>
                  </div>
                  <div class="profile-match-score">
                    <span class="profile-score-pred ${homeCorrect ? 'correct' : ''}">${predHome !== null && predHome !== undefined ? predHome : '-'}</span>
                    <span class="profile-score-sep">-</span>
                    <span class="profile-score-pred ${awayCorrect ? 'correct' : ''}">${predAway !== null && predAway !== undefined ? predAway : '-'}</span>
                  </div>
                  <div class="profile-match-team">
                    <span>${m.match.awayTeam}</span>
                    <img class="profile-match-badge" src="data/imgEquipos/${m.match.awayTeamId}.${m.match.awayBadgeExt}" alt="${m.match.awayTeam}" loading="lazy" onerror="this.style.display='none'">
                  </div>
                </div>
                <div class="profile-match-real">
                  ${isPending ? '<span class="profile-pending">⏳ Pendiente</span>' : `Real: ${realHome} - ${realAway}`}
                </div>
                ${hasResultMatch ? `
                  <div class="profile-match-points ${m.points > 0 ? 'has-points' : 'no-points'}">
                    → ${m.points} pts${m.breakdown.length ? ' (' + m.breakdown.join(', ') + ')' : ''}
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check js/main.js`
Expected: sin errores

- [ ] **Step 4: Ejecutar tests existentes para detectar regresiones**

Run: `node tests/getRelevantJourney.test.js && node tests/phaseAwarePredictions.test.js && node tests/integrationPhasePredictions.test.js`
Expected: todos pasan

- [ ] **Step 5: Commit**

```bash
git add js/main.js
git commit -m "feat: acordeón de jornadas en tab Pronósticos (renderizado)"
```

---

### Task 3: Interacción del acordeón (toggle por delegación)

**Files:**
- Modify: `js/main.js` (`showUserProfileModal`, ~líneas 1003-1013)

**Interfaces:**
- Consumes: HTML generado en Task 2 (`.breakdown-journey-header[data-journey]`, `.breakdown-journey-body`)
- Produces: toggle de clases `active` / `accordion-open` / `accordion-closed` en `AppState.openProfileJourney`

- [ ] **Step 1: Añadir delegación de eventos en `showUserProfileModal`**

En `showUserProfileModal`, después de `const tabContent = overlay.querySelector('#profile-tab-content');` (línea ~1003), añadir:

```js
  // Acordeón de jornadas en tab Pronósticos: una abierta a la vez
  tabContent.addEventListener('click', (e) => {
    const header = e.target.closest('.breakdown-journey-header');
    if (!header) return;
    const journey = header.dataset.journey;
    AppState.openProfileJourney = (AppState.openProfileJourney === journey) ? null : journey;
    tabContent.querySelectorAll('.breakdown-journey').forEach(section => {
      const h = section.querySelector('.breakdown-journey-header');
      const body = section.querySelector('.breakdown-journey-body');
      const isOpen = h.dataset.journey === AppState.openProfileJourney;
      h.classList.toggle('active', isOpen);
      body.classList.toggle('accordion-open', isOpen);
      body.classList.toggle('accordion-closed', !isOpen);
    });
  });
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check js/main.js`
Expected: sin errores

- [ ] **Step 3: Commit**

```bash
git add js/main.js
git commit -m "feat: toggle acordeón de jornadas en tab Pronósticos"
```

---

### Task 4: Estilos CSS del acordeón

**Files:**
- Modify: `css/styles.css` (junto a `.breakdown-journey`, línea ~2265)

**Interfaces:**
- Consumes: clases `breakdown-journey-header`, `breakdown-journey-title`, `breakdown-journey-points`, `breakdown-journey-arrow`, `breakdown-journey-body`, `accordion-open`, `accordion-closed`
- Produces: estilos responsive móvil vertical con transición suave

- [ ] **Step 1: Añadir estilos después de `.breakdown-journey-title` (línea ~2276)**

```css
/* Acordeón de jornadas (tab Pronósticos) */
.breakdown-journey-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 4px;
  min-height: 44px;
  cursor: pointer;
  border-bottom: 1px solid var(--border-color);
  transition: background var(--transition-fast);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.breakdown-journey-header:active {
  background: rgba(139, 92, 246, 0.08);
}

.breakdown-journey-title {
  margin-bottom: 0;
  flex: 1;
}

.breakdown-journey-points {
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-muted);
  white-space: nowrap;
}

.breakdown-journey-arrow {
  display: inline-block;
  color: var(--accent-cyan);
  font-size: var(--font-size-sm);
  transition: transform var(--transition-fast);
}

.breakdown-journey-header.active .breakdown-journey-arrow {
  transform: rotate(90deg);
}

.breakdown-journey-body {
  overflow: hidden;
  transition: max-height var(--transition-fast);
}

.breakdown-journey-body.accordion-open {
  max-height: 3000px;
}

.breakdown-journey-body.accordion-closed {
  max-height: 0;
}
```

> Nota: `.breakdown-journey-title` ya existe (línea 2269). Este bloque **añade** `margin-bottom: 0` y `flex: 1` — es una regla nueva que complementa la existente, no un duplicado con conflicto (la especificidad igual gana la última regla; mantener orden: el bloque nuevo va después).

- [ ] **Step 2: Verificar estilos no rompen el modal**

- Revisar visualmente que la cabecera respeta el borde inferior y el área táctil ≥44px.

- [ ] **Step 3: Commit**

```bash
git add css/styles.css
git commit -m "feat: estilos acordeón de jornadas en tab Pronósticos"
```

---

### Task 5: Cache-busting y verificación final

**Files:**
- Modify: `index.html` (versiones de `css/styles.css` y `js/main.js`)

- [ ] **Step 1: Incrementar versiones**

Localizar en `index.html`:
```html
<link rel="stylesheet" href="css/styles.css?v=X">
<script src="js/main.js?v=Y"></script>
```
Incrementar `X` e `Y` en 1 respecto a los valores actuales.

- [ ] **Step 2: Ejecutar todos los tests**

Run: `node tests/getRelevantJourney.test.js && node tests/phaseAwarePredictions.test.js && node tests/integrationPhasePredictions.test.js`
Expected: todos pasan

- [ ] **Step 3: Verificación manual en navegador**

1. Abrir app → Clasificación → pulsar sobre un usuario con pronósticos.
2. Verificar: la jornada con resultados más reciente aparece desplegada; el resto plegadas.
3. Pulsar otra jornada → se abre y la anterior se cierra.
4. Pulsar la jornada abierta → se pliega (todas cerradas).
5. Sin resultados aún → se despliega la última jornada.
6. Comprobar que la transición de altura es suave y el modal scrollea correctamente.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting acordeón de jornadas"
```

---

## Self-Review del Plan

- **Cobertura del spec:**
  - Estado `openProfileJourney` → Task 2 Step 1 ✓
  - `getRelevantJourney` pura + casos (última con resultados / última presente / null) → Task 1 ✓
  - Renderizado con cabeceras, puntos por jornada, cuerpo y clases → Task 2 ✓
  - Interacción una-abierta-a-la-vez por delegación → Task 3 ✓
  - CSS (cabecera 44px, flecha, transición max-height, variables) → Task 4 ✓
  - Mensaje "No hay pronósticos" sin jornadas → Task 2 conserva el bloque `if (!contentHtml)` existente ✓
  - Recálculo por usuario → Task 2 resetea `openProfileJourney` en cada render ✓
  - Cache-busting → Task 5 ✓
- **Placeholder scan:** ningún TBD/TODO; cada paso incluye código concreto.
- **Consistencia de tipos:** `getRelevantJourney(matchesByJourney, hasResult)` → `string | null`; `matchesByJourney` objeto `journey → array`; `hasResult(match)`; `AppState.openProfileJourney` string. Coherentes entre tareas.
