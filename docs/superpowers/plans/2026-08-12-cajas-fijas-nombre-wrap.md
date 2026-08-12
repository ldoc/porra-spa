# Cajas fijas con nombre en varias líneas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fijar el tamaño de las cajas de la vista read-only Eliminatorias (Resultados) y permitir que los nombres de equipo hagan wrap en varias líneas dentro de la caja, cortando con `…` como último recurso.

**Architecture:** Cambio puramente CSS en `css/styles.css`, dentro del bloque del rediseño de eliminatorias (scope `.eliminatorias-view`), que garantiza que no afecta a la pantalla interactiva de predicciones. No hay cambios de lógica JS ni de tests.

**Tech Stack:** CSS3 vanilla (variables `:root`, Flexbox/Grid).

## Global Constraints

- **Solo** afecta a la vista read-only de Resultados (`.eliminatorias-view`). La pantalla interactiva tap-to-place de Predicciones NO cambia (conserva `nowrap` + ellipsis de una línea).
- Reutilizar variables CSS de `:root`; no añadir valores estáticos nuevos.
- Sin cambios en lógica de negocio ni en tests. La suite existente (7 ficheros de test) debe seguir pasando.
- Cache-busting obligatorio (AGENTS.md): `css/styles.css?v=43` → `v=44` en `index.html`.
- Orientación vertical móvil-first; contenedor máx 480px.

---

### Task 1: CSS — cajas fijas con nombre wrap

**Files:**
- Modify: `css/styles.css` (añadir al final, dentro del bloque del rediseño de eliminatorias, tras las reglas de `.eliminatorias-final-row`)
- Modify: `index.html` (línea 19, cache-busting)

**Interfaces:**
- Consumes: clases existentes `.eliminatorias-view`, `.drop-slot`, `.drop-slot-name` (`css/styles.css:3888-3932`). El bloque del rediseño está al final del fichero (`.eliminatorias-final-row` termina en la última línea).
- Produces: reglas CSS nuevas con scope `.eliminatorias-view`. No expone interfaces JS.

- [ ] **Step 1: Añadir las reglas CSS**

Añadir al final de `css/styles.css` (tras el bloque `.eliminatorias-final-row`):

```css
/* Cajas fijas con nombre en varias líneas (vista read-only) */
.eliminatorias-view .drop-slot {
  min-width: 0;
}

.eliminatorias-view .drop-slot-name {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
```

Nota: `min-width: 0` en la caja permite que encoga hasta el ancho de su columna de grid (`repeat(4, 1fr)` de la regla anterior) en lugar de ser empujada por el contenido. `overflow: hidden` garantiza que la caja nunca crece por el nombre.

- [ ] **Step 2: Verificación estática del CSS**

Run: `node -e "const c=require('fs').readFileSync('css/styles.css','utf8'); if(!c.includes('.eliminatorias-view .drop-slot-name')) throw new Error('regla nombre no presente'); if(!c.includes('-webkit-line-clamp: 3')) throw new Error('clamp no presente'); console.log('CSS OK')"`
Expected: `CSS OK` sin excepción.

- [ ] **Step 3: Bump de cache-busting**

En `index.html`, línea 19: `css/styles.css?v=43` → `css/styles.css?v=44`. NO tocar `js/main.js` (sin cambios en este plan).

- [ ] **Step 4: Verificar el bump**

Run: `grep -n "styles.css?v\|main.js?v" index.html`
Expected: `css/styles.css?v=44` y `js/main.js?v=60`.

- [ ] **Step 5: Tests existentes siguen pasando**

Run: `for f in tests/*.test.js; do node "$f" >/dev/null 2>&1 || echo "FAIL $f"; done`
Expected: sin salida (ningún `FAIL`).

- [ ] **Step 6: Commit**

```bash
git add css/styles.css index.html
git commit -m "style: cajas fijas con nombre wrap (3 líneas) en vista eliminatorias de resultados"
```

---

### Task 2: Verificación manual en navegador

**Files:** ninguno (verificación interactiva).

**Interfaces:**
- Consumes: la app con `renderResultadosTab()` y `renderEliminatoriasView()` funcionando tras Task 1.

- [ ] **Step 1: Servir la app localmente**

Run: `python3 -m http.server 8000` en la raíz del repo y abrir `http://localhost:8000` en el navegador (o usar el servidor local habitual del proyecto).

- [ ] **Step 2: Inyectar datos de ejemplo en la consola**

Con la app abierta y sesión iniciada, ejecutar en la consola del navegador (incluye equipos con nombres largos):

```js
AppState.resultadosTab = 'eliminatorias';
AppState.finalPredictions = {
  champion: 10, runnerUp: 44,
  semiFinalists: [30, 61],
  quarterFinalists: [98, 32, 65, 67],
  roundOf16: [100, 4, 45, 77, 40, 42, 69, 80],
  roundOf32: [9, 12, 17, 21, 25, 28, 33, 38]
};
renderResultadosTab();
```

(Si los IDs de equipos no existen en `AppState.teamsMap`, la imagen cae a `default.png` por el `onerror`; usar equipos reales del JSON si se quiere probar con nombres largos reales.)

- [ ] **Step 3: Comprobar el layout resultante**

Verificar visualmente:
- Todas las cajas de la vista Eliminatorias tienen **el mismo tamaño** (cuadradas, ~100px), aunque haya nombres largos.
- Los nombres largos hacen **wrap a 2-3 líneas dentro de la caja**; si un nombre excepcional no cabe, termina en `…`.
- La pantalla de Predicciones de Eliminatorias (tap-to-place) **mantiene** su comportamiento actual (nombre a una línea con ellipsis).

Si algo difiere del spec, reportarlo y ajustar en Task 1 antes de continuar.

- [ ] **Step 4: Anotar resultado en el ledger de la sesión**

Registrar si la verificación manual se completó o queda para el usuario (puede requerir sesión real en el navegador).

---

## Notas de implementación

- No hay lógica de negocio nueva → no hay tests nuevos. La suite existente es la red de seguridad.
- `-webkit-line-clamp` está soportado en todos los navegadores modernos (Safari, Chrome, Edge, Firefox ≥ 68).
- La pantalla interactiva no se ve afectada: sus `.drop-slot-name` siguen usando la regla base `css/styles.css:3920-3932` (nowrap + ellipsis de 1 línea).
