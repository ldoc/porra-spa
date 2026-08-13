# Diseño: Navegación de jornadas compacta en Pronósticos + indicador de fase

**Fecha:** 2026-08-13
**Proyecto:** porra-spa

## Contexto

En la pantalla de Pronósticos, la cabecera muestra un menú para navegar entre jornadas:

```html
<div class="round-nav">
  <button class="round-nav-btn" id="btn-round-prev" disabled>&larr; Jornada anterior</button>
  <span class="round-indicator" id="round-indicator">Jornada 1 de ${rounds}</span>
  <button class="round-nav-btn" id="btn-round-next">Siguiente jornada &rarr;</button>
</div>
<div class="round-progress-text" id="round-progress-text"></div>
```

Problemas detectados (js/main.js:3441-3446, css/styles.css:1830-1884):

1. **Descentrado y recorte**: los botones usan `flex: 1` + `white-space: nowrap` con etiquetas largas ("Jornada anterior"/"Siguiente jornada") y el indicador tiene `flex-shrink: 0`. En el ancho móvil (~343px de contenido) el contenido supera el ancho disponible y el botón "Siguiente jornada" se corta por la derecha. Además el centro percibido queda desplazado.
2. **Altura excesiva**: los botones ocupan ~40px y el `.round-progress-text` añade ~27px + margen, restando espacio al scroll de las cajas de partidos.
3. **No se indica la fase**: el menú dice "Jornada 1 de 8" pero no muestra de qué fase son esos pronósticos (Liga, Dieciseisavos, Octavos, Cuartos, Semis, Final).

## Objetivos

1. Menú de navegación **centrado** y sin recortes en móvil.
2. Ocupar el **mínimo de altura** posible para maximizar el scroll de partidos.
3. Mostrar la **fase** de la que se hacen los pronósticos (Liga / Dieciseisavos / Octavos / Cuartos / Semifinal / Final).
4. En fases con **una sola jornada** (todas las de eliminatorias), quitar el navegador y dejar solo el título de la fase.
5. Diferenciar visualmente el **progreso de partidos pronosticados** del **indicador de jornada**.

## Decisiones acordadas

- **Sin desplegable**: la navegación entre jornadas se hace únicamente con las flechas ‹ ›.
- **Fase de Liga** (8 jornadas): selector compacto `[‹] [píldora de fase] [›]` centrado.
  - Píldora: `⚽ Liga · Jornada <1>/8 <3/18>` donde la jornada activa va en cian y el progreso es un **contador con fondo verde**.
  - Progreso integrado: `<predicciones de la jornada>/<total de la jornada>` (se actualiza al navegar y al pulsar +/-).
- **Eliminatorias** (16, 8, 4, semis, final): solo la píldora de fase centrada (`⚔️ Octavos`, `🏆 Final`…), sin flechas ni contador.
- **Color de la píldora según la fase**: Liga naranja `#FF9800`, Dieciseisavos azul `#2196F3`, Octavos/Cuartos/Semifinal/Final rojo `#F44336`.
- **Altura**: flechas de 36px y píldora compacta. Se elimina `.round-progress-text` y `.round-indicator` de Liga (el progreso se integra en la píldora).
- Se renuncia parcialmente al área táctil mínima de 44px del AGENTS.md en estas flechas de cabecera por petición explícita de compactación (36px).

## Cambios propuestos

### 1. JavaScript — helpers de la píldora (js/main.js)

Nuevas funciones puras (testables):

```js
// Icono y color por fase de calendario
function getFasePillInfo(fase) {
  const map = {
    liga:  { label: 'Liga',        icono: '⚽',  color: '#FF9800' },
    '16':  { label: 'Dieciseisavos', icono: '⚔️', color: '#2196F3' },
    '8':   { label: 'Octavos',     icono: '⚔️',  color: '#F44336' },
    '4':   { label: 'Cuartos',     icono: '⚔️',  color: '#F44336' },
    semis: { label: 'Semifinal',   icono: '⚔️',  color: '#F44336' },
    final: { label: 'Final',       icono: '🏆',  color: '#F44336' }
  };
  return map[fase] || { label: fase, icono: '⚽', color: '#FF9800' };
}
```

- `buildRoundFasePill(fase, round, totalRounds, predicted, total)` → devuelve el HTML de la píldora:
  - Si `totalRounds > 1`: `⚽ Liga · Jornada <span class="round-fase-jornada">1</span>/8 <span class="round-fase-progress">3/18</span>`.
  - Si `totalRounds === 1` (eliminatorias): solo `⚔️ Octavos` (sin jornada ni contador).
  - La píldora lleva `style="--fc: <color>"` para el borde/fondo.
