# Corrección de errores críticos — porra-spa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Definir `logout()`, corregir la navegación forzada, el badge falso de hoyPartidos, los desempates con datos reales, la decodificación JWT y escapar los usernames (XSS).

**Architecture:** SPA vanilla JS. `js/main.js` es un script monolítico (6137 líneas, sin módulos) + módulos IIFE (`hoyPartidos.js`, etc.). Tests con `node:test` en `tests/` sobre funciones puras exportadas.

**Tech Stack:** JavaScript ES6+ vanilla, node:test.

## Global Constraints

- NO añadir frameworks ni librerías.
- Mantener estilo del código existente (sin comentarios nuevos salvo JSDoc ya existente).
- **CACHE-BUSTING (regla AGENTS.md):** tras modificar cualquier JS, incrementar `?v=` de ese fichero en `index.html`.
- Verificación por tarea: `node --check js/<archivo>.js` + `node tests/*.test.js` (23 tests deben seguir verdes).
- NO hacer commit salvo petición explícita.
- Verificar nombres exactos de funciones con grep antes de editar (los números de línea pueden variar entre tareas).

---

### Task 1: Definir logout() [CRÍTICO]

**Files:**
- Modify: `js/main.js` — añadir función junto a `checkAuthStatus()` (~línea 1993); refactorizar handler del botón (~líneas 3647-3663)

**Contexto:** Seis llamadas a `logout()` (356, 2536, 2588, 2608, 3749, 4652) fallan con ReferenceError silenciado por try/catch → la sesión rota nunca se limpia.

- [ ] **Step 1: Añadir la función global antes de checkAuthStatus**

```js
function logout() {
  localStorage.removeItem('session_token');
  localStorage.removeItem('porra_ucl_user');
  AppState.currentUser = null;
  AppState.sessionToken = null;
  AppState.hasUnsavedChanges = false;
  AppState.hasUnsavedSquadChanges = false;
  AppState.hasUnsavedFinalChanges = false;
  clearInicioCountdown();
  stopMatchStatsPolling();
  checkAuthStatus();
}
```

(Las funciones `clearInicioCountdown` y `stopMatchStatsPolling` ya existen — las usa el handler actual. Las declaraciones function se hoistean.)

- [ ] **Step 2: Refactorizar el botón "Cerrar Sesión" para reutilizarla**

Sustituir el cuerpo del listener (3647-3663) por:

```js
  logoutBtn.addEventListener('click', () => {
    if (AppState.hasUnsavedChanges || AppState.hasUnsavedSquadChanges) {
      modal.remove();
      showLogoutWithUnsavedModal();
      return;
    }
    modal.remove();
    logout();
    showToast('Sesion cerrada correctamente');
  });
```

- [ ] **Step 3: Verificar**

Run: `node --check js/main.js && node tests/*.test.js`
Expected: OK, 23/23

---

### Task 2: forceNavigateToTab renderiza final-predictions y pred-standings [MEDIO]

**Files:**
- Modify: `js/main.js` — bloque final de `forceNavigateToTab()` (~3001-3006)

**Contexto:** Al salir del modal de cambios sin guardar hacia esas pestañas quedan vacías/obsoletas. `navigateToTab()` sí renderiza `final-predictions`; verificar con grep si también maneja `pred-standings` y qué función de render usa (`renderPredictedStandings` u otra) antes de escribir las ramas.

- [ ] **Step 1: Añadir ramas espejo de navigateToTab**

```js
  if (tabName === 'final-predictions') renderFinalPredictionsTab();
  if (tabName === 'pred-standings') showPredictedStandings();
```

Nota: usar la MISMA llamada que use `navigateToTab` para pred-standings; si ahí se llama a `renderPredictedStandings()` directamente, usar esa (evitar recursión con navigateToTab dentro de showPredictedStandings).

- [ ] **Step 2: Verificar**

Run: `node --check js/main.js`
Expected: OK

---

### Task 3: Badge "★ tu pronóstico" solo con pronóstico propio [BAJO]

**Files:**
- Modify: `js/hoyPartidos.js:127`

**Contexto:** `opts.myResult ?? (best ? best.result : null)` sustituye un `null` explícito (usuario SIN pronóstico) por `best.result`, marcando como "tuya" una fila que no lo es. `computeBestResult()` ya devuelve `null` cuando no hay pronóstico propio, así que el fallback es innecesario.

- [ ] **Step 1: Localizar el llamador de buildMatchCardHtml y confirmar que siempre pasa myResult (grep `buildMatchCardHtml({`). Si siempre lo pasa, eliminar el fallback:**

```js
        ${buildStatsHtml({
          counts,
          myResult,
          best, real, homeTeam: match.homeTeam, awayTeam: match.awayTeam,
          realResult: isReal ? getMatchResult(real.home, real.away) : null
        })}
```

(`myResult` ya está destructurado en la línea 92.)

- [ ] **Step 2: Ejecutar tests del módulo**

Run: `node --check js/hoyPartidos.js && node tests/*.test.js`
Expected: OK, 23/23

---

### Task 4: Desempates de calculatePredictedStandings solo con datos pronosticados [ALTO]

**Files:**
- Modify: `js/main.js` — `calculatePredictedStandings()` (~5467), compareTeams en ~5539-5540

