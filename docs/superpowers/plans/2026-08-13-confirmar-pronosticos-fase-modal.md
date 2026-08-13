# Confirmar pronósticos solo en FASE_PRETEMPORADA + modal de aviso + estilos botones — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restringir el botón Confirmar a FASE_PRETEMPORADA, añadir un modal de aviso antes de confirmar, uniformar/compactar los botones de la cabecera de Pronósticos y proteger el endpoint de confirmación en el backend.

**Architecture:** La SPA es vanilla JS en `js/main.js` (lógica por fases) + CSS en `css/styles.css`. Los tests son ficheros autónomos que espejan las funciones de `main.js` (no lo importan, usa globals de navegador). El backend es `api-porra/server.js` (Node nativo + MongoDB). Cambios: 3 helpers nuevos en main.js, un modal reutilizando el patrón `.unsaved-modal-*`, estilos unificados de botones, guarda de fase en el endpoint de confirmación.

**Tech Stack:** JavaScript vanilla (ES6+), CSS vanilla, Node.js (CommonJS), MongoDB/Mongoose.

## Global Constraints

- No usar frameworks. Seguir el patrón de la fila `.pronosticos-actions-row`.
- El botón Confirmar solo se renderiza en `FASE_PRETEMPORADA` y solo cuando `!AppState.predictionsConfirmed`.
- Confirmar queda deshabilitado si: fase congelada, `predicted < total` o `AppState.hasUnsavedChanges`.
- Los botones de la fila deben tener la misma altura (alto 36px, padding 8px 12px, font 13px, radius 8px) y no desbordar en móvil (fila con `flex-wrap: wrap`).
- Modal reutiliza las clases existentes `.unsaved-modal-overlay`, `.unsaved-modal`, `.unsaved-modal-icon`, `.unsaved-modal-title`, `.unsaved-modal-text`, `.unsaved-modal-actions`, `.unsaved-modal-btn`, `.unsaved-modal-btn-save`, `.unsaved-modal-btn-cancel`.
- Los tests NO importan `main.js`; espejan sus funciones (patrón existente en `tests/`).
- Cache-busting obligatorio al tocar `css/styles.css` y `js/main.js`: incrementar `?v=` en `index.html` (hoy CSS `v=47`, JS `v=65`).

---

### Task 1: Añadir tests espejo de la lógica del botón Confirmar

**Files:**
- Modify: `tests/integrationPhasePredictions.test.js`

**Interfaces:**
- Consumes: `AppState` mock (ya existe en el fichero), `getMatchesForCurrentPhase()`, `countPredictedInPhase(matches)`, `isPhaseFrozen(fase)`, `getFaseJuego()`.
- Produces: helpers espejo `isFasePretemporada()`, `shouldShowConfirmButton()`, `shouldConfirmButtonBeDisabled()` y 6 funciones de test que se registran en el array `tests`.

- [ ] **Step 1: Añadir los helpers espejo** justo después de `shouldSaveButtonBeDisabled()` (tras la línea 92)

```js
function isFasePretemporada() {
  return getFaseJuego() === 'FASE_PRETEMPORADA';
}

function shouldShowConfirmButton() {
  const { fase } = getMatchesForCurrentPhase();
  const confirmedForFase = AppState.predictionsConfirmed && fase === 'liga';
  return isFasePretemporada() && !confirmedForFase;
}

function shouldConfirmButtonBeDisabled() {
  const { matches: phaseMatches, fase } = getMatchesForCurrentPhase();
  const total = phaseMatches.length;
  const predicted = countPredictedInPhase(phaseMatches);
  return isPhaseFrozen(fase) || predicted < total || AppState.hasUnsavedChanges;
}
```

- [ ] **Step 2: Añadir las funciones de test** antes de la sección `// Run all tests` (línea 429)

