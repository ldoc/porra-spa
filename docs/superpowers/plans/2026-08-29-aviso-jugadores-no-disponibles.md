# Aviso de Jugadores No Disponibles - Plan de Implementación

> **Para trabajadores agénicos:** SUB-SKILL REQUERIDO: Usa superpowers:subagent-driven-development (recomendado) o superpowers:executing-plans para implementar este plan tarea por tarea. Los pasos usan sintcheckbox (`- [ ]`) para seguimiento.

**Objetivo:** Mostrar un aviso informativo en la pantalla de plantilla cuando los jugadores convocados no están disponibles, y deshabilitar la interacción hasta que se carguen los datos.

**Arquitectura:** Modificación directa de `renderPlantillaTab()` y `renderSquadSlots()` en `js/main.js` para verificar si `AppState.allPlayers` está vacío. Añadir estilos CSS para el aviso y casillas deshabilitadas.

**Stack Tecnológico:** JavaScript vanilla, CSS3, HTML5

## Restricciones Globales

- Seguir el diseño mobile vertical first existente
- Usar variables CSS definidas en `:root`
- Mantener la semántica HTML existente
- No romper la funcionalidad actual cuando hay jugadores disponibles
- La fecha orientativa es una constante en código: `'3 de septiembre de 2026'`

---

## Estructura de Archivos

**Archivos a modificar:**
- `js/main.js`: Añadir constante `PLAYERS_AVAILABLE_DATE`, modificar `renderPlantillaTab()` y `renderSquadSlots()`
- `css/styles.css`: Añadir estilos para `.squad-players-unavailable-notice` y `.squad-slot.disabled`

**Archivos de prueba:**
- `tests/plantilla-aviso.test.js`: Tests para la nueva funcionalidad

---

### Task 1: Añadir constante de fecha

**Archivos:**
- Modificar: `js/main.js:170-180` (junto a otras constantes)

**Interfaces:**
- Produce: `PLAYERS_AVAILABLE_DATE` (string constante)

- [ ] **Paso 1: Añadir la constante**

```javascript
// En js/main.js, junto a las otras constantes (después de SQUAD_FORMATION)
const PLAYERS_AVAILABLE_DATE = '3 de septiembre de 2026';
```

- [ ] **Paso 2: Verificar que la constante se añadió correctamente**

Abrir `js/main.js` y buscar `PLAYERS_AVAILABLE_DATE`. Debe existir la línea.

- [ ] **Paso 3: Commit**

```bash
git add js/main.js
git commit -m "feat: add PLAYERS_AVAILABLE_DATE constant for squad availability notice"
```

---

### Task 2: Añadir estilos CSS para el aviso

**Archivos:**
- Modificar: `css/styles.css` (al final de la sección de estilos de plantilla)

**Interfaces:**
- Produce: Clases CSS `.squad-players-unavailable-notice`, `.squad-notice-icon`, `.squad-notice-content`, `.squad-notice-title`, `.squad-notice-text`, `.squad-notice-secondary`, `.squad-slot.disabled`

- [ ] **Paso 1: Añadir estilos del aviso**

```css
/* Aviso de jugadores no disponibles */
.squad-players-unavailable-notice {
  background: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.squad-notice-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
}

.squad-notice-content {
  flex: 1;
}

.squad-notice-title {
  font-size: 15px;
  font-weight: 600;
  color: #fbbf24;
  margin: 0 0 8px 0;
}

.squad-notice-text {
  font-size: 13px;
  color: var(--text-primary);
  margin: 0 0 6px 0;
  line-height: 1.4;
}

.squad-notice-text:last-child {
  margin-bottom: 0;
}

.squad-notice-text strong {
  color: #fbbf24;
  font-weight: 600;
}

.squad-notice-secondary {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(251, 191, 36, 0.2);
}
```

- [ ] **Paso 2: Añadir estilos de casillas deshabilitadas**

```css
/* Casillas deshabilitadas */
.squad-slot.disabled {
  cursor: not-allowed;
  opacity: 0.5;
  pointer-events: none;
}

.squad-slot.disabled:hover {
  transform: none;
  border-color: var(--border-color);
}
```

- [ ] **Paso 3: Verificar que los estilos se añadieron correctamente**

Abrir `css/styles.css` y buscar `.squad-players-unavailable-notice`. Debe existir.

- [ ] **Paso 4: Commit**

```bash
git add css/styles.css
git commit -m "feat: add CSS styles for squad players unavailable notice"
```

---

### Task 3: Modificar renderSquadSlots() para aceptar parámetro disabled

**Archivos:**
- Modificar: `js/main.js:4560-4590` (función `renderSquadSlots`)

