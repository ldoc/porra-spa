# Diseño: Validación de grupos de posiciones en Eliminatorias

## Contexto

Los usuarios predicen el cuadro de eliminatorias asignando los 24 equipos clasificados de la fase de liga a las rondas campeón, subcampeón, semifinalistas, cuartos, octavos y dieciseisavos. Para limitar la concentración de equipos de ciertos rangos de posición, se definen 4 grupos de restricción:

| Grupo | Posiciones |
|-------|------------|
| A | 9, 10, 23, 24 |
| B | 11, 12, 21, 22 |
| C | 13, 14, 19, 20 |
| D | 15, 16, 17, 18 |

El AGENTS.md de ambos repos (porra-spa y api-porra) describe las restricciones como "2 equipos por grupo por caja", con el máximo de 2 aplicado a la caja de dieciseisavos y al resto de cajas por separado.

**Problema**: las implementaciones actuales validan el "máximo 2 por grupo" **por caja individual** en las cajas fuera de dieciseisavos:

- `porra-spa/js/main.js` (`addTeamToZone`, líneas 5514-5571): cuenta solo los equipos del grupo en la caja destino.
- `api-porra/server.js` (PUT `/api/final-predictions`, líneas 864-897): recorre cada caja por separado y comprueba el máximo en cada una.

Con esa lectura, un usuario podría colocar el 23º en cuartos, el 24º en semifinales y el 10º en octavos (un equipo de grupo A por caja, ninguno llega a 2 en una misma caja) y la validación lo aceptaría, cuando la regla real lo prohíbe.

**Regla real (confirmada)**: el máximo de 2 equipos por grupo se aplica **al conjunto de las cajas fuera de dieciseisavos** (campeón + subcampeón + semifinalistas + cuartos + octavos combinadas). Es decir:

- En **dieciseisavos** (`roundOf32`): máximo 2 equipos de cada grupo A-D.
- En **el conjunto del resto de cajas** (`champion` + `runnerUp` + `semiFinalists` + `quarterFinalists` + `roundOf16`): máximo 2 equipos de cada grupo A-D.

Con el cuadro completo, cada grupo queda repartido 2 en dieciseisavos y 2 fuera de él. Los equipos de posiciones 1-8 (fuera de los grupos A-D) no pueden ir a dieciseisavos (regla Top-8, ya implementada) y completan las cajas restantes.

## Cambio propuesto

Extraer la validación de grupos a una **función pura y testeable** en cada proyecto, con la misma semántica, y usarla tanto en el frontend (feedback en el tap) como en el backend (rechazo autoritativo al guardar).

### Semántica del validador

```
getFinalPredictionsGroupViolations(finalPredictions, teamPositionMap)
  → Array<string>   (vacío = válido)
```

`teamPositionMap` es `Map<teamId, posicion>` con posiciones 1-24 (misma fuente que hoy: `calculateUserStandings` en API, `calculatePredictedStandings` en SPA). Se conserva el guard actual `standings.length >= 24` (si no hay 24 posiciones, no se valida).

Comprobaciones por cada grupo A-D:

1. **Dieciseisavos**: contar equipos de `finalPredictions.roundOf32` cuya posición pertenezca al grupo. Si `> 2`, violación.
2. **Resto combinado**: contar equipos en `champion` + `runnerUp` + `semiFinalists` + `quarterFinalists` + `roundOf16` cuya posición pertenezca al grupo. Si `> 2`, violación.

Manejo de valores nulos/vacíos: `champion`/`runnerUp` pueden ser `null` (se omiten), los arrays pueden ser `null`/`undefined` (se tratan como `[]`).

### Cambios en porra-spa

1. `js/eliminatorias.js`: añadir `getFinalPredictionsGroupViolations` exportada por `global` y `module.exports` (patrón existente del módulo, cargado ya en `index.html` antes de `main.js`). No hace falta script nuevo.
2. `js/main.js` (`addTeamToZone`, líneas 5514-5571): sustituir la lógica de grupos en línea por una llamada al validador sobre una **copia provisional** de `finalPredictions` con el equipo candidato ya colocado (mismo tratamiento de `index` para reemplazo o append que el código actual). Si el validador devuelve violaciones → `showToast` con el primer mensaje y no se aplica el cambio. El check Top-8 de dieciseisavos se mantiene intacto.
3. `index.html`: cache-busting (norma AGENTS.md) — `js/main.js?v=72` → `v=73` y `js/eliminatorias.js?v=2` → `v=3`.

### Cambios en api-porra

1. Nuevo módulo `api/finalPredictions.js` con `POSITION_GROUPS`, `MAX_TEAMS_PER_GROUP_PER_ZONE` y `getFinalPredictionsGroupViolations` (misma semántica que el SPA).
2. `server.js`: en PUT `/api/final-predictions` (líneas 864-897), sustituir el bucle por caja por la llamada al validador; si hay violaciones → `400` con el primer mensaje. Mover `POSITION_GROUPS` y `MAX_TEAMS_PER_GROUP_PER_ZONE` (líneas 28-34) al módulo e importarlos.

### AGENTS.md (ambos repos)

Reescribir la restricción de grupos para que diga explícitamente:

- Máximo 2 equipos por grupo en la caja de **dieciseisavos**.
- Máximo 2 equipos por grupo **en el conjunto** de las cajas de campeón, subcampeón, semifinalistas, cuartos y octavos (no por caja individual).

Incluir el ejemplo aclaratorio: con los equipos de posiciones 9, 10, 23 y 24 (grupo A), no se puede poner el 23 en cuartos, el 24 en semifinales y el 10 en octavos; 2 de ellos deben ir obligatoriamente a dieciseisavos.

## Tests

### porra-spa

Nuevo `tests/finalPredictionsValidation.test.js` (estilo `node` + `assert`, como `tests/eliminatorias.test.js`):

- Válido: grupo A repartido 2 en `roundOf32` + 2 en el resto → sin violaciones.
- Inválido (ejemplo reportado): 23 en cuartos, 24 en semis, 10 en octavos (solo 1 en dieciseisavos) → violación del resto combinado.
- Inválido: 3 del mismo grupo en `roundOf32` → violación de dieciseisavos.
- Válido parcial: 2 fuera + 1 sin colocar → sin violaciones.
- Límites: exactamente 2 en el resto combinado → ok; 3 → error.
- `champion`/`runnerUp` nulos se ignoran.

### api-porra

Nuevo `tests/finalPredictions.test.js` con `node:test` (estilo `tests/matchStats.test.js`), mismos casos.

## Verificación

- porra-spa: `node tests/finalPredictionsValidation.test.js` (y el resto de tests del repo sin regresiones).
- api-porra: `node --test tests/finalPredictions.test.js`.
- Manual en navegador: intentar el ejemplo reportado → tostada bloqueando el tercer equipo del grupo fuera de dieciseisavos; el backend rechaza un payload manipulado con `400`.

## Fuera de alcance

- Cambio en el modelo de datos o en la UI de eliminatorias.
- Reglas Top-8 (se mantienen como están).
- Restricciones por caja en dieciseisavos (máximo 2 por grupo se conserva).