```js
// ══════════════════════════════════════════════════════════════
// Confirm button: visibility y disabled
// ══════════════════════════════════════════════════════════════

function test_confirm_button_visible_in_pretemporada() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  assert.strictEqual(shouldShowConfirmButton(), true, 'Confirm button should show in PRETEMPORADA');
}

function test_confirm_button_hidden_when_confirmed() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  AppState.predictionsConfirmed = true;
  assert.strictEqual(shouldShowConfirmButton(), false, 'Confirm button should hide after confirming');
}

function test_confirm_button_hidden_in_other_phases() {
  const fases = ['FASE_LIGA', 'FASE_PRE16', 'FASE_16', 'FASE_PRE8', 'FASE_8', 'FASE_PRE4', 'FASE_4', 'FASE_PRESEMIS', 'FASE_SEMIS', 'FASE_PREFINAL', 'FASE_FINAL', 'FASE_POSTFINAL'];
  for (const fase of fases) {
    resetState();
    AppState.appConfig.faseJuego = fase;
    assert.strictEqual(shouldShowConfirmButton(), false, `Confirm button should not show in ${fase}`);
  }
}

function test_confirm_button_disabled_when_incomplete() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  assert.strictEqual(shouldConfirmButtonBeDisabled(), true, 'Confirm disabled when predictions incomplete');
}

function test_confirm_button_disabled_with_unsaved_changes() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  const { matches } = getMatchesForCurrentPhase();
  for (const m of matches) {
    AppState.scorePredictions[m.id] = { home: 2, away: 1 };
  }
  AppState.hasUnsavedChanges = true;
  assert.strictEqual(shouldConfirmButtonBeDisabled(), true, 'Confirm disabled when there are unsaved changes');
}

function test_confirm_button_enabled_when_complete_and_saved() {
  resetState();
  AppState.appConfig.faseJuego = 'FASE_PRETEMPORADA';
  const { matches } = getMatchesForCurrentPhase();
  for (const m of matches) {
    AppState.scorePredictions[m.id] = { home: 2, away: 1 };
  }
  AppState.hasUnsavedChanges = false;
  assert.strictEqual(shouldConfirmButtonBeDisabled(), false, 'Confirm enabled when complete and saved');
}
```

- [ ] **Step 3: Registrar los tests** en el array `tests` (línea 433), dentro del bloque Step 1 (FASE_PRETEMPORADA)

```js
  // Step 1: FASE_PRETEMPORADA
  test_pretemporada_shows_144_liga_matches,
  test_pretemporada_can_edit_predictions,
  test_pretemporada_save_button_enabled_with_changes,
  test_confirm_button_visible_in_pretemporada,
  test_confirm_button_disabled_when_incomplete,
  test_confirm_button_disabled_with_unsaved_changes,
  test_confirm_button_enabled_when_complete_and_saved,
```

Y al final del array, tras `test_all_matches_have_fase_field`, añadir:

```js
  // Confirm button
  test_confirm_button_hidden_when_confirmed,
  test_confirm_button_hidden_in_other_phases,
```

- [ ] **Step 4: Ejecutar el test**

Run: `node tests/integrationPhasePredictions.test.js`
Expected: 34 passing, 0 failing (28 actuales + 6 nuevos; los helpers espejo definidos en el propio fichero pasan por construcción y fijan el contrato).

- [ ] **Step 5: Commit**

```bash
git add tests/integrationPhasePredictions.test.js
git commit -m "test: contrato del botón confirmar (solo pretemporada, requiere completo y guardado)"
```

---

### Task 2: Implementar lógica del botón Confirmar + modal en main.js

**Files:**
- Modify: `js/main.js` (template `renderPronosticosTab` ~3428-3431; click handler ~3454-3457; `updateConfirmButton` ~3709; nuevo helper + modal junto a `confirmPredictions` ~3721)

**Interfaces:**
- Consumes: `AppState.predictionsConfirmed`, `AppState.hasUnsavedChanges`, `getMatchesForCurrentPhase()`, `countPredictedInPhase()`, `isPhaseFrozen()`, `isFasePretemporada()`.
- Produces:
  - `shouldShowConfirmButton(): boolean`
  - `shouldConfirmButtonBeDisabled(): boolean`
  - `showConfirmPredictionsModal(): void` — renderiza el modal; el botón aceptar llama a `confirmPredictions()`, cancelar/overlay cierran el modal.

- [ ] **Step 1: Añadir los helpers `shouldShowConfirmButton` y `shouldConfirmButtonBeDisabled`** justo antes de `updateConfirmButton` (línea 3708)