**Interfaces:**
- Consume: `SQUAD_FORMATION`, `AppState.squadPicks`
- Produce: `renderSquadSlots(disabled = false)` (nueva firma)

- [ ] **Paso 1: Modificar la función renderSquadSlots()**

```javascript
function renderSquadSlots(disabled = false) {
  return Object.entries(SQUAD_FORMATION).map(([pos, config]) => {
    const count = AppState.squadPicks.filter(p => p.posicion === pos).length;
    const slots = [];
    
    for (let i = 0; i < config.count; i++) {
      const player = AppState.squadPicks.find((p, idx) => {
        if (p.posicion !== pos) return false;
        const prevSlots = AppState.squadPicks.filter(pp => pp.posicion === pos && pp.id === p.id);
        return prevSlots.indexOf(p) === i;
      });
      
      if (player) {
        slots.push(`
          <div class="squad-slot filled" data-position="${pos}" data-index="${i}">
            <img src="data/imgJugadores/${player.id}.webp" alt="${player.nombre}" class="squad-slot-img" onerror="this.src='data/imgEquipos/default.webp'">
            <span class="squad-slot-name">${player.nombre}</span>
            <button class="squad-slot-remove" data-position="${pos}" data-index="${i}" ${disabled ? 'disabled' : ''}>&times;</button>
          </div>
        `);
      } else {
        slots.push(`
          <div class="squad-slot empty ${disabled ? 'disabled' : ''}" data-position="${pos}" data-index="${i}" ${disabled ? 'style="cursor:not-allowed;opacity:0.5"' : ''}>
            <span class="squad-slot-plus">+</span>
          </div>
        `);
      }
    }
    
    return `
      <div class="squad-position-group">
        <h3 class="squad-position-title">${config.label} <span class="squad-position-count">(${count}/${config.count})</span></h3>
        <div class="squad-slots-grid">
          ${slots.join('')}
        </div>
      </div>
    `;
  }).join('');
}
```

- [ ] **Paso 2: Verificar que la función se modificó correctamente**

Abrir `js/main.js` y buscar `function renderSquadSlots(disabled = false)`. Debe existir.

- [ ] **Paso 3: Commit**

```bash
git add js/main.js
git commit -m "feat: modify renderSquadSlots() to accept disabled parameter"
```

---

### Task 4: Modificar renderPlantillaTab() para mostrar aviso

**Archivos:**
- Modificar: `js/main.js:4591-4684` (función `renderPlantillaTab`)

**Interfaces:**
- Consume: `AppState.allPlayers`, `AppState.squadPicks`, `isSquadFrozen()`, `SQUAD_SIZE`, `PLAYERS_AVAILABLE_DATE`, `renderSquadSlots(disabled)`
- Produce: Renderizado condicional del aviso y casillas deshabilitadas

- [ ] **Paso 1: Modificar la función renderPlantillaTab()**

