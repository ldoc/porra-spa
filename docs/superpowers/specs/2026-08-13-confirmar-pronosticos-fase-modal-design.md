# Diseño: Confirmar pronósticos solo en FASE_PRETEMPORADA + modal de aviso + estilos de botones

**Fecha:** 2026-08-13
**Proyecto:** porra-spa (y api-porra)

## Contexto

En la cabecera de la pantalla de Pronósticos existen cuatro botones posibles: `💾 Guardar`, `✅ Confirmar`, `📊 Clasificación` y `🏆 Eliminatorias`. Actualmente:

- El botón **Confirmar** se renderiza siempre que el usuario no tenga confirmados sus pronósticos de liga, sin restricción de fase (js/main.js:3429). En FASE_LIGA y posteriores queda visible pero deshabilitado.
- La confirmación llama directamente a `POST /api/predictions/confirm` sin ningún aviso previo (js/main.js:3721).
- Los botones de la fila tienen alturas distintas: `.save-predictions-btn` (`padding: 10px 12px`), `.standings-btn` (`padding: 10px 14px`) y `.confirm-predictions-btn` (`padding: 8px 12px`) (css/styles.css:2038, 2067, 3277). El botón Confirmar sale con altura diferente al resto.

## Objetivos

1. El botón **Confirmar** solo aparece en `FASE_PRETEMPORADA`. En ninguna otra fase.
2. Antes de confirmar, mostrar un **modal de aviso** indicando que al confirmar los pronósticos ya no se podrán volver a cambiar, con opciones Aceptar / Cancelar.
3. **Estilos de botones**: compactos, ajustados al texto y de altura uniforme.
4. Los botones no deben desbordar el ancho disponible en móvil.
5. Proteger la confirmación también en el backend (solo permitida en `FASE_PRETEMPORADA`).

## Decisiones acordadas

- El botón Confirmar **visible pero deshabilitado** mientras falten pronósticos de la fase o existan cambios sin guardar contra el servidor.
- Confirmar solo se habilita cuando los 144 pronósticos de liga están completos **y guardados** contra el servidor (sin `hasUnsavedChanges`).
- Se protege el backend: `POST /api/predictions/confirm` rechaza si la fase actual no es `FASE_PRETEMPORADA`.
- Fila de botones con `flex-wrap: wrap` para no desbordar en pantallas estrechas.

## Cambios propuestos

### 1. Frontend — visibilidad del botón Confirmar (js/main.js)

- **Renderizado** (template de `renderPronosticosTab`, línea 3429): mostrar `✅ Confirmar` únicamente si `isFasePretemporada()`.
  - Estado inicial del botón: `disabled` si `predicted < total` **o** `AppState.hasUnsavedChanges` (o si la fase está congelada, que en pretemporada no ocurre).
- **`updateConfirmButton()`** (línea 3709): añadir a la condición de disabled `AppState.hasUnsavedChanges` y `!isFasePretemporada()` como red de seguridad.
- **`setupSaveButton()`** (línea 3670): mantener coherencia; tras guardar correctamente se llama a `updateConfirmButton()`, que habilitará Confirmar si procede.

### 2. Frontend — modal de aviso antes de confirmar

- Nuevo flujo: pulsar `✅ Confirmar` → abrir modal de confirmación → Aceptar ejecuta la confirmación actual; Cancelar cierra sin hacer nada.
- Reutilizar el patrón existente `.unsaved-modal-overlay` / `.unsaved-modal` (css/styles.css:2094).
- Contenido del modal:
  - Icono: ⚠️
  - Título: **"Confirmar pronósticos"**
  - Texto: *"Al confirmar los pronósticos de los partidos ya no podrás volver a cambiarlos. Al confirmar desbloquearás el acceso a la pantalla de Eliminatorias."*
  - Botones: **"✅ Confirmar pronósticos"** (verde, aceptar) y **"Cancelar"** (estilo `--ucl-surface`).
- Nueva función `showConfirmPredictionsModal()` que añade el overlay al DOM y conecta los listeners. Al aceptar llama a `confirmPredictions()` (js/main.js:3721).

### 3. Frontend — estilos de botones (css/styles.css)

- Unificar la fila `.pronosticos-actions-row`:
  - `display: flex; flex-wrap: wrap; gap: 8px; align-items: center;`
- Unificar medidas de los tres botones de la fila:
  - `font-size: 13px`; `font-weight: 700`; `padding: 8px 12px`; `border-radius: 8px`; `white-space: nowrap`; `line-height: 1.2`; `height: 36px`; `box-sizing: border-box`.
- `.save-predictions-btn` en la fila: pasar de `padding: 10px 12px` a las medidas unificadas (`flex: 1 1 auto; min-width: 0`).
- `.confirm-predictions-btn`: usar las mismas medidas (elimina el padding distinto de 8px vs 10px).
- `.standings-btn`: usar las mismas medidas (`flex: 1 1 auto` en lugar de `flex: 0 0 auto`).
- Mantener el `flex-wrap` como protección contra desbordamiento en móviles estrechos.
- Nota: se renuncia al área táctil mínima de 44px del AGENTS.md para estos botones secundarios de cabecera, por petición explícita de compactación.

### 4. Backend — restringir confirmación a FASE_PRETEMPORADA (api-porra/server.js)

- En `POST /api/predictions/confirm` (server.js:875), tras `checkPhaseConsistency`:
  ```js
  const currentPhase = await getFaseJuego();
  if (currentPhase !== 'FASE_PRETEMPORADA') {
    sendJson(req, res, 409, { ok: false, error: 'La confirmación solo está disponible en FASE_PRETEMPORADA' });
    return;
  }
  ```

### 5. Tests

- En `tests/integrationPhasePredictions.test.js`, añadir funciones espejo de la lógica nueva:
  - `shouldShowConfirmButton()` → true solo en `FASE_PRETEMPORADA`.
  - Confirmar habilitado solo cuando: pretemporada, fase completa **y** sin `hasUnsavedChanges`.
- Casos:
  - FASE_PRETEMPORADA con todo completo y guardado → confirmar habilitado / visible.
  - FASE_PRETEMPORADA con cambios sin guardar → deshabilitado.
  - FASE_PRETEMPORADA incompleto → deshabilitado.
  - FASE_LIGA (y otras) → no visible.

### 6. Cache-busting

- Incrementar la versión de `css/styles.css` y `js/main.js` en `index.html` (norma de AGENTS.md).

## Fuera de alcance

- Cambiar el flujo de guardado ni el endpoint de confirmación salvo la guarda de fase.
- Rediseñar el resto de la pantalla de Pronósticos.