```js
/** El botón Confirmar solo se muestra en FASE_PRETEMPORADA mientras no se haya confirmado */
function shouldShowConfirmButton() {
  const { fase } = getMatchesForCurrentPhase();
  const confirmedForFase = AppState.predictionsConfirmed && fase === 'liga';
  return isFasePretemporada() && !confirmedForFase;
}

/** Confirmar queda deshabilitado si la fase está congelada, falta algún pronóstico o hay cambios sin guardar */
function shouldConfirmButtonBeDisabled() {
  const { matches: phaseMatches, fase } = getMatchesForCurrentPhase();
  const total = phaseMatches.length;
  const predicted = countPredictedInPhase(phaseMatches);
  return isPhaseFrozen(fase) || predicted < total || AppState.hasUnsavedChanges;
}
```

- [ ] **Step 2: Actualizar `updateConfirmButton`** (línea 3709) para delegar en el helper

```js
/** Actualiza el estado del botón Confirmar según los pronósticos completos de la fase */
function updateConfirmButton() {
  const btn = document.getElementById('btn-confirm-predictions');
  if (!btn) return;
  btn.disabled = shouldConfirmButtonBeDisabled();
  btn.style.pointerEvents = '';
  btn.style.opacity = '';
}
```

- [ ] **Step 3: Actualizar el template de `renderPronosticosTab`** (líneas 3428-3431)

Reemplazar la línea 3429 (el botón Confirmar) por:

```js
        ${shouldShowConfirmButton() ? `<button class="confirm-predictions-btn" id="btn-confirm-predictions" ${shouldConfirmButtonBeDisabled() ? 'disabled' : ''}>✅ Confirmar</button>` : ''}
```

(El resto de la fila — Guardar, Clasificación, Eliminatorias — queda igual.)

- [ ] **Step 4: Cambiar el click handler del botón Confirmar** (líneas 3454-3457) para abrir el modal

```js
  const confirmBtn = document.getElementById('btn-confirm-predictions');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => showConfirmPredictionsModal());
  }
```

- [ ] **Step 5: Añadir la función `showConfirmPredictionsModal`** justo antes de `async function confirmPredictions()` (línea 3721)

```js
/** Modal de aviso antes de confirmar los pronósticos de liga */
function showConfirmPredictionsModal() {
  const existing = document.querySelector('.unsaved-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'unsaved-modal-overlay';
  overlay.innerHTML = `
    <div class="unsaved-modal">
      <div class="unsaved-modal-icon">⚠️</div>
      <h3 class="unsaved-modal-title">Confirmar pronósticos</h3>
      <p class="unsaved-modal-text">Al confirmar los pronósticos de los partidos <strong>ya no podrás volver a cambiarlos</strong>. Al confirmar desbloquearás el acceso a la pantalla de <strong>Eliminatorias</strong>.</p>
      <div class="unsaved-modal-actions">
        <button class="unsaved-modal-btn unsaved-modal-btn-save" id="modal-confirm-accept">✅ Confirmar pronósticos</button>
        <button class="unsaved-modal-btn unsaved-modal-btn-cancel" id="modal-confirm-cancel">Cancelar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#modal-confirm-accept').addEventListener('click', () => {
    overlay.remove();
    confirmPredictions();
  });

  overlay.querySelector('#modal-confirm-cancel').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}
