# Design: Live v2 — seguir mi fila en la clasificación

## Resumen

Añadir un botón **🎯** en la cabecera del Live que, cuando está activo, centra
la fila del usuario logueado en la pantalla y la vuelve a centrar después de
cada actualización del poll. La preferencia se recuerda en `localStorage`.

## Objetivos

- Centrar la fila propia en el contenedor de scroll (`.resultados-scroll`), no
  solo dejarla visible.
- Mantenerla centrada en cada poll/render mientras el toggle esté activo.
- Toggle persistente y explícito; si el usuario hace scroll manual, el
  siguiente poll vuelve a centrar.
- Respetar `prefers-reduced-motion` y no romper el layout móvil.

## No-objetivos

- Cambiar el orden de la clasificación o el scoring.
- Seguir a otros usuarios.
- Backend o sincronización entre dispositivos.
- Auto-desactivar el toggle al hacer scroll manual (decisión: siempre sigue).

## Contexto

- El scroll del Live es `.resultados-scroll` (`overflow-y: auto`,
  `css/styles.css:3007`).
- La cabecera `.livev2-fixed` es `position: sticky` dentro de ese contenedor.
- Las filas están en `#livev2-rows` (`.livev2-rows`), cada una con
  `data-livev2-row="<nombre>"` y la propia con `.me` (`js/live-v2-ui.js:818`).
- `updateLiveV2Dom` reordena/parchea las filas en cada poll
  (`js/live-v2-ui.js:1285`); `renderLiveV2Html` pinta la cabecera
  (`:987`).
- Ya existen `liveV2PrefersReducedMotion()` y el patrón de toggles con
  `dataset.bound` (sonido/fullscreen).

## Decisiones

- **Ubicación:** icono 🎯 en `.livev2-status-right`, junto al countdown/⛶/🔔.
- **Persistencia:** `localStorage` con clave `porra_live_follow_me`
  (`'1'`/`'0'`), por defecto off.
- **Comportamiento:** persistente y siempre sigue; el scroll manual no lo
  apaga.
- **Centrado:** cálculo sobre `.resultados-scroll` con clamp a los límites.

## 1. Estado y persistencia

- `LIVEV2_FOLLOW_KEY = 'porra_live_follow_me'`.
- `liveV2FollowEnabled()` → `localStorage.getItem(KEY) === '1'` (false si no
  hay storage o error).
- `setLiveV2FollowEnabled(v)` → guarda `'1'`/`'0'` con try/catch.
- No se añade al backend ni a `AppState`; es preferencia local.

## 2. Botón

- Solo se pinta si hay `AppState.currentUser`; si no, no se muestra.
- HTML:
  ```html
  <button type="button" id="livev2-follow-toggle"
          class="livev2-follow on|" aria-pressed="true|false"
          aria-label="Dejar de seguir mi fila|Seguir mi fila">🎯</button>
  ```
- Se coloca en `.livev2-status-right` (después del countdown y antes de los
  puntos). Objetivo táctil ≥44px.
- Activo: color de acento; inactivo: `--text-muted`.
- `updateLiveV2FollowToggle(root)` sincroniza icono/clase/aria.
- `bindLiveV2FollowToggle(root)` con `dataset.bound`; se llama donde ya se
  enlazan sonido/fullscreen.
- Al pulsar: invierte el estado, persiste, actualiza el botón y, si queda
  activo, centra inmediatamente.

## 3. Centrado

### 3.1 Cálculo

Helper puro:

```js
function liveV2CenterTarget({ scrollTop, rowTop, rowHeight, viewportHeight, scrollHeight }) {
  const target = scrollTop + rowTop + rowHeight / 2 - viewportHeight / 2;
  const max = Math.max(0, scrollHeight - viewportHeight);
  return Math.max(0, Math.min(max, target));
}
```

