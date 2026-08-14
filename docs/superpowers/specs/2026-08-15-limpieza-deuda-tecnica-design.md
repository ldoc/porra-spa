# Spec: Limpieza de deuda técnica (código muerto y legacy)

**Fecha**: 2026-08-15
**Alcance**: api-porra (backend) y porra-spa (frontend)
**Decisión de contexto**: el único consumidor de la API es porra-spa. No hay scripts externos, dashboards ni otros clientes que dependan de los campos/endpoints legacy.

## Motivación

Durante la auditoría de los AGENTS.md se detectó deuda técnica acumulada de la época de persistencia en GitHub y de iteraciones anteriores:

1. `/api/players` devuelve `points`/`hits` que **siempre son 0**: `getAllPlayers()` consulta campos que no existen en el schema de `User`. En el frontend solo los consume `renderLeaderboard()`, que es **código muerto** (no se invoca y `leaderboard-container` no existe en el HTML). Los puntos reales se calculan en el cliente con `calculateUserTotalPoints()` + `calculateClassificationPoints()`.
2. `data/codes.json` y `AppState.validCodes` se cargan pero **no se usan**: la validación de códigos de invitación la hace el backend contra MongoDB (`POST /api/auth/register`).
3. Endpoint legacy `GET /usuario?clave=X` documentado como "candidato a eliminación"; sin consumidores.
4. `data/imgJugadores/` tiene **86 fotos sin jugador asociado** en `jugadores.json`.
5. El fallback de escudos apunta a `data/imgEquipos/default.png`, fichero que **no existe** (fallback roto).

## Cambios

### api-porra (backend)

**1. `api/auth.js` — `getAllPlayers()`**
- `User.find({}, 'username avatar points hits')` → `User.find({}, 'username avatar')`
- `map` devuelve solo `{ name, avatar }`

**2. `server.js` — endpoint `/api/players`**
- Eliminar la rama de fase (pretemporada vs no). Ahora siempre responde `{ ok, players: [{ name, avatar }] }`.
- Mantener `checkPhaseConsistency` y cache-control.

**3. `server.js` — endpoint legacy `GET /usuario`**
- Eliminar el bloque completo.

**4. `AGENTS.md`**
- Tabla "Legacy": queda solo `GET /`.
- "Notas Importantes": quitar la mención a `/usuario`.
- "Respuesta Players": reflejar que solo devuelve `name`/`avatar` (sin `points`/`hits` y sin rama de fase).
- Eliminar la nota que decía que `points`/`hits` no se almacenan (ya no aplica: se eliminan).

### porra-spa (frontend)

**5. `data/codes.json`** — eliminar fichero.

**6. `js/main.js` — `loadInitialData()`**
- Quitar `fetch('data/codes.json')` de `Promise.all`.
- Quitar la asignación de `AppState.validCodes` y el fallback con `[{ code: 'UCL2026' }, ...]`.
- Quitar `validCodes: []` de la declaración de `AppState`.

**7. `js/main.js` — `fetchPlayers()`**
- Quitar las líneas que asignan `AppState.currentUser.points/hits` (guardar `porra_ucl_user`).

**8. `js/main.js` — `renderLeaderboard()`**
- Eliminar la función completa (código muerto).

**9. Fallback de escudos**
- Crear `data/imgEquipos/default.webp` (placeholder que muestre claramente que falta un recurso: fondo oscuro, símbolo "?" y texto).
- Reemplazar las 5 referencias `data/imgEquipos/default.png` → `data/imgEquipos/default.webp` en `main.js`.

**10. Fotos huérfanas**
- Borrar los 86 ficheros de `data/imgJugadores/` cuyo id no está en `jugadores.json`.

**11. `AGENTS.md`**
- Estructura de directorios: quitar `codes.json`.
- Tabla de modelos de datos (5.2): quitar fila de `codes.json` y nota LEGACY; actualizar `imgJugadores/` a 1 134 ficheros.
- Tabla `AppState`: quitar fila `validCodes`.
- Añadir `default.webp` a la estructura (en `imgEquipos/`).

**12. `data/README.md`**
- Resumen: quitar `codes.json`; actualizar `imgJugadores/` a 1 134.
- Añadir mención de `default.webp` en la sección de imágenes.

## Tests

- Revisar tests existentes de porra-spa (`clasificacionTable`, `unwrapAllPredictions`, etc.) para asegurar que no dependen de `codes.json`, `validCodes`, `points`/`hits` ni `renderLeaderboard`. Ajustar si alguno falla.
- api-porra: no hay tests de endpoints; `node --check` en `server.js` y `api/auth.js`.

## Verificación

- `node --check` en los ficheros JS modificados (ambos repos).
- Ejecutar los tests de porra-spa (script existente).
- Confirmar que la SPA sigue cargando sin errores de consola (no se requiere servidor; revisión estática del flujo `loadInitialData`).

## No incluido (fuera de alcance)

- Refactor de `server.js` (1.150 líneas) ni de `main.js` (5.870 líneas) en módulos. Se trata en otra iteración.
- Crear tests de endpoints del backend.
- Notificaciones de resultados nuevos, caché cliente o mejoras de UX.