```

- [ ] **Step 6: Verificar** que `confirmPredictions()` (línea 3721) no cambia: sus guards (sin token, ya confirmado, incompleto) siguen como red de seguridad. `AppState.predictionsConfirmed = true` al éxito y `renderPronosticosTab()` re-renderiza (ocultará Confirmar y mostrará Eliminatorias).

- [ ] **Step 7: Ejecutar los tests**

Run: `node tests/integrationPhasePredictions.test.js`
Expected: 34 passing, 0 failing.

- [ ] **Step 8: Commit**

```bash
git add js/main.js
git commit -m "feat: botón confirmar solo en pretemporada y modal de aviso previo"
```

---

### Task 3: Estilos de botones unificados + fila con wrap (css/styles.css)

**Files:**
- Modify: `css/styles.css` (`.pronosticos-actions-row` ~3265, `.pronosticos-actions-row .save-predictions-btn` ~3270, `.standings-btn` ~3277, `.confirm-predictions-btn` ~2067)

**Interfaces:**
- Consumes: las clases HTML de la fila de `renderPronosticosTab` (`save-predictions-btn`, `confirm-predictions-btn`, `standings-btn`).
- Produces: fila con `flex-wrap: wrap`, botones de altura uniforme (36px, padding 8px 12px, font 13px, radius 8px).

- [ ] **Step 1: Reemplazar el bloque `.pronosticos-actions-row`** (líneas 3265-3275) por:

```css
/* Botones de cabecera en pronósticos */
.pronosticos-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.pronosticos-actions-row .save-predictions-btn {
  flex: 1 1 auto;
  min-width: 0;
  padding: 8px 12px;
  font-size: 13px;
  margin-bottom: 0;
}
```

- [ ] **Step 2: Reemplazar `.confirm-predictions-btn`** (líneas 2067-2078) por:

```css
.confirm-predictions-btn {
  flex: 1 1 auto;
  min-width: 0;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  height: 36px;
  box-sizing: border-box;
  cursor: pointer;
  background: linear-gradient(135deg, #10B981, #059669);
  color: white;
  transition: all 0.2s;
  white-space: nowrap;
}
```

(Dejar intactos `.confirm-predictions-btn:disabled` y `.confirm-predictions-btn:not(:disabled):active`.)

- [ ] **Step 3: Reemplazar `.standings-btn`** (líneas 3277-3293) por:

```css
.standings-btn {
  flex: 1 1 auto;
  min-width: 0;
  background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #3B82F6 100%);
  border: none;
  color: #fff;
  border-radius: 8px;
  padding: 8px 12px;
  font-family: var(--font-family);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.2;
  height: 36px;
  box-sizing: border-box;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  margin-bottom: 0;
}
```

(Dejar intacto `.standings-btn:active`.)

- [ ] **Step 4: Verificación manual en navegador** (`npm start` en porra-spa o `node server.mjs`, abrir localhost:8080): en la pestaña Pronósticos comprobar que los botones tienen la misma altura, que en una ventana estrecha (~360px) "Eliminatorias" baja de línea sin desbordar, y que el modal de confirmación se ve correctamente al pulsar Confirmar.

- [ ] **Step 5: Commit**

```bash
git add css/styles.css
git commit -m "style: botones de cabecera compactos y de altura uniforme con wrap"
```

---

### Task 4: Proteger la confirmación en el backend (api-porra)

**Files:**
- Modify: `/home/ldoc/Proyectos/api-porra/server.js` (endpoint `POST /api/predictions/confirm` ~875-877)

**Interfaces:**
- Consumes: `getFaseJuego()` (ya definido en server.js:286), `checkPhaseConsistency()`.
- Produces: 409 con `error: 'La confirmación solo está disponible en FASE_PRETEMPORADA'` si la fase actual no es `FASE_PRETEMPORADA`.

- [ ] **Step 1: Insertar la guarda** tras `const phaseCheck = await checkPhaseConsistency(req, res); if (!phaseCheck) return;` (líneas 876-877)

```js
    const currentPhase = await getFaseJuego();
    if (currentPhase !== 'FASE_PRETEMPORADA') {
      sendJson(req, res, 409, { ok: false, error: 'La confirmación solo está disponible en FASE_PRETEMPORADA' });
      return;
    }
```

- [ ] **Step 2: Verificar sintaxis**

Run: `node --check server.js` (desde `/home/ldoc/Proyectos/api-porra`)
Expected: sin errores de sintaxis.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: bloquear confirmación de pronósticos fuera de FASE_PRETEMPORADA"
```

---

### Task 5: Cache-busting y verificación final

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Incrementar versiones** en `index.html`

```html
<link rel="stylesheet" href="css/styles.css?v=48">
...
<script src="js/main.js?v=66"></script>
```

- [ ] **Step 2: Ejecutar toda la batería de tests de porra-spa**

Run (desde `/home/ldoc/Proyectos/porra-spa`):
```bash
node tests/integrationPhasePredictions.test.js
node tests/phaseAwarePredictions.test.js
node tests/buildPhaseOptionsHtml.test.js
node tests/eliminatorias.test.js
node tests/fasesDesc.test.js
node tests/getFaseDesc.test.js
node tests/getMatchesForCurrentPhase.test.js
node tests/getRelevantJourney.test.js
node tests/journeyLabel.test.js
node tests/journeySort.test.js
node tests/unwrapAllPredictions.test.js
```
Expected: todos pasan (0 failing).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: cache-busting css v48 y main.js v66"
```