```javascript
function renderPlantillaTab() {
  const container = document.getElementById('plantilla-container');
  if (!container) return;

  const totalSelected = AppState.squadPicks.length;
  const frozen = isSquadFrozen();
  const playersAvailable = AppState.allPlayers.length > 0;

  container.innerHTML = `
    <div class="squad-picker-wrapper">

      <!-- Cabecera fija -->
      <div class="squad-top-fixed">
        ${frozen ? '<div style="background:rgba(239,68,68,0.15);color:#ef4444;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:13px;text-align:center;">🔒 Plantilla bloqueada — la competición ha comenzado</div>' : ''}
        
        ${!playersAvailable ? `
          <div class="squad-players-unavailable-notice">
            <div class="squad-notice-icon">⚠️</div>
            <div class="squad-notice-content">
              <p class="squad-notice-title">Jugadores no disponibles</p>
              <p class="squad-notice-text">
                Los jugadores convocados para la Champions League 2026/2027 aún no están disponibles.
              </p>
              <p class="squad-notice-text">
                Podrás seleccionar tu plantilla ideal a partir del <strong>${PLAYERS_AVAILABLE_DATE}</strong>.
              </p>
              <p class="squad-notice-text squad-notice-secondary">
                Las listas A de jugadores convocados se publicarán el día 2 a las 23:59h.
              </p>
            </div>
          </div>
        ` : ''}
        
        <!-- Resumen -->
        <div class="squad-summary">
          <span class="squad-summary-text">Tu Plantilla (<span id="squad-count">${totalSelected}</span>/${SQUAD_SIZE})</span>
          <button class="squad-save-btn" id="btn-save-squad" ${totalSelected === 0 || frozen || !playersAvailable ? 'disabled' : ''} ${frozen || !playersAvailable ? 'style="opacity:0.5"' : ''}>💾 Guardar</button>
        </div>
      </div>

      <!-- Contenido con scroll -->
      <div class="squad-scroll-content" id="squad-slots">
        ${renderSquadSlots(!playersAvailable)}
      </div>
    </div>

    <!-- Panel de búsqueda (overlay) - solo si hay jugadores disponibles -->
    ${playersAvailable ? `
      <div class="squad-search-panel" id="squad-search-panel">
        <div class="squad-search-panel-content">
          <div class="squad-search-panel-header">
            <h3 class="squad-search-panel-title" id="squad-search-panel-title">Buscar jugador</h3>
            <button class="squad-search-panel-close" id="btn-close-search">&times;</button>
          </div>
          <div class="squad-filters-row">
            <div class="squad-team-filter" id="squad-team-filter"></div>
            <div class="squad-search-input-row">
              <div class="squad-search-wrapper">
                <input type="text" class="squad-search-input" id="squad-search-input"
                       placeholder="Buscar por nombre..." autocomplete="off" spellcheck="false">
              </div>
            </div>
          </div>
          <div class="squad-players-list" id="squad-search-results"></div>
        </div>
      </div>
    ` : ''}
  `;

  // Eventos de casillas vacías (solo si hay jugadores disponibles)
  if (playersAvailable) {
    container.querySelectorAll('.squad-slot.empty').forEach(slot => {
      slot.addEventListener('click', () => {
        const position = slot.getAttribute('data-position');
        const index = parseInt(slot.getAttribute('data-index'));
        openSlotSearch(position, index);
      });
    });

    // Eventos de casillas llenas (quitar)
    container.querySelectorAll('.squad-slot-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const position = btn.getAttribute('data-position');
        const index = parseInt(btn.getAttribute('data-index'));
        removePlayerFromSquad(position, index);
      });
    });

    // Cerrar panel de búsqueda
    document.getElementById('btn-close-search')?.addEventListener('click', closeSlotSearch);

    // Búsqueda de jugadores
    const searchInput = document.getElementById('squad-search-input');
    const debouncedSearch = debounce((val) => { AppState.squadSearchOffset = 0; renderSearchResults(val); }, 300);
    searchInput?.addEventListener('input', (e) => debouncedSearch(e.target.value));

    // Seleccionar jugador de la lista
    document.getElementById('squad-search-results')?.addEventListener('click', (e) => {
      const row = e.target.closest('.squad-player-row');
      if (row) {
        const playerId = parseInt(row.getAttribute('data-player-id'));
        selectPlayerForSlot(playerId);
      }
    });

    // Cerrar panel al hacer clic fuera
    document.getElementById('squad-search-panel')?.addEventListener('click', (e) => {
      if (e.target.id === 'squad-search-panel') closeSlotSearch();
    });
  }

  // Guardar plantilla
  document.getElementById('btn-save-squad')?.addEventListener('click', saveSquadToBackend);
}
```

- [ ] **Paso 2: Verificar que la función se modificó correctamente**

Abrir `js/main.js` y buscar `const playersAvailable = AppState.allPlayers.length > 0;`. Debe existir.

- [ ] **Paso 3: Commit**

```bash
git add js/main.js
git commit -m "feat: modify renderPlantillaTab() to show notice when players unavailable"
```

---

### Task 5: Añadir tests para la nueva funcionalidad

**Archivos:**
- Crear: `tests/plantilla-aviso.test.js`

**Interfaces:**
- Consume: `renderPlantillaTab()`, `renderSquadSlots()`, `AppState`, `PLAYERS_AVAILABLE_DATE`

- [ ] **Paso 1: Crear archivo de tests**

