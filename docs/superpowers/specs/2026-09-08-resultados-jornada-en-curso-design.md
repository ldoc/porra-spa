# Resultados: jornada en curso por defecto + scroll al último resultado

Fecha: 2026-09-08

## Contexto

En la pestaña Resultados → tab Jornadas, `renderResultadosTab()` selecciona como jornada por defecto la **última ronda disponible** (`availableRoundList[availableRoundList.length - 1]`, `js/main.js:1819`), que para la fase de liga es siempre la Jornada 8, aunque todavía no se haya jugado. El usuario ve una jornada futura vacía en lugar de la jornada que se está disputando.

## Objetivo

1. Al entrar en la pestaña Resultados, mostrar por defecto la **jornada en curso**.
2. Dentro de la jornada, auto-scroll al **último partido disputado con resultado**.

## Definiciones

- **Jornada en curso**: jornada (fase:ronda) cuya ventana de fechas de partido contiene la fecha de hoy. Si hoy no cae dentro de ninguna ventana, se usa la **última jornada con al menos un resultado** (según `matchStats`). Si tampoco hay resultados, se usa la última ronda disponible (comportamiento actual).

## Diseño

### 1. Nuevo módulo `js/resultadosRound.js`

Patrón IIFE como `js/hoyPartidos.js`: expone `resultadosRoundApi` en `window` y `module.exports` para tests.

Funciones puras:

- `getCurrentRoundKey(roundList, matches, matchStats, nowMs)` → `string`
  - `roundList`: array de `{ key, fase, ronda, label }` ordenado (el `availableRoundList` actual).
  - Para cada ronda, calcula su ventana `[minFechaTs, maxFechaTs]` a partir de `matches` con `fase` y `ronda` coincidentes.
  - Devuelve la clave de la primera ronda cuya ventana contiene `nowMs` (inclusive).
  - Si ninguna contiene `nowMs`, devuelve la clave de la última ronda de la lista que tenga ≥1 partido con resultado en `matchStats`.
  - Si ninguna tiene resultado, devuelve la clave de la última ronda de la lista.
  - `roundList` vacío → `null`.

- `sortRoundMatches(allRoundMatches)` → `array`
  - Ordena una copia: partidos **disputados primero, de más antiguo a más reciente** por `fechaTs`, y después los **pendientes por fecha** (más antiguo primero).
  - Recibe ítems `{ match, hasResult }` y ordena por `match.fechaTs`.

### 2. Cambios en `js/main.js`

#### `renderResultadosTab()`

- Declarar `resultadosRoundKey` en `AppState` (junto a `resultadosRound`, ~línea 38).
- Sustituir el default (línea 1819):
  ```js
  const wasAutoSelected = !AppState.resultadosRoundKey;
  const currentKey = AppState.resultadosRoundKey || resultadosRoundApi.getCurrentRoundKey(
    availableRoundList, AppState.matches, AppState.matchStats, Date.now()
  );
  ```
- Sustituir el sort inline (líneas 1838-1843) por `resultadosRoundApi.sortRoundMatches(allRoundMatches)`.
- Las tarjetas de partido ya distinguen disputados/pendientes: `<div class="resultados-match ${!hasResult ? 'no-result' : ''}">` (main.js:2187). No se modifica `renderMatchResult`.
- Tras el render, si `wasAutoSelected` y la ronda seleccionada tiene algún partido con resultado, hacer scroll del contenedor `.resultados-scroll` para centrar el **último** partido disputado (último `.resultados-match:not(.no-result)`). Cálculo robusto con rects relativos al contenedor (no depende de `offsetParent`):
  ```js
  const scroll = container.querySelector('.resultados-scroll');
  const played = [...container.querySelectorAll('.resultados-match:not(.no-result)')];
  const last = played[played.length - 1];
  if (scroll && last) {
    const sRect = scroll.getBoundingClientRect();
    const lRect = last.getBoundingClientRect();
    scroll.scrollTop += (lRect.top - sRect.top) - (sRect.height / 2) + (lRect.height / 2);
  }
  ```

#### `navigateToTab()`

- Al salir de la pestaña resultados (bloque actual de línea 3165-3168), resetear también `AppState.resultadosRoundKey = null`, de modo que cada visita vuelva a la jornada en curso y re-aplique el auto-scroll.

### 3. `index.html`

- Añadir `<script src="js/resultadosRound.js?v=1"></script>` antes de `js/main.js`.
- Bump de versión de `js/main.js` (regla cache-busting de `AGENTS.md`).

### 4. Tests

Nuevo fichero `tests/resultadosRound.test.js` (patrón de los tests existentes: node script con asserts):

- `test_jornada_en_curso_por_fecha`: hoy dentro de la ventana de la Jornada 1 → devuelve `liga:1`.
- `test_fallback_ultima_con_resultados`: hoy fuera de todas las ventanas → última ronda con resultado.
- `test_fallback_ultima_disponible`: sin resultados en ninguna ronda → última ronda de la lista.
- `test_roundList_vacio_null`.
- `test_sort_disputados_antiguo_a_reciente_luego_pendientes`: disputados ordenados ascendente, después pendientes ascendente.

## Fuera de alcance

- No se toca `api-porra`.
- No se cambia la navegación ◀/▶ ni el resto de tabs de Resultados.
- No se cambia el orden de partidos en otras pantallas (solo la vista de Jornadas).