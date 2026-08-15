# Diseño: Header — Copa UCL, botón Ayuda y modal "Reglas de la Porra"

**Fecha:** 2026-08-15
**Proyecto:** porra-spa (frontend)
**Alcance:** Cambios en el header (sustituir la ⭐ por una 🏆, añadir un pill "Ayuda" a la izquierda del pill de perfil) y un modal "Reglas de la Porra" que muestra el contenido de `reglas/UCL.pdf` convertido a HTML estático, con chips de navegación entre secciones y enlace al PDF original.

---

## Contexto

El header de la app (`index.html`) muestra a la izquierda la marca (icono `⭐` en una caja azul degradada + "Porra UCL") y a la derecha el pill de usuario (`.user-status-pill`) que abre el perfil. El usuario quiere:

1. Sustituir el icono de la estrella del logo por una copa (estilo Champions League).
2. Añadir un botón de ayuda, con el mismo estilo que el pill de perfil, a su izquierda.
3. Que ese botón abra un modal con las **Reglas de la Porra**, cuyo contenido está en `reglas/UCL.pdf` (6 páginas).

El PDF es la fuente de verdad del contenido. Se convertirá a un HTML estático (`reglas/UCL.html`) para mostrarlo nativo en el modal sin dependencias externas.

## Objetivo

1. Header: icono `⭐` → `🏆` en `.brand-icon` (misma caja azul degradada).
2. Header: nuevo pill "Ayuda" (icono `?` + texto) a la izquierda del pill de perfil, visible solo con sesión iniciada.
3. Al pulsar "Ayuda", abrir el modal "Reglas de la Porra" con el contenido de `reglas/UCL.html`, chips de navegación por sección, y botón "Abrir PDF original".

## No está en alcance

- **No** tocar el backend (`api-porra`).
- **No** cambiar el pill de perfil ni su comportamiento (`showProfileModal`).
- **No** tocar otros iconos de la app que usan ⭐ (auth logo, pestaña Plantilla, etc.).
- **No** permitir editar el PDF desde la app.
- **No** añadir dependencias externas (PDF.js, etc.).

## Cambios — Frontend (`porra-spa`)

### 1. Icono del logo (`index.html`)

En `<div class="brand-icon">⭐</div>` sustituir `⭐` por `🏆`.

### 2. Pill de Ayuda en el header (`index.html`)

Añadir a la derecha del header, **antes** del `#user-status-pill`:

```html
<div id="user-help-pill" class="user-help-pill" style="display: none;">
  <svg viewBox="0 0 24 24">…interrogación…</svg>
  <span>Ayuda</span>
</div>
```

- Misma forma que `.user-status-pill` (pill oscura, radio completo, borde).
- Icono `?` SVG celeste (`#38bdf8` / `--accent-cyan`) + texto "Ayuda".
- Área táctil ≥ 44px (se garantiza con `padding` del pill).
- Al pulsar → `openRulesModal()`.
- Visibilidad: se muestra/oculta junto con el pill de perfil en `updateUserHeader()` (`js/main.js:3663`).

### 3. Contenido estático `reglas/UCL.html`

Convertir el contenido de `reglas/UCL.pdf` (6 páginas) a un fichero `reglas/UCL.html` con secciones numeradas:

| Sección | Contenido |
|---|---|
| 1. Fase de Liga | 36 equipos, 8 partidos (4 local/4 visitante), bombos, sorteo 27 ago 2026, 8 jornadas con fechas, puntos 3/1/0, criterios de desempate (10) |
| 2. Fase Final (Eliminatorias) | Play-off (puestos 9-24), octavos, cuartos, semis y final; fechas; equipos clasificados directos (puestos 1-8) |
| 3. Puntuación | Puntos por pronóstico de partido (8+3+3+1=15), puntos por posición pronosticada (60 al 1), puntos por fase alcanzada en la Fase Final (10/15/25/50/75/100, máx 575) |
| 4. Plantilla Ideal | 25 jugadores (3G, 8D, 8M, 6F), máx 1 por club, puntuación Sofascore, goles por demarcación, porteros (penaltis/goles), portería a cero |

- Fichero independiente servido estáticamente por Vercel junto al resto de `reglas/`.
- Estructura semántica con `id` por sección (`#fase-liga`, `#fase-final`, `#puntuacion`, `#plantilla`) para los chips de navegación.
- Tablas de puntuación con clases reutilizables (`.rules-table` etc.).

### 4. Modal "Reglas de la Porra"

En `index.html`, un modal tipo los existentes (`#phase-change-modal`):