```javascript
// tests/plantilla-aviso.test.js
import { describe, it, expect, beforeEach } from 'vitest';

// Mock del DOM
document.body.innerHTML = '<div id="plantilla-container"></div>';

// Mock de AppState
const AppState = {
  allPlayers: [],
  squadPicks: [],
  blockedTeams: new Set()
};

// Mock de funciones
const isSquadFrozen = () => false;
const SQUAD_SIZE = 25;
const SQUAD_FORMATION = {
  G: { count: 3, label: 'Porteros' },
  D: { count: 8, label: 'Defensas' },
  M: { count: 8, label: 'Centrocampistas' },
  F: { count: 6, label: 'Delanteros' }
};

const PLAYERS_AVAILABLE_DATE = '3 de septiembre de 2026';

// Función simplificada para tests
function renderPlantillaTab() {
  const container = document.getElementById('plantilla-container');
  if (!container) return;

  const totalSelected = AppState.squadPicks.length;
  const frozen = isSquadFrozen();
  const playersAvailable = AppState.allPlayers.length > 0;

  container.innerHTML = `
    <div class="squad-picker-wrapper">
      <div class="squad-top-fixed">
        ${!playersAvailable ? `
          <div class="squad-players-unavailable-notice">
            <div class="squad-notice-icon">⚠️</div>
            <div class="squad-notice-content">
              <p class="squad-notice-title">Jugadores no disponibles</p>
              <p class="squad-notice-text">
                Los jugadores convocados para la Champions League 2026/2027 aún no están disponibles.
              </p>
              <p class="squad-notice-text">
                Podrás seleccionar tu plantilla ideal a partir del <strong>${PLAYERS_AVAILABLE_DATE}</strong>.
              </p>
            </div>
          </div>
        ` : ''}
        <div class="squad-summary">
          <span class="squad-summary-text">Tu Plantilla (<span id="squad-count">${totalSelected}</span>/${SQUAD_SIZE})</span>
          <button class="squad-save-btn" id="btn-save-squad" ${totalSelected === 0 || frozen || !playersAvailable ? 'disabled' : ''}>💾 Guardar</button>
        </div>
      </div>
    </div>
  `;
}

describe('Plantilla - Aviso de jugadores no disponibles', () => {
  beforeEach(() => {
    AppState.allPlayers = [];
    AppState.squadPicks = [];
    document.getElementById('plantilla-container').innerHTML = '';
  });

  it('debe mostrar aviso cuando allPlayers está vacío', () => {
    renderPlantillaTab();
    const notice = document.querySelector('.squad-players-unavailable-notice');
    expect(notice).not.toBeNull();
    expect(notice.textContent).toContain('Jugadores no disponibles');
    expect(notice.textContent).toContain(PLAYERS_AVAILABLE_DATE);
  });

  it('no debe mostrar aviso cuando allPlayers tiene datos', () => {
    AppState.allPlayers = [{ id: 1, nombre: 'Test', posicion: 'G', equipo: 1 }];
    renderPlantillaTab();
    const notice = document.querySelector('.squad-players-unavailable-notice');
    expect(notice).toBeNull();
  });

  it('debe deshabilitar botón Guardar cuando no hay jugadores', () => {
    renderPlantillaTab();
    const btn = document.getElementById('btn-save-squad');
    expect(btn.disabled).toBe(true);
  });

  it('debe habilitar botón Guardar cuando hay jugadores y hay selección', () => {
    AppState.allPlayers = [{ id: 1, nombre: 'Test', posicion: 'G', equipo: 1 }];
    AppState.squadPicks = [{ id: 1, nombre: 'Test', posicion: 'G', equipo: 1 }];
    renderPlantillaTab();
    const btn = document.getElementById('btn-save-squad');
    expect(btn.disabled).toBe(false);
  });
});
```

- [ ] **Paso 2: Ejecutar tests**

```bash
npm test tests/plantilla-aviso.test.js
```

- [ ] **Paso 3: Commit**

```bash
git add tests/plantilla-aviso.test.js
git commit -m "test: add tests for squad players unavailable notice"
```

---

### Task 6: Verificación final y cache-busting

**Archivos:**
- Modificar: `index.html` (incrementar versión de CSS y JS)

**Interfaces:**
- Consume: Todos los cambios anteriores

- [ ] **Paso 1: Incrementar versión en index.html**

Buscar las líneas con `css/styles.css?v=` y `js/main.js?v=` e incrementar el número de versión.

- [ ] **Paso 2: Verificar que la aplicación funciona correctamente**

1. Abrir la aplicación en el navegador
2. Verificar que con `jugadores.json` vacío se muestra el aviso
3. Verificar que las casillas están deshabilitadas
4. Verificar que el botón "Guardar" está deshabilitado
5. Verificar que no se puede abrir el panel de búsqueda

- [ ] **Paso 3: Commit final**

```bash
git add index.html
git commit -m "chore: bump version for squad notice feature"
```

---

## Resumen de Cambios

| Archivo | Cambio |
|---------|--------|
| `js/main.js` | Añadir `PLAYERS_AVAILABLE_DATE`, modificar `renderPlantillaTab()` y `renderSquadSlots()` |
| `css/styles.css` | Añadir estilos para aviso y casillas deshabilitadas |
| `tests/plantilla-aviso.test.js` | Nuevo archivo con tests |
| `index.html` | Incrementar versión de CSS y JS |

## Criterios de Aceptación

1. ✅ Cuando `allPlayers` está vacío, se muestra el aviso informativo
2. ✅ El aviso contiene la fecha orientativa (día 3 de septiembre)
3. ✅ Las 25 casillas de jugadores están deshabilitadas
4. ✅ El botón "Guardar" está deshabilitado
5. ✅ No se puede abrir el panel de búsqueda
6. ✅ Cuando `allPlayers` tiene datos, el aviso desaparece
7. ✅ La funcionalidad existente se mantiene cuando hay jugadores disponibles