- `renderRoundNav()` → actualiza el contenido de `#round-fase-pill` y el estado `disabled` de `#btn-round-prev`/`#btn-round-next`. Reutilizada por `renderPronosticosTab`, `renderRoundMatches` y `updateProgressCounts`.

### 2. JavaScript — template de `renderPronosticosTab` (js/main.js:3441-3446)

Sustituir el bloque `.round-nav` + `.round-progress-text` por:

```html
<div class="round-nav ${rounds > 1 ? '' : 'round-nav-single'}" id="round-nav">
  ${rounds > 1 ? `
    <button class="round-nav-arrow" id="btn-round-prev" disabled>&lsaquo;</button>
    <span class="round-fase-pill" id="round-fase-pill"></span>
    <button class="round-nav-arrow" id="btn-round-next">&rsaquo;</button>
  ` : `
    <span class="round-fase-pill round-fase-pill-single" id="round-fase-pill"></span>
  `}
</div>
```

- Eliminar el `<div class="round-progress-text" id="round-progress-text"></div>`.
- Tras el render inicial se llama a `renderRoundNav()`.

### 3. JavaScript — actualización de indicadores (js/main.js)

- `renderRoundMatches` (líneas 3496-3506): eliminar la actualización de `#round-indicator` y `#round-progress-text`; sustituir por `renderRoundNav()`.
- `updateProgressCounts` (líneas 3639-3642): eliminar la actualización de `#round-progress-text`; sustituir por `renderRoundNav()`.
- `setupRoundNavigation` (líneas 3655-3670): sin cambios funcionales (mismos ids `btn-round-prev`/`btn-round-next`).

### 4. CSS — estilos del navegador (css/styles.css:1830-1884)

Reemplazar `.round-nav`, `.round-nav-btn`, `.round-nav-btn:disabled`, `.round-nav-btn:not(:disabled):active`, `.round-indicator`, `.round-progress-text` y `.round-progress-text strong` por:

```css
/* Navegación de rondas (compacta) */
.round-nav {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.round-nav-single {
  grid-template-columns: 1fr;
  justify-items: center;
}

.round-nav-arrow {
  width: 36px;
  height: 36px;
  padding: 0;
  background: var(--ucl-card);
  border: 1px solid var(--border-color);
  color: var(--text-primary);
  border-radius: var(--radius-sm);
  font-size: 18px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  justify-self: stretch;
  transition: all var(--transition-fast);
}

.round-nav-arrow:disabled {
  opacity: 0.3;
  cursor: default;
}

.round-nav-arrow:not(:disabled):active {
  background: var(--accent-cyan);
  color: #021319;
  transform: scale(0.95);
}

.round-fase-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 800;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--fc, #FF9800) 12%, transparent);
  border: 1px solid var(--fc, #FF9800);
  border-radius: 9999px;
  padding: 5px 12px;
  white-space: nowrap;
}

.round-fase-pill-single {
  padding: 6px 14px;
}

.round-fase-jornada {
  color: var(--accent-cyan);
}

.round-fase-progress {
  background: #10B981;
  color: #021319;
  border-radius: 9999px;
  padding: 1px 7px;
  font-size: 10px;
  font-weight: 800;
}
```

- La píldora queda perfectamente centrada gracias al grid `1fr auto 1fr` con flechas de igual tamaño.
- El color de fase se inyecta desde JS mediante la variable CSS `--fc`.

### 5. Tests

Nuevo fichero `tests/roundNav.test.js` (patrón de espejo de función pura + assert, como el resto):

- `getFasePillInfo(fase)` devuelve label, icono y color correctos para `liga`, `16`, `8`, `4`, `semis`, `final` (y fallback).
- `buildRoundFasePill('liga', 1, 8, 3, 18)` incluye "Liga", "Jornada", "1", "8", "3/18" y la clase `round-fase-progress`.
- `buildRoundFasePill('8', 1, 1, 0, 0)` devuelve solo el label de la fase sin contador ni "Jornada".
- `buildRoundFasePill` incluye el color correcto en `--fc` por fase.

Ejecución: `node tests/roundNav.test.js`.

### 6. Cache-busting

Incrementar la versión de `css/styles.css` y `js/main.js` en `index.html` (norma de AGENTS.md).

## Fuera de alcance

- Cambiar la navegación de la pestaña de Resultados (`.resultados-round-nav`, css/styles.css:2599).
- Cambiar el estado de `AppState.currentRound` ni la lógica de navegación.
- Rediseñar el resto de la cabecera de Pronósticos (`.pronosticos-actions-row`, barras de progreso globales).
