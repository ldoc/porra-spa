# Spec: Bola de estado por equipo en Eliminatorias (perfil)

**Fecha:** 2026-08-14
**Pantalla:** Modal de perfil → tab "Eliminatorias" (`renderEliminatoriasTab` en `js/main.js`)
**Proyecto:** porra-spa

## Objetivo

Mostrar el estado real de cada equipo en el cuadro de eliminatorias pronosticado por el usuario, mediante un punto de color en la esquina superior derecha de cada ficha de equipo (`.drop-slot.filled`), junto con una leyenda que explique los colores.

## Estados

| Estado | Color | Significado |
|--------|-------|-------------|
| `vivo` | verde (`#10B981`, `--accent-primary`) | El equipo sigue en juego en las eliminatorias |
| `eliminado` | rojo (`#ef4444`) | El equipo ha caído en alguna eliminatoria |
| `noClasificado` | gris (`#64748B`, `--text-muted`) | El equipo acabó fuera del top 24 real (no entró en eliminatorias) |

## Lógica de estado (nueva función pura)

Nueva función en `js/eliminatorias.js`: `getTeamEliminatoriasStatus(teamId, elimResult, realStandings)`.

- `elimResult`: salida de `computeEliminatorias(matches, matchStats)` → `{ zonas, final, rondasResueltas }`.
- `realStandings`: salida de `calculateRealStandings()` → array `{ teamId, position, ... }`.

Reglas en orden:
1. Si `teamId` está en cualquier lista de `elimResult.zonas` (`'16'`, `'8'`, `'4'`, `'semis'`) → `'eliminado'`.
2. Si `teamId === elimResult.final.subcampeon` → `'eliminado'`. (El campeón se considera `vivo`.)
3. Si en `realStandings` tiene `position > 24` → `'noClasificado'`.
4. En cualquier otro caso → `'vivo'`.

## Cambios en UI (`js/main.js` → `renderEliminatoriasTab`)

1. Asegurar datos reales: si `AppState.matchStats` está vacío, `await fetchMatchStats()`.
2. Calcular:
   - `elimResult = computeEliminatorias(AppState.matches, AppState.matchStats)`
   - `realStandings = calculateRealStandings()`
3. Añadir **leyenda** al inicio del contenido del tab:
   - Contenedor `.elim-status-legend` con tres ítems `.legend-item` (punto + etiqueta): "En juego", "Eliminado", "No clasificado".
4. En cada ficha llena (`.drop-slot filled`), añadir `<span class="elim-status-dot {estado}"></span>` (esquina superior derecha).

## Cambios en CSS (`css/styles.css`)

Respetando el diseño existente (tokens de color, `--radius`, borde con `--ucl-card` para que la bola se despegue del fondo):

- `.elim-status-dot`: `position: absolute`, `top/right: 4px`, `width/height: 10px`, `border-radius: 50%`, `border: 1.5px solid var(--ucl-card)`, `box-shadow` sutil.
  - Variantes `.vivo`, `.eliminado`, `.noClasificado` con los colores de la tabla.
- `.elim-status-legend` y `.legend-item`: fila/flex con gap, tipografía de etiquetas de la app (11px, `--text-muted`, `font-weight: 600`).

Nota: `.drop-slot` ya tiene `position: relative`, así que el punto absoluto se ancla a la ficha.

## Alcance (fuera)

- NO se modifica la pantalla "Resultados → Eliminatorias" (vista de eliminados reales).
- NO se modifica el editor de predicciones de fase final.
- Solo el tab Eliminatorias del modal de perfil.

## Tests

En `tests/eliminatorias.test.js` (mismo patrón de runner):

- `vivo`: equipo no eliminado y en top 24 → `'vivo'`.
- `eliminado` en zona (`'16'`, `'8'`, `'4'`, `'semis'`).
- `eliminado` como subcampeón; campeón → `'vivo'`.
- `noClasificado`: `position > 24`.
- `vivo` cuando no hay `elimResult` ni `realStandings` (datos vacíos).

## Verificación

- `node tests/eliminatorias.test.js` pasa (y el resto de tests no se rompe).
- Inspección visual del tab Eliminatorias del perfil: leyenda visible, puntos en cada ficha con los tres estados correctos.
