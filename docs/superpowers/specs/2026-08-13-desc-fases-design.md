# Diseño: Campo `desc` para fases de la competición

## Contexto

`data/fases.json` define las 13 fases de la porra. Cada fase tiene un campo `nombre`
con el código interno (ej. `FASE_PRE16`) que en varios puntos de la interfaz se muestra
tal cual al usuario (tarjeta de Inicio, modal de administración, modales de cambio de fase).

Se quiere mostrar al usuario el nombre legible de cada fase, no el código interno.

## Objetivo

1. Añadir el campo `desc` (descripción / nombre legible) a cada una de las 13 fases en
   `data/fases.json`.
2. En `js/main.js`, sustituir la visualización del campo `nombre` / código de fase por el
   campo `desc` en todos los puntos donde se muestra al usuario.

El campo `nombre` se conserva como identificador interno (búsquedas y envío de código a la
API no cambian).

## Valores de `desc`

| Fase (`nombre`) | `desc` |
|---|---|
| `FASE_PRETEMPORADA` | Pretemporada |
| `FASE_LIGA` | Liga |
| `FASE_PRE16` | Previa Knockouts |
| `FASE_16` | Knockouts |
| `FASE_PRE8` | Previa Octavos |
| `FASE_8` | Octavos de final |
| `FASE_PRE4` | Previa Cuartos |
| `FASE_4` | Cuartos de final |
| `FASE_PRESEMIS` | Previa Semifinales |
| `FASE_SEMIS` | Semifinales |
| `FASE_PREFINAL` | Previa Final |
| `FASE_FINAL` | Final |
| `FASE_POSTFINAL` | Fin de porra |

## Cambios

### 1. `data/fases.json`

Añadir `desc` a cada objeto de `fases[]`.

### 2. Helper en `js/main.js`

```js
function getFaseDesc(codigo) {
  const f = (AppState.fases || []).find(f => f.nombre === codigo);
  return f?.desc || codigo;
}
```

### 3. Sustituciones de visualización en `js/main.js`

| Línea | Sitio | Cambio |
|---|---|---|
| 2952 | Tarjeta de Inicio: título de fase | `currentFase?.desc \|\| currentFase?.nombre \|\| fase` |
| 2960 | Tarjeta de Inicio: badge de fase | `${getFaseDesc(fase)}` |
| 2289 | Modal admin: dropdown (label) | `${f.desc \|\| f.nombre}` (el `value` sigue siendo `f.nombre`) |
| 2290 | Modal admin: opción por defecto del dropdown | label → `${getFaseDesc(fase)}`, `value` sin tocar |
| 2311 | Modal admin: "Fase actual" | `${getFaseDesc(fase)}` |
| 2521 | Modal confirmar cambio de fase | `${getFaseDesc(targetPhase)}` |
| 2572 | Toast "Fase cambiada a..." | `${getFaseDesc(targetPhase)}` |
| 102/104 | Overlay global de cambio de fase | `${getFaseDesc(previousPhase)}` y `${getFaseDesc(currentPhase)}` |

## Fuera de alcance

- `getFaseLabel` (`main.js:2881`), usada en las tarjetas de pendientes del Inicio
  (`main.js:3005`): se mantiene con sus etiquetas cortas actuales (16avos, octavos, ...).
- Títulos de jornadas en Resultados (`main.js:1571-1576`) y zonas de eliminatorias:
  no usan el campo `nombre`.

## Impacto

- Solo ficheros: `data/fases.json` y `js/main.js`.
- Según `AGENTS.md`, al subir cambios a `js/main.js` se debe incrementar la versión
  `js/main.js?v=X` en `index.html`.
