# Diseño: Fechas de inicio/fin de fases + countdown en Inicio

**Fecha:** 2026-08-15
**Proyectos:** api-porra (backend) y porra-spa (frontend)
**Alcance:** Modelo `GameConfig`, `GET /api/config`, `PUT /api/admin/fases-fechas`, panel admin SPA, countdown en tab Inicio

---

## Contexto

La porra tiene 13 fases definidas en `data/fases.json` (duplicado en ambos repos). El backend guarda en MongoDB (`GameConfig`) la fase actual (`faseJuego`) y la expone vía `GET /api/config`; el admin la cambia desde el panel de administración de la SPA (`showAdminModal` → `PUT /api/admin/fase-juego`).

Se quiere mostrar al usuario las fechas de inicio y fin de las diferentes fases como plazos. Las fechas se irán rellenando según avanza la competición (algunas se desconocen al principio), por lo que deben ser editables por el admin y almacenarse en MongoDB.

## Objetivo

1. Permitir al admin definir, desde la SPA, las fechas de inicio/fin de cada una de las 13 fases (almacenadas en MongoDB).
2. Mostrar en el tab Inicio, debajo de la cabecera y a la derecha, un countdown al siguiente hito de la fase actual (inicio de la siguiente fase o fin de la fase actual).

## No está en alcance

- **No** implementar caché de la config (la SPA la pide en cada carga, como hoy).
- **No** automatizar el cambio de `faseJuego` según las fechas (sigue manual vía admin).
- **No** modificar `data/fases.json` (ni backend ni frontend): las fechas viven solo en MongoDB.
- **No** derivar fechas del `calendar.json`.

## Cambios — Backend (`api-porra`)

### 1. Modelo `db/models/GameConfig.js`

Añadir campo `fasesFechas`:

```js
fasesFechas: { type: Object, default: {} }
```

Forma esperada:

```json
{
  "FASE_PRETEMPORADA": { "inicio": null, "fin": null },
  "FASE_LIGA": { "inicio": "2026-09-08T20:00:00.000Z", "fin": null },
  "FASE_PRE16": { "inicio": null, "fin": null },
  "...": "..."
}
```

Valores: `Date | null`. `null` = fecha aún desconocida.

### 2. `GET /api/config` (`server.js`)

Añadir `fasesFechas: config.fasesFechas || {}` al objeto `config` de la respuesta (en los dos branches: doc existente y fallback cuando no existe).

### 3. Nuevo endpoint admin `PUT /api/admin/fases-fechas`

- Requiere `verifyAdmin` (mismo patrón que `/api/admin/fase-juego`).
- Body: `{ fasesFechas: { FASE_LIGA: { inicio: "ISO"|null, fin: "ISO"|null }, ... } }`.
- Validación:
  - Cada clave debe estar en `FASES_VALIDAS` (las 13 de `data/fases.json`). Si no → `400`.
  - Para cada fase, si `inicio` y `fin` son ambos no-null, `inicio < fin` (fecha válida). Si no → `400`.
  - Valores `null` y `""` se tratan como "sin fecha" (`null`).
- Persistir con `$set: { fasesFechas, updatedBy: admin.username, updatedAt: new Date() }` (upsert, como los endpoints hermanos).
- Respuesta `200` con `{ ok: true, fasesFechas, updatedBy, updatedAt }`.

Nota: permite guardar parcialmente (solo las fases que vengan en el body). El frontend enviará siempre las 13 para simplificar.

## Cambios — Frontend (`porra-spa`)

### 4. Lectura de fechas

`loadInitialData()` ya hace `AppState.appConfig = configData.config`, así que `fasesFechas` queda en `AppState.appConfig.fasesFechas` automáticamente. Actualizar el objeto de fallback (línea ~302) para incluir `fasesFechas: {}`.

### 5. Edición admin — sección en `showAdminModal()`

Añadir al modal (debajo del selector de fase) una sección "📅 Fechas de fases":

- Listar las 13 fases de `AppState.fases` (nombre + `desc`).
- Por cada fase: dos `<input type="datetime-local">` (Inicio / Fin), precargados desde `AppState.appConfig.fasesFechas[<fase>]` (con valor vacío si `null`).
- Conversión: ISO ↔ datetime-local (local time). Si el input está vacío → enviar `null`.
- Botón "Guardar fechas" que envía `PUT /api/admin/fases-fechas` con las 13 fases `{ inicio, fin }`, y en éxito actualiza `AppState.appConfig.fasesFechas` + `showToast`.

### 6. Countdown en el tab Inicio (`renderInicioTab()`)

Debajo de la cabecera, alineado a la derecha, solo en el tab Inicio:

- **Lógica** (función pura testeable `getCountdownTarget(faseActual, fases, fasesFechas, ahora)`):
  1. Determinar la fase actual por `faseJuego` y la siguiente fase en orden (`AppState.fases`, id+1).
  2. Si `ahora < inicio de la siguiente fase` (e inicio existe) → objetivo = inicio de la siguiente fase; etiqueta "INICIA FASE X".
  3. Si `ahora` está entre `[inicio, fin]` de la fase actual → objetivo = fin de la fase actual; etiqueta "FIN FASE ACTUAL".
  4. Si no hay fechas aplicables, `FASE_POSTFINAL` o fecha ya pasada → devolver `null` (no mostrar countdown).
- **Render**: marco dorado ajustado al contenido — borde `1px solid rgba(245,158,11,0.5)`, radio `12px`, fondo `rgba(245,158,11,0.06)`, padding `8px 14px`.
  - Etiqueta superior: `⏳ FIN FASE ACTUAL` (o `INICIA ...`), 9px, `--text-muted`/`#94A3B8`, uppercase.
  - Números: color `#F59E0B`, tamaño uniforme (15px), peso 800.
  - Letras `d h m s`: 11px, mismo color dorado, separación media del número (`margin: 0 7px 0 3px`).
  - Días **sin** cero delante; horas/min/seg con dos dígitos.
  - Incluye segundos, con `font-variant-numeric: tabular-nums`.
- **Actualización**: `setInterval` de 1 segundo que actualiza el texto del countdown (guardar el id del intervalo y limpiarlo al salir del tab o navegar, para evitar leaks).

## Consideraciones

- **Null handling**: cualquier fecha `null` se interpreta como "no se sabe aún" → el countdown se oculta (no se inventan plazos).
- **Fase POSTFINAL**: la porra ha terminado → no hay countdown.
- **Coherencia visual**: se reutilizan variables/tokens de `:root` y los estilos dark/glass existentes; sin introducir frameworks.
- **Cache-busting**: tras tocar `css/styles.css` o `js/main.js` en porra-spa, incrementar la versión `?v=X` en `index.html` (regla de AGENTS.md).

## Verificación

### Backend
- `PUT /api/admin/fases-fechas` con body válido → 200 y persiste en Mongo.
- Con clave no válida → 400.
- Con `inicio > fin` → 400.
- Sin token admin → 403.
- `GET /api/config` devuelve `fasesFechas` (y `{}` si no existe el doc).
- Test unitario de la validación (como `tests/finalPredictions.test.js`).

### Frontend
- `getCountdownTarget` cubierto por test: fase actual dentro de rango, antes del inicio de la siguiente, con fechas `null`, y en `FASE_POSTFINAL`.
- Modal admin muestra las 13 fases con sus inputs precargados y guarda correctamente.
- Countdown se muestra debajo de la cabecera a la derecha, se actualiza cada segundo y desaparece cuando no aplica.
- `npm test` en porra-spa y los tests de api-porra pasan.
