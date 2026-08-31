# Progreso de jugadores (panel admin)

## Contexto

El admin necesita una pantalla dentro de su sesión que muestre una tabla con todos los usuarios registrados y su progreso en cada tipo de predicción:

- **Liguilla**: pronósticos de partidos de fase de liga (144 partidos).
- **Validado**: si el usuario ha confirmado los 144 pronósticos de liguilla (`predictionsConfirmed`).
- **Eliminatorias**: bloques rellenados del cuadro de eliminatorias (`finalPredictions`), 24 en total.
- **Plantilla**: jugadores seleccionados de la plantilla ideal (25).
- **Fases knockout** (dinámicas): pronósticos de partidos por fase (`16avos`, `Octavos`, etc.) según vayan apareciendo en el calendario.

Cada celda de conteo muestra `X/total` y se colorea en **rojo** si no está completa, **verde** si lo está.

### Limitación actual de la API

En `FASE_PRETEMPORADA`, `GET /api/predictions/all` y `GET /api/squad/all` solo devuelven los datos del usuario autenticado (incluso para admin), y el flag `predictionsConfirmed` de otros usuarios no se expone en ninguna respuesta. Por tanto, la pantalla requiere un **endpoint admin dedicado** en `api-porra`.

## Diseño

### Arquitectura y flujo de datos

```
[Admin] → Panel de Administración (modal existente)
          └─ botón "📊 Progreso de jugadores"
               └─ showAdminProgressModal() → modal a pantalla completa
                    ├─ GET /api/admin/progress  (JWT admin)
                    └─ cálculo por fase contra AppState.matches
                         └─ render tabla
```

- **Data-driven**: las columnas de fases de partidos se derivan de `AppState.matches` agrupado por campo `fase` (`liga`, `16`, `8`, `4`, `semis`, `final`). Hoy solo existe `liga` (144 partidos); cuando el calendario incorpore fases knockout, sus columnas aparecerán automáticamente.
- El **cálculo vive en el frontend** (es quien conoce el calendario actual); el backend devuelve datos crudos.
- Sin interacción en las filas (sin modal de detalle).

### Backend (`api-porra/server.js`)

Nuevo endpoint `GET /api/admin/progress`, protegido con `verifyAdmin` (403 si no es admin). Proyección: `username avatar isAdmin predictions predictionsConfirmed finalPredictions squad`.

Respuesta:

```json
{
  "ok": true,
  "users": [
    {
      "username": "juan123",
      "avatar": "⚽",
      "isAdmin": false,
      "predictionsConfirmed": false,
      "predictions": { "14566909": { "home": 2, "away": 1 }, "14566910": { "home": null, "away": null } },
      "finalPredictions": { "champion": 42, "runnerUp": null, "semiFinalists": [1, 2], "quarterFinalists": [], "roundOf16": [], "roundOf32": [] },
      "squadCount": 18
    }
  ]
}
```

- `squadCount` es la longitud del array `squad` (se evita enviar la plantilla completa).
- `sendJson` ya calcula ETag débil determinista → compatible con el caché HTTP del backend.
- No añade campos a modelos: es solo lectura.

### Frontend (`porra-spa`)

#### Acceso

En `showAdminModal()` (js/main.js), añadir un botón **"📊 Progreso de jugadores"** con gradiente verde (`#10B981 → #059669`, consistente con "Gestionar Códigos") que llama a `showAdminProgressModal()`.

#### Módulo nuevo `js/progresoAdmin.js`

IIFE estilo `js/stats.js` / `js/fasesFechas.js` (funciones puras exportadas para tests + render). Expone:

| Función | Responsabilidad |
|---------|-----------------|
| `countPredictedInPhase(matches, predictions)` | nº de partidos de la fase con `home` y `away` numéricos (no null) |
| `computeFinalSlotsFilled(finalPredictions)` | nº de bloques rellenados del cuadro (máx 24) |
| `computeProgressForUser(user, matchesByFase)` | Devuelve celdas de progreso del usuario: `{ byFase: { liga: {done,total}, ... }, finalFilled, finalLocked, squadCount, predictionsConfirmed }` |
| `buildProgressTableHtml(users, matchesByFase)` | HTML de la tabla completa |
| `showAdminProgressModal()` | Abre el modal a pantalla completa, hace fetch y renderiza |

#### Definiciones de progreso