- `rowTop` = `rowRect.top - scrollerRect.top` (posición relativa al viewport
  del contenedor). `rowRect`/`scrollerRect` con `getBoundingClientRect()`.
- `scrollTop` = `scroller.scrollTop`, `viewportHeight` = `scroller.clientHeight`,
  `scrollHeight` = `scroller.scrollHeight`.
- Se aplica con `scroller.scrollTo({ top, behavior })`, con
  `behavior = liveV2PrefersReducedMotion() ? 'auto' : 'smooth'`.

### 3.2 Cuándo se centra

- Al activar el toggle.
- Al final de `updateLiveV2Dom` (cada poll), si el toggle está activo.
- En el render inicial: tras montar el HTML, con
  `requestAnimationFrame(liveV2CenterMe)` (mismo patrón que el countdown).
- Si no hay usuario, no hay fila propia o no se encuentra
  `.resultados-scroll`, no hace nada.

### 3.3 Casos límite

- Fila al principio/final: el clamp evita scroll negativo o pasado.
- `prefers-reduced-motion`: salto sin animación.
- Pantalla completa (`body.live-fs`): mismo contenedor; funciona igual.
- Si el usuario no está en la lista (sin sesión o filtrado), no-op.
- El scroll suave no debe competir con el FLIP de reordenación: se llama
  después de aplicar el DOM/animación.

## 4. Arquitectura y archivos

- `js/live-v2-ui.js`
  - `liveV2FollowEnabled`/`setLiveV2FollowEnabled`.
  - `liveV2FollowToggleHtml`, `updateLiveV2FollowToggle`,
    `bindLiveV2FollowToggle`.
  - `liveV2CenterTarget`, `liveV2CenterMe`.
  - Incluir el botón en `renderLiveV2Html`.
  - Llamar a `bindLiveV2FollowToggle` en los puntos de enlace existentes.
  - `liveV2CenterMe()` al final de `updateLiveV2Dom` y en el arranque del
    render inicial.
- `css/styles.css`
  - `.livev2-follow` (44px, transparente, icono) y `.livev2-follow.on`.
  - Revisar el ancho de `.livev2-status-right` a 360px; si aprieta, reducir
    gaps (no el área táctil).
- `index.html`
  - Subir `js/live-v2-ui.js?v=` y `css/styles.css?v=`.
- Sin cambios en `api-porra`.

## 5. Testing

- `liveV2CenterTarget`: centrado simple, fila cerca del inicio (clamp 0),
  fila cerca del final (clamp max), contenedor no desplazable.
- HTML del botón: activo/inactivo, `aria-pressed`/`aria-label`, oculto sin
  usuario.
- Persistencia: `'1'`/`'0'` con un `localStorage` falso; error de storage no
  rompe.
- Manual con el simulador: activar → tu fila centrada; poll → sigue centrada;
  scroll manual → el siguiente poll recentra; desactivar → deja de seguir;
  recargar → recuerda el estado; sin sesión → no aparece.
- `node --test tests/*.test.js` verde y `node --check`.

## 6. Criterios de aceptación

1. El botón 🎯 aparece en la cabecera solo con usuario logueado.
2. Activo centra la fila propia; inactivo no mueve el scroll.
3. Cada poll mantiene la fila centrada mientras esté activo.
4. El scroll manual no desactiva el toggle; el siguiente poll recentra.
5. La preferencia persiste al recargar.
6. Respeta `prefers-reduced-motion` y los límites del contenedor.
7. Tests y cache-busters actualizados.

## 7. Riesgos y mitigación

- **Scroll suave + FLIP**: centrar después de aplicar el DOM, no durante.
- **Cabecera sticky**: el centrado usa el viewport del contenedor; la cabecera
  queda arriba y no tapa el centro.
- **Fila no encontrada**: no-op silencioso.
- **Layout a 360px**: el botón añade 44px; revisar que la fila de estado no
  desborde. Si desborda, reducir gaps, no el área táctil.