```html
<div id="rules-modal" class="modal" style="display: none;">
  <div class="modal-overlay" onclick="closeRulesModal()"></div>
  <div class="modal-content rules-modal-content">
    <div class="modal-header">
      <div class="rules-title">🏆 Reglas de la Porra <span>Champions 2026/27</span></div>
      <button class="modal-close" onclick="closeRulesModal()">&times;</button>
    </div>
    <div class="rules-chips">
      <button class="rules-chip active" data-target="#fase-liga">⚽ Fase de Liga</button>
      <button class="rules-chip" data-target="#fase-final">🏆 Fase Final</button>
      <button class="rules-chip" data-target="#puntuacion">⭐ Puntuación</button>
      <button class="rules-chip" data-target="#plantilla">👥 Plantilla</button>
    </div>
    <div class="rules-body" id="rules-body"><!-- contenido inyectado --></div>
    <div class="rules-footer">
      <button class="rules-pdf-btn" onclick="window.open('reglas/UCL.pdf','_blank')">Abrir PDF original</button>
    </div>
  </div>
</div>
```

**Comportamiento:**
- `openRulesModal()`: muestra el modal y carga `reglas/UCL.html` con `fetch()` (si no está ya en caché); mientras carga muestra un spinner/placeholder.
- `closeRulesModal()`: oculta el modal.
- Chips: al pulsar, `scrollIntoView` de la sección; el chip activo se resalta y cambia con el scroll (opcional: con `IntersectionObserver`; mínimo viable: marcar activo al hacer clic).
- Cierre: botón ✕, pulsar fuera del modal (`modal-overlay`).
- **Responsive**: el contenido (`rules-body`) ocupa el alto disponible y hace scroll interno (`overflow-y: auto`), con `max-height` en función del viewport.

### 5. Funciones JavaScript (`js/main.js`)

| Función | Responsabilidad |
|---|---|
| `setupHelpClick()` | Listener del pill de ayuda → `openRulesModal()` |
| `openRulesModal()` | Muestra `#rules-modal`, carga e inyecta `reglas/UCL.html` en `#rules-body` (una sola vez, cacheado en `AppState.rulesHtml`), y activa el primer chip |
| `closeRulesModal()` | Oculta `#rules-modal` |
| `setupRulesChips()` | Listeners de los chips (scroll a sección) — se registran tras inyectar el HTML |

- `updateUserHeader()` (`js/main.js:3663`): mostrar/ocultar también `#user-help-pill` (mismo flag `AppState.currentUser`).
- `setupHeaderClick()` / init: registrar `setupHelpClick()` donde se registra `setupHeaderClick()`.

### 6. Estilos (`css/styles.css`)

Clases nuevas `.user-help-pill`, `.rules-modal-content`, `.rules-title`, `.rules-chips`, `.rules-chip` (+ `.active`), `.rules-body`, `.rules-footer`, `.rules-pdf-btn`, `.rules-table` y variantes de sección, reutilizando variables de `:root` (`--ucl-card`, `--border-color`, `--accent-cyan`, `--accent-primary`, `--accent-gold`, `--accent-green`, `--text-*`, `--radius-*`), consistente con el diseño oscuro glass existente. `.rules-body` con scroll interno y `max-height: calc(100dvh - 220px)` (alto de cabecera + chips + footer) para móvil vertical.

### 7. `index.html` — cache-busting

Incrementar la versión de `css/styles.css` y `js/main.js` (regla de AGENTS.md).

### 8. Limpieza

Eliminar `reglas/UCL.pdf:Zone.Identifier` (artefacto de Windows, no debe subirse a git/Vercel).

## Consideraciones

- **Carga del contenido**: `fetch('reglas/UCL.html')` con caché en `AppState.rulesHtml`; si el fetch falla (red/offline), mostrar mensaje de error con enlace directo al PDF.
- **Chips**: navegación por `scrollIntoView({ block: 'start' })`; el contenido largo mantiene el scroll dentro del modal.
- **Sin frameworks**: JS Vanilla ES6+ y CSS plano, como el resto del proyecto.
- **Movil vertical**: `max-width: 480px` del contenedor; el modal respeta `env(safe-area-inset-*)`.

## Verificación

- Manual: con sesión iniciada, el header muestra 🏆 y el pill "Ayuda" a la izquierda del perfil; al pulsarlo se abre el modal con las 4 secciones y sus chips; los chips saltan a cada sección; "Abrir PDF original" abre el PDF en pestaña nueva; sin sesión no aparece el pill.
- Sin errores en consola; estilos responsivos en móvil vertical.
- `reglas/UCL.html` abre en navegador con el contenido completo del PDF.