**Contexto:** Usa `getRealRivalsStats()` (rivales desde matchStats REALES + stats mezcladas). En pretemporada → rivalIds vacío (desempates 6-8 muertos); con jornada en curso → mezcla incoherente real/pronosticado. Afecta al cuadro de Eliminatorias. La función hermana (compareTeams que termina ~5458) ya resuelve esto con rivales derivados de partidos pronosticados + statsCache.

- [ ] **Step 1: Sustituir las dos llamadas getRealRivalsStats por helper local basado en predicciones**

Dentro de `calculatePredictedStandings`, antes de `compareTeams`, añadir:

```js
  function getPredictedRivalsStats(teamId) {
    const rivalIds = new Set();
    for (const m of AppState.leagueMatches) {
      const p = predictions[m.id];
      if (!p || typeof p.home !== 'number' || typeof p.away !== 'number') continue;
      if (m.homeTeamId === teamId) rivalIds.add(m.awayTeamId);
      else if (m.awayTeamId === teamId) rivalIds.add(m.homeTeamId);
    }
    let rivalPointsSum = 0;
    let rivalGDSum = 0;
    let rivalGFSum = 0;
    for (const rivalId of rivalIds) {
      const s = statsCache.get(rivalId);
      if (s) {
        rivalPointsSum += s.points;
        rivalGDSum += s.gd;
        rivalGFSum += s.gf;
      }
    }
    return { rivalPointsSum, rivalGDSum, rivalGFSum };
  }
```

Y en compareTeams:

```js
    const aRivals = getPredictedRivalsStats(a.teamId);
    const bRivals = getPredictedRivalsStats(b.teamId);
```

(statsCache se rellena para los 36 equipos en el bucle previo, así que `.get(rivalId)` siempre existe.)

- [ ] **Step 2: Verificar**

Run: `node --check js/main.js && node tests/*.test.js`
Expected: OK

---

### Task 5: Decodificación JWT base64url-safe [BAJO]

**Files:**
- Modify: `js/main.js:2000`

**Contexto:** `atob(token.split('.')[1])` falla con JWT base64url (estándar de `jsonwebtoken` en Node). Hoy funciona porque el backend firma base64 estándar, pero es frágil.

- [ ] **Step 1: Sustituir la decodificación**

```js
      const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)));
```

- [ ] **Step 2: Verificar**

Run: `node --check js/main.js`
Expected: OK

---

### Task 6: Escapar usernames (XSS almacenado) [ALTO]

**Files:**
- Modify: `js/main.js` — sitios con interpolación de nombre en innerHTML/atributos: ~902, ~940, ~1016, ~1915, ~2159, ~2195

**Contexto:** El backend valida `[a-z0-9_]` en registro, pero perfiles antiguos/otros canales podrían contener caracteres peligrosos; defensa en profundidad obligatoria con JWT en localStorage. Los módulos nuevos ya usan `esc()`; main.js no.

- [ ] **Step 1: Comprobar si main.js ya tiene helper esc (grep `function esc`). Si no, añadir junto a las utilidades:**

```js
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
```

- [ ] **Step 2: Para los onclick inline con nombre (~902, ~940): eliminar el onclick string-interpolado y usar data-atributos + delegación**

Patrón de sustitución (en el template literal):

```html
<button class="..." data-username="${esc(p.name)}">...</button>
```

y tras asignar innerHTML:

```js
container.querySelectorAll('[data-username]').forEach(el => {
  el.addEventListener('click', () => showUserProfileModal(el.dataset.username));
});
```

(Adaptar al elemento real de cada sitio; NUNCA dejar `${p.name}` crudo dentro de un atributo onclick.)

- [ ] **Step 3: Para interpolaciones de texto (${username}, ${p.name}, ${user.name} en toasts/modales ~1016, ~1915, ~2159, ~2195): envolver con esc()**

```js
showToast(`Bienvenido de nuevo, ${esc(user.name)}!`);
```

- [ ] **Step 4: Verificar**

Run: `node --check js/main.js && node tests/*.test.js`
Expected: OK

---

### Task 7: Cache-busting [OBLIGATORIO]

**Files:**
- Modify: `index.html` — etiquetas `<script src="js/main.js?v=X">` y `<script src="js/hoyPartidos.js?v=X">`

- [ ] **Step 1: Incrementar ?v= de main.js y hoyPartidos.js (solo los ficheros modificados)**

- [ ] **Step 2: Verificar que index.html referencia los valores nuevos**

Run: `grep -n 'main.js?v=\|hoyPartidos.js?v=' index.html`

---

## Fuera de alcance (decisión deliberada)

| Ítem | Motivo |
|---|---|
| Modal muerto #phase-change-modal (handlers inexistentes) | display:none, nadie lo muestra; código muerto inofensivo. Limpieza cosmética opcional futura |
| Toast repetido en cada render de Eliminatorias | Molesto pero no bug funcional; requiere decisión de UX |
| Carrera benigna arranque (enterApp vs loadInitialData) | Mitigada por splash de 2,5s; riesgo de regresión > beneficio |

## Verificación final

- [ ] `node --check js/*.js server.mjs` sin errores
- [ ] `node tests/*.test.js` → 23/23
- [ ] Grep confirma cero apariciones de `logout()` sin definición: `grep -c "function logout" js/main.js` ≥ 1
- [ ] index.html con versiones incrementadas
