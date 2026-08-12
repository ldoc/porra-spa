# Diseño: Acordeón de jornadas en tab Pronósticos (Clasificación)

**Fecha:** 2026-08-12
**Estado:** Aprobado

## Objetivo

Mejorar la navegación entre jornadas en el modal de perfil (pantalla Clasificación → tab Pronósticos) convirtiendo las secciones de jornada en un acordeón desplegable.

## Contexto actual

- El modal de perfil se abre al pulsar un usuario en la clasificación (`showUserProfileModal`).
- El tab Pronósticos (`renderPredictionsTab`, `js/main.js:1019`) agrupa los partidos por jornada usando el objeto `matchesByJourney` y renderiza todas las secciones expandidas con la clase `.breakdown-journey` (`css/styles.css:2265`).
- Los puntos por partido están en `userData.matchDetails[].points`. Los pendientes tienen `points: 0` y `breakdown: ['Pendiente']`.
- No hay ningún estado global que controle el plegado.

## Enfoque elegido

**Enfoque A — Acordeón renderizado con estado en AppState** (aprobado por el usuario).

## Arquitectura y componentes

### Estado (`AppState`)

Nueva propiedad:

```javascript
openProfileJourney: null, // string: nombre de la jornada desplegada en el modal de perfil
```

Reglas:
- Solo una jornada abierta a la vez.
- Se recalcula al renderizar el tab (no persiste entre usuarios).

### Función pura: cálculo de jornada relevante

Nueva función extraída como pura para facilitar testing:

```javascript
function getRelevantJourney(matchesByJourney, hasResult) 
```

- Recibe el mapa `matchesByJourney` y un predicado `hasResult(match)` (true si el partido tiene matchStats).
- Devuelve la **última jornada que tenga al menos un partido con resultado**.
- Si ninguna jornada tiene resultados, devuelve la **última jornada presente**.
- Devuelve `null` si no hay jornadas.

### Renderizado (`renderPredictionsTab`)

- Se conserva la construcción de `matchesByJourney` (partidos con resultado + pendientes).
- Al inicio de cada render se asigna `AppState.openProfileJourney = getRelevantJourney(...)`. Así el estado inicial es siempre la jornada relevante del usuario mostrado, y al cambiar de usuario se recalcula automáticamente. Los cambios manuales (toggle) solo actualizan clases hasta el siguiente render del tab.
- Cada jornada genera:
  - **Cabecera clicable**:
    ```html
    <div class="breakdown-journey-header ${abierto ? 'active' : ''}" data-journey="Jornada X">
      <span class="breakdown-journey-title">Jornada X</span>
      <span class="breakdown-journey-points">XX pts</span>
      <span class="breakdown-journey-arrow">▸</span>
    </div>
    ```
  - **Cuerpo** con los `.profile-match` actuales:
    ```html
    <div class="breakdown-journey-body ${abierto ? 'accordion-open' : 'accordion-closed'}">
      ...match cards...
    </div>
    ```
- **Puntos por jornada**: suma de `points` de los `matchDetails` de esa jornada. Los pendientes aportan 0.
- Cuando no hay jornadas, se mantiene el mensaje actual "No hay pronósticos para mostrar".

### Interacción (delegación de eventos)

- Al hacer click en una cabecera (`[data-journey]`):
  - Si la jornada está abierta → `AppState.openProfileJourney = null` (plegar).
  - Si está cerrada → `AppState.openProfileJourney = journey` (abrir y cerrar las demás).
- Actualización solo de clases (sin re-render completo): se recorren las cabeceras/cuerpos del contenedor y se aplican/eliminan `active` / `accordion-open` / `accordion-closed`.
- La delegación se registra en el contenedor del tab de contenido (`#profile-tab-content`) con un solo listener.

## CSS

Nuevas clases en `css/styles.css` junto a `.breakdown-journey`:

| Clase | Propósito |
|---|---|
| `.breakdown-journey-header` | Cabecera clicable: flex row, área táctil mínima 44px, cursor pointer, transición de fondo/color. |
| `.breakdown-journey-header.active` | Estado abierto (p. ej. fondo suave + flecha rotada). |
| `.breakdown-journey-title` | Reutiliza el estilo actual de título (accent-cyan, uppercase). |
| `.breakdown-journey-points` | Contador de puntos de la jornada (text-muted). |
| `.breakdown-journey-arrow` | Flecha ▸ con rotación 90º cuando la cabecera tiene `.active`. |
| `.breakdown-journey-body` | `overflow:hidden` + transición de `max-height`. |
| `.accordion-closed` | `max-height: 0`. |
| `.accordion-open` | `max-height: <suficiente>` (p. ej. 2000px). |

Se reutilizan las variables CSS existentes (colores, radios, tipografía, `var(--transition-fast)`).

## Datos / flujo

- **Sin cambios de backend.**
- Todo se deriva de datos ya cargados: `userData`, `AppState.matchStats`, `AppState.matches`.

## Casos límite

| Caso | Comportamiento |
|---|---|
| Sin jornadas | Mensaje "No hay pronósticos para mostrar" (sin acordeón). |
| Una sola jornada | Acordeón con una cabecera, desplegada. |
| Ninguna jornada con resultados | Se despliega la última jornada presente. |
| Cambiar de usuario en el modal | `openProfileJourney` se recalcula (última con resultados del nuevo usuario). |
| Cabecera con datos pendientes | Los pendientes cuentan puntos 0 y muestran "⏳ Pendiente" dentro del cuerpo. |

## Testing

- Test unitario (node, sin DOM) para `getRelevantJourney`:
  - Última jornada con resultados.
  - Ninguna con resultados → última presente.
  - Sin jornadas → null.
- Verificación manual en navegador de la interacción del acordeón (abrir/cerrar, una abierta a la vez, estado inicial, transición).
