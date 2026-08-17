# Plan: Slots rectangulares para Plantilla Ideal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar los slots de la plantilla ideal de cajas cuadradas a rectangulares horizontales para mostrar foto, nombre, escudo del equipo y nombre del equipo con más legibilidad.

**Architecture:** Cambios mínimos en 2 ficheros: CSS para el layout horizontal y JS para el HTML generado. Se mantiene toda la lógica existente (búsqueda, selección, persistencia, bloqueo por fase).

**Tech Stack:** CSS3 (Flexbox), JavaScript ES6+ vanilla, sin dependencias externas.

## Global Constraints

- Modo oscuro premium, variables CSS existentes en `:root`
- Mobile vertical first, contenedor max-width ~480px
- Mantener estética existente del proyecto
- Cache-busting: incrementar versiones en `index.html` al subir cambios

---

### Task 1: Modificar CSS - Layout grid y slot base

**Files:**
- Modify: `css/styles.css`

**Interfaces:**
- Consumes: Variables CSS existentes (`--ucl-surface`, `--accent-primary`, `--border-color`, etc.)
- Produces: Estilos `.squad-slots-grid`, `.squad-slot` modificados

- [ ] **Step 1: Cambiar `.squad-slots-grid` de grid a flex column**

En `css/styles.css`, buscar la regla `.squad-slots-grid` (línea ~1796) y reemplazar:

```css
/* ANTES */
.squad-slots-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

/* DESPUÉS */
.squad-slots-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

- [ ] **Step 2: Modificar `.squad-slot` para layout horizontal**

En `css/styles.css`, buscar la regla `.squad-slot` (línea ~1803) y reemplazar las propiedades de layout:

```css
/* ANTES */
.squad-slot {
  aspect-ratio: 1;
  border-radius: var(--radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 2px dashed var(--border-color);
  background: var(--ucl-surface);
  position: relative;
  min-height: 70px;
  min-width: 0;
}

/* DESPUÉS */
.squad-slot {
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
  transition: all var(--transition-fast);
  border: 2px dashed var(--border-color);
  background: var(--ucl-surface);
  position: relative;
  min-height: 60px;
  min-width: 0;
}
```

- [ ] **Step 3: Eliminar estilos obsoletos de slots**

Eliminar o comentar las siguientes reglas que ya no se usarán:
- `.squad-slot-plus` (línea ~1844)
- `.squad-slot-label` (línea ~1850)
- `.squad-slot-img` (línea ~1856)
- `.squad-slot-info` (línea ~1863)
- `.squad-slot-name` (línea ~1870)
- `.squad-slot-team` (línea ~1880)

- [ ] **Step 4: Añadir nuevos estilos para el contenido del slot**

Añadir después de `.squad-slot`:

```css
/* Foto del jugador */
.squad-slot-photo {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

/* Contenedor de detalles */
.squad-slot-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* Nombre del jugador */
.squad-slot-player-name {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Fila de equipo */
.squad-slot-team-info {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* Escudo del equipo */
.squad-slot-team-badge {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
}

/* Nombre del equipo */
.squad-slot-team-name {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Estado vacío - icono */
.squad-slot-empty-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px dashed var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* Estado vacío - texto */
.squad-slot-empty-text {
  font-size: 13px;
  color: var(--text-muted);
}

/* Estado vacío - hint */
.squad-slot-empty-hint {
  font-size: 11px;
  color: var(--text-muted);
  opacity: 0.6;
}
```

- [ ] **Step 5: Ajustar botón remove para centrado vertical**

Modificar `.squad-slot-remove` (línea ~1898):

```css
/* ANTES */
.squad-slot-remove {
  position: absolute;
  top: -6px;
  right: -6px;
  /* ... resto igual */
}

/* DESPUÉS */
.squad-slot-remove {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  /* ... resto igual */
}
```

- [ ] **Step 6: Commit**

```bash
git add css/styles.css
git commit -m "style: cambiar slots plantilla de cuadrados a rectangulares horizontales"
```

---

### Task 2: Modificar JavaScript - HTML generado en renderSquadSlots

**Files:**
- Modify: `js/main.js` (función `renderSquadSlots`, línea ~4402)

**Interfaces:**
- Consumes: `AppState.squadPicks`, `AppState.activeSlot`, `SQUAD_FORMATION`, `getSlotPlayer()`, `playerImgTag()`
- Produces: HTML con clases `.squad-slot`, `.squad-slot-photo`, `.squad-slot-details`, `.squad-slot-player-name`, `.squad-slot-team-info`, `.squad-slot-team-badge`, `.squad-slot-team-name`, `.squad-slot-empty-icon`, `.squad-slot-empty-text`, `.squad-slot-empty-hint`

- [ ] **Step 1: Modificar slot vacío en renderSquadSlots**

En `js/main.js`, dentro de `renderSquadSlots()`, buscar el bloque que genera slots vacíos y reemplazar:

```javascript
/* ANTES */
html += `<div class="squad-slot empty" data-position="${pos}" data-index="${i}">
  <div class="squad-slot-plus">+</div>
  <div class="squad-slot-label">Vacío</div>
</div>`;

/* DESPUÉS */
html += `<div class="squad-slot empty" data-position="${pos}" data-index="${i}">
  <div class="squad-slot-empty-icon">+</div>
  <div>
    <div class="squad-slot-empty-text">Vacío</div>
    <div class="squad-slot-empty-hint">Toca para buscar</div>
  </div>
</div>`;
```

- [ ] **Step 2: Modificar slot relleno en renderSquadSlots**

En `js/main.js`, dentro de `renderSquadSlots()`, buscar el bloque que genera slots rellenos y reemplazar:

```javascript
/* ANTES */
html += `<div class="squad-slot filled" data-position="${pos}" data-index="${i}">
  ${playerImgTag(player.id, player.extension, player.nombre, 'squad-slot-img')}
  <div class="squad-slot-info">
    <div class="squad-slot-name">${player.nombre}</div>
    <div class="squad-slot-team">${player.club}</div>
  </div>
  <button class="squad-slot-remove" data-position="${pos}" data-index="${i}">✕</button>
</div>`;

/* DESPUÉS */
// Obtener datos del equipo para el escudo
const teamData = AppState.teamsMap[player.equipo];
const teamExt = teamData?.ext || 'webp';
html += `<div class="squad-slot filled" data-position="${pos}" data-index="${i}">
  ${playerImgTag(player.id, player.extension, player.nombre, 'squad-slot-photo')}
  <div class="squad-slot-details">
    <div class="squad-slot-player-name">${player.nombre}</div>
    <div class="squad-slot-team-info">
      <img class="squad-slot-team-badge" src="data/imgEquipos/${player.equipo}.${teamExt}" alt="${player.club}">
      <span class="squad-slot-team-name">${player.club}</span>
    </div>
  </div>
  <button class="squad-slot-remove" data-position="${pos}" data-index="${i}">✕</button>
</div>`;
```

- [ ] **Step 3: Verificar que refreshSquadUI no necesita cambios**

La función `refreshSquadUI()` (línea ~4606) re-renderiza llamando a `renderSquadSlots()`, así que se actualiza automáticamente. No necesita cambios.

- [ ] **Step 4: Commit**

```bash
git add js/main.js
git commit -m "feat: slots plantilla muestran foto nombre escudo y equipo en layout horizontal"
```

---

### Task 3: Actualizar versiones en index.html (cache-busting)

**Files:**
- Modify: `index.html` (líneas de CSS y JS)

**Interfaces:**
- Consumes: N/A
- Produces: N/A

- [ ] **Step 1: Incrementar versión de CSS**

En `index.html`, buscar `<link rel="stylesheet" href="css/styles.css?v=X">` e incrementar el número de versión.

- [ ] **Step 2: Incrementar versión de JS**

En `index.html`, buscar `<script src="js/main.js?v=X"></script>` e incrementar el número de versión.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: bump CSS y JS versions para cache-busting"
```

---

### Task 4: Verificación visual

**Files:**
- N/A (verificación manual)

**Interfaces:**
- Consumes: Tareas 1-3 completadas
- Produces: Confirmación de que el diseño funciona correctamente

- [ ] **Step 1: Arrancar servidor local**

```bash
node server.mjs
```

- [ ] **Step 2: Verificar en navegador**

Abrir `http://localhost:3000` y navegar a la pestaña Plantilla:

1. Los 25 slots se muestran como rectangulares horizontales apilados verticalmente
2. Porteros (3): 3 slots apilados
3. Defensas (8): 8 slots apilados
4. Centrocampistas (8): 8 slots apilados
5. Delanteros (6): 6 slots apilados
6. Slot vacío muestra icono `+` a la izquierda, "Vacío" y "Toca para buscar" a la derecha
7. Slot relleno muestra foto circular, nombre del jugador, escudo del equipo y nombre del equipo
8. Botón ✕ rojo funciona para eliminar jugadores
9. Al tocar slot vacío se abre el panel de búsqueda
10. Estilos consistentes con el tema oscuro existente

- [ ] **Step 3: Commit final (si hay ajustes)**

Si se hacen ajustes menores de estilo, commitearlos.