- **Liguilla**: `done` = partidos de `AppState.matches` con `fase === 'liga'` donde `predictions[id].home` y `.away` son números; `total` = nº de partidos `liga`.
- **Fase knockout X**: misma regla sobre los partidos de esa fase (cuando existan).
- **Eliminatorias**: `finalFilled` = suma de slots no vacíos de `finalPredictions` (campeón 1 + subcampeón 1 + `semiFinalists` 2 + `quarterFinalists` 4 + `roundOf16` 8 + `roundOf32` 8 = 24). Si `predictionsConfirmed === false`, la celda se muestra como `🔒` en gris (el cuadro solo se desbloquea tras confirmar liguilla).
- **Validado**: `predictionsConfirmed` → `✅ Validado` / `⏳ Pendiente`.
- **Plantilla**: `squadCount` / 25.

#### Pantalla (móvil vertical, modal a pantalla completa, scroll vertical)

```
┌──────────────────────────────────────┐
│ ← Progreso de jugadores      ↻  ✕    │
│ Actualizado hace 3 min              │
├──────────────────────────────────────┤
│ 👥 12 · ✅ Liguilla 8/12 · 🏆 Val. 7 │
│ 🧩 Plantilla 9/12 · 🗓️ Elimin. 5/12 │
├──────────────────────────────────────┤
│ JUGADOR      LIGUILLA  VALIDADO      │
│ ⚽ luciab   ▓▓░░ 89/144  ⏳ Pendiente │
│ 🦁 pablo_  ▓▓░░ 102/144 ⏳ Pendiente │
│ 🏆 marta7  ██████ 144/144 ✅ Validado│
│ 🧠 admin   ██████ 144/144 ✅ Validado│
├──────────────────────────────────────┤
│ Eliminatorias y Plantilla:            │
│ ⚽ luciab  🔒      · Plantilla 18/25 │
│ 🦁 pablo_  14/24  · Plantilla 25/25 │
│ 🏆 marta7  24/24  · Plantilla 25/25 │
│ 🧠 admin   24/24  · Plantilla 25/25 │
└──────────────────────────────────────┘
```

**Detalles visuales**:
- Celdas de conteo **rojas** (`#ef4444`) si `done < total`; **verdes** (`--accent-green #10B981`) si completas; mini barra de progreso.
- `144/144` verde + badge `✅ Validado` dorado (`--accent-gold`).
- Eliminatorias `🔒` en `--text-muted` si no confirmado.
- Cabecera de columnas con `position: sticky` dentro del scroll del modal.
- **Orden por defecto**: por `done` de liguilla ascendente (menos completados arriba; los que no han confirmado quedan al final con `done=144`). Empates se resuelven alfabéticamente.
- **Desplegable de orden** (3 opciones): `Nombre` (alfabético), `Liguilla ↑` (menos completados primero), `Validados` (confirmados primero, luego pendientes).
- Chips de resumen en cabecera: `👥 Total jugadores`, `✅ Liguilla completa`, `🏆 Validados`, `🧩 Plantilla completa`, `🗓️ Eliminatorias completas`.
- Estilos con variables CSS existentes (modo oscuro, glassmorphism); sin scroll horizontal.
- Botón `↻` para refrescar y timestamp "Actualizado hace X min".

#### Manejo de errores

- 401 → `logout()`.
- 403 → toast "Acceso denegado" y cierre del modal.
- Fallo de red → toast + estado de error con botón "Reintentar" dentro del modal.
- Estado de carga inicial: spinner/texto "Cargando…".

### Estilos CSS

Añadir en `css/styles.css` una sección `.admin-progress-*` reutilizando variables (`:root`): contenedor de modal, chips, tabla, celdas `state-done` / `state-pending`, barra de progreso, header sticky, desplegable de orden.

## Archivos a modificar

| Proyecto | Archivo | Cambio |
|----------|---------|--------|
| api-porra | `server.js` | Nuevo endpoint `GET /api/admin/progress` |
| porra-spa | `js/progresoAdmin.js` | Nuevo módulo (lógica pura + render + modal) |
| porra-spa | `js/main.js` | Botón en `showAdminModal()` que llama a `showAdminProgressModal()` |
| porra-spa | `css/styles.css` | Sección `.admin-progress-*` |
| porra-spa | `tests/progresoAdmin.test.js` | Tests de funciones puras |
| porra-spa | `index.html` | Incrementar `v=` de `js/main.js`, `css/styles.css`, añadir `js/progresoAdmin.js` |

## Verificación

1. Login como admin → Perfil → Panel de Administración → botón "📊 Progreso de jugadores" visible.
2. La tabla lista todos los usuarios con sus conteos por fase, eliminatorias (🔒 si no confirmado), plantilla y estado de validación.
3. Celdas rojas cuando `X < total`, verdes cuando completas; `144/144` + `✅ Validado`.
4. Orden por defecto = menos completados primero en liguilla; el desplegable cambia el orden.
5. Login como no-admin → endpoint devuelve 403 y el modal no se abre.
6. `node tests/progresoAdmin.test.js` pasa.
7. Sin errores en consola; render responsivo en móvil vertical.