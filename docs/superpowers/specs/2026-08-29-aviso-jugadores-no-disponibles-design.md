# Diseño: Aviso de Jugadores No Disponibles en Pantalla de Plantilla

**Fecha**: 29 de agosto de 2026  
**Autor**: Sistema de Diseño  
**Estado**: Aprobado  

---

## 1. Descripción del Problema

Actualmente, cuando el archivo `data/jugadores.json` está vacío o no se ha cargado, la pantalla de plantilla muestra las 25 casillas vacías sin ningún indicador de que los jugadores aún no están disponibles. Los usuarios pueden intentar interactuar con las casillas sin éxito, lo que genera confusión.

**Contexto**: Las listas A de jugadores convocados para la Champions League 2026/2027 se publicarán el día 2 de septiembre a las 23:59h. Hasta entonces, el archivo `jugadores.json` estará vacío. Los usuarios deben ser informados de que no podrán seleccionar su plantilla ideal hasta el día 3 de septiembre.

---

## 2. Objetivos

1. **Informar al usuario** de que los jugadores convocados aún no están disponibles
2. **Mostrar la fecha orientativa** (día 3 de septiembre) cuando podrán seleccionar su plantilla
3. **Deshabilitar la interacción** con las casillas de jugadores cuando no hay datos disponibles
4. **Ocultar automáticamente el aviso** cuando los jugadores estén disponibles (cuando `jugadores.json` tenga datos)

---

## 3. Diseño de la Interfaz (UI)

### 3.1. Estado: Jugadores No Disponibles

```
┌─────────────────────────────────────────┐
│         PLANTILLA IDEAL                 │
├─────────────────────────────────────────┤
│  ⚠️ AVISO IMPORTANTE                    │
│                                         │
│  Los jugadores convocados para la       │
│  Champions League 2026/2027 aún no      │
│  están disponibles.                     │
│                                         │
│  Podrás seleccionar tu plantilla ideal  │
│  a partir del 3 de septiembre de 2026.  │
│                                         │
│  Las listas A de jugadores convocados   │
│  se publicarán el día 2 a las 23:59h.   │
├─────────────────────────────────────────┤
│  Tu Plantilla (0/25)    [💾 Guardar]    │
├─────────────────────────────────────────┤
│  PORTEROS (0/3)                         │
│  ┌─────┐ ┌─────┐ ┌─────┐              │
│  │  +  │ │  +  │ │  +  │  (deshab.)   │
│  └─────┘ └─────┘ └─────┘              │
├─────────────────────────────────────────┤
│  DEFENSAS (0/8)                         │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │  +  │ │  +  │ │  +  │ │  +  │     │
│  └─────┘ └─────┘ └─────┘ └─────┘     │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐     │
│  │  +  │ │  +  │ │  +  │ │  +  │     │
│  └─────┘ └─────┘ └─────┘ └─────┘     │
├─────────────────────────────────────────┤
│  CENTROCAMPISTAS (0/8)                  │
│  ... (8 casillas deshabilitadas)        │
├─────────────────────────────────────────┤
│  DELANTEROS (0/6)                       │
│  ... (6 casillas deshabilitadas)        │
└─────────────────────────────────────────┘
```

### 3.2. Características del Aviso

- **Fondo**: `rgba(251, 191, 36, 0.15)` (ámbar suave)
- **Borde**: `1px solid rgba(251, 191, 36, 0.3)`
- **Icono**: ⚠️
- **Título**: "Jugadores no disponibles" en color ámbar (#fbbf24)
- **Texto principal**: Blanco con fecha en negrita
- **Texto secundario**: Color muted, separado por línea horizontal

### 3.3. Casillas Deshabilitadas

- **Cursor**: `not-allowed`
- **Opacidad**: 0.5
- **Sin hover effect**: No se resaltan al pasar el ratón
- **Sin eventos de clic**: No abren el panel de búsqueda

### 3.4. Botón "Guardar"

- **Deshabilitado** cuando no hay jugadores disponibles
- **Opacidad**: 0.5
- **Sin efecto al hacer clic**

---

## 4. Lógica de Implementación

### 4.1. Constante

```javascript
const PLAYERS_AVAILABLE_DATE = '3 de septiembre de 2026';
```

### 4.2. Modificación en `renderPlantillaTab()`

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
        <!-- ... contenido del panel de búsqueda ... -->
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

### 4.3. Modificación en `renderSquadSlots()`

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

---

## 5. Estilos CSS

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

---

## 6. Pruebas

### 6.1. Escenarios a Probar

1. **Con `jugadores.json` vacío (o sin cargar)**:
   - Mostrar aviso informativo
   - Casillas vacías deshabilitadas
   - Botón "Guardar" deshabilitado
   - No se puede abrir panel de búsqueda

2. **Con `jugadores.json` con datos**:
   - No mostrar aviso
   - Casillas funcionales (como ahora)
   - Botón "Guardar" habilitado (si hay jugadores seleccionados)
   - Panel de búsqueda funcional

3. **Transición de vacío a lleno**:
   - Si se recarga la página y ahora hay jugadores, el aviso desaparece

### 6.2. Tests a Añadir

- Verificar que `renderPlantillaTab()` muestra el aviso cuando `allPlayers.length === 0`
- Verificar que las casillas están deshabilitadas cuando no hay jugadores
- Verificar que el botón "Guardar" está deshabilitado

---

## 7. Dependencias

- **Ninguna dependencia externa**: La funcionalidad usa solo lógica existente
- **Sin cambios en el backend**: Todo se maneja en el frontend
- **Sin cambios en la carga de datos**: Se usa `AppState.allPlayers` existente

---

## 8. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| El usuario no ve el aviso | El aviso está en la parte superior de la pantalla, visible sin scroll |
| La fecha es incorrecta | La fecha es una constante fácil de actualizar si cambia |
| El aviso no desaparece cuando hay jugadores | La verificación es directa: `allPlayers.length > 0` |
| Las casillas no se deshabilitan correctamente | Se usa la clase `disabled` y se deshabilitan eventos |

---

## 9. Criterios de Aceptación

1. ✅ Cuando `allPlayers` está vacío, se muestra el aviso informativo
2. ✅ El aviso contiene la fecha orientativa (día 3 de septiembre)
3. ✅ Las 25 casillas de jugadores están deshabilitadas
4. ✅ El botón "Guardar" está deshabilitado
5. ✅ No se puede abrir el panel de búsqueda
6. ✅ Cuando `allPlayers` tiene datos, el aviso desaparece
7. ✅ La funcionalidad existente se mantiene cuando hay jugadores disponibles

---

## 10. Implementación Futura

- **Configuración por admin**: Si se desea, la fecha puede moverse a `appConfig` para que el admin la cambie
- **Notificación push**: En el futuro, se podría enviar una notificación cuando los jugadores estén disponibles
- **Contador regresivo**: Se podría añadir un contador regresivo hasta la fecha de disponibilidad
