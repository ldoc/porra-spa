# Rediseño Tab Plantilla en Clasificación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rediseñar el tab "Plantilla" en el modal de perfil de usuario (Clasificación) para usar tarjetas horizontales con foto, nombre, escudo equipo, nombre equipo y badge de puntos a la derecha.

**Architecture:** Cambios mínimos en CSS (redefinir layout de `.profile-squad-grid` y `.profile-squad-card`, añadir clases para badge y equipo) y JS (modificar `renderSquadTab()` para generar HTML horizontal con escudo del equipo). No se toca la lógica de cálculo de puntos.

**Tech Stack:** CSS3 vanilla (variables `:root`), JavaScript ES6+ vanilla, sin dependencias externas.

## Global Constraints

- Modo oscuro premium, variables CSS existentes en `:root`
- Mobile vertical first, contenedor max-width ~480px
- Mantener estética existente del proyecto
- Cache-busting: incrementar versiones en `index.html` al subir cambios

---

## File Structure

| Archivo | Responsabilidad |
|---------|-----------------|
| `css/styles.css` | Modificar estilos de `.profile-squad-*`, añadir nuevas clases |
| `js/main.js` | Modificar `renderSquadTab()` (~línea 1215) para generar HTML horizontal |
| `index.html` | Cache-busting: incrementar versión de `styles.css` y `main.js` |

---

### Task 1: Modificar CSS — Estilos del tab Plantilla

**Files:**
- Modify: `css/styles.css:2795-2857`

**Interfaces:**
- Consumes: Variables CSS existentes en `:root` (`--ucl-surface`, `--accent-primary`, `--border-color`, `--text-muted`, `--text-primary`, `--radius-sm`, `--radius-full`)
- Produces: Clases CSS `.profile-squad-grid`, `.profile-squad-card`, `.profile-squad-img`, `.profile-squad-name`, `.profile-squad-details`, `.profile-squad-team-info`, `.profile-squad-team-badge`, `.profile-squad-team-name`, `.profile-squad-badge`

- [ ] **Step 1: Modificar `.profile-squad-grid`**

Cambiar de `display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;` a:

```css
.profile-squad-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

- [ ] **Step 2: Modificar `.profile-squad-card`**

Cambiar de layout vertical centrado a horizontal:

```css
.profile-squad-card {
  background: var(--ucl-surface);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
```

- [ ] **Step 3: Modificar `.profile-squad-img`**

Cambiar tamaño de 48px a 40px:

```css
.profile-squad-img {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  object-fit: cover;
  background: var(--ucl-card);
  flex-shrink: 0;
}
```

- [ ] **Step 4: Eliminar `.profile-squad-club` y `.profile-squad-pts`**

Eliminar这两条规则 (líneas ~2844-2857).

- [ ] **Step 5: Añadir `.profile-squad-details`**

```css
.profile-squad-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
```

- [ ] **Step 6: Modificar `.profile-squad-name`**

Cambiar font-size de 11px a 13px:

```css
.profile-squad-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 7: Añadir `.profile-squad-team-info`**

```css
.profile-squad-team-info {
  display: flex;
  align-items: center;
  gap: 6px;
}
```

- [ ] **Step 8: Añadir `.profile-squad-team-badge`**

```css
.profile-squad-team-badge {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  object-fit: cover;
}
```

- [ ] **Step 9: Añadir `.profile-squad-team-name`**

```css
.profile-squad-team-name {
  font-size: 12px;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

- [ ] **Step 10: Añadir `.profile-squad-badge`**

```css
.profile-squad-badge {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent-primary);
  white-space: nowrap;
  flex-shrink: 0;
}
```

- [ ] **Step 11: Commit**

```bash
git add css/styles.css
git commit -m "style: rediseñar tab plantilla clasificacion a tarjetas horizontales"
```

---

### Task 2: Modificar JavaScript — HTML generado en renderSquadTab

**Files:**
- Modify: `js/main.js:1260-1280`

**Interfaces:**
- Consumes: Clases CSS creadas en Task 1, `AppState.teamsMap`, `playerImgTag()`
- Produce: HTML horizontal para cada jugador con foto, nombre, escudo equipo, nombre equipo y badge de puntos

- [ ] **Step 1: Modificar la sección de renderizado de jugador**

En `renderSquadTab()`, buscar el bloque que genera el HTML de cada jugador (línea ~1270) y reemplazar:

**HTML actual:**
```javascript
html += `
  <div class="profile-squad-card" onclick="showPlayerPointsBreakdown(AppState.currentSquadDetails[${idx}])" style="cursor:pointer">
    <img class="profile-squad-img" src="data/imgJugadores/${p.id}.${p.extension || 'png'}" alt="${p.nombre}" loading="lazy">
    <div class="profile-squad-name">${p.nombre}</div>
    <div class="profile-squad-club">${p.club}</div>
    <div class="profile-squad-pts">${pts} pts</div>
  </div>
`;
```

**HTML nuevo:**
```javascript
const teamData = AppState.teamsMap[p.equipo];
const teamExt = teamData?.ext || 'webp';
html += `
  <div class="profile-squad-card" onclick="showPlayerPointsBreakdown(AppState.currentSquadDetails[${idx}])" style="cursor:pointer">
    <img class="profile-squad-img" src="data/imgJugadores/${p.id}.${p.extension || 'png'}" alt="${p.nombre}" loading="lazy">
    <div class="profile-squad-details">
      <div class="profile-squad-name">${p.nombre}</div>
      <div class="profile-squad-team-info">
        <img class="profile-squad-team-badge" src="data/imgEquipos/${p.equipo}.${teamExt}" alt="${p.club}">
        <span class="profile-squad-team-name">${p.club}</span>
      </div>
    </div>
    <div class="profile-squad-badge">${pts} pts</div>
  </div>
`;
```

- [ ] **Step 2: Commit**

```bash
git add js/main.js
git commit -m "feat: tab plantilla clasificacion muestra foto nombre escudo y badge puntos"
```

---

### Task 3: Cache-busting en index.html

**Files:**
- Modify: `index.html:19` (styles.css), `index.html:20` (main.js)

**Interfaces:**
- Consumes: Nada (tarea autónoma)
- Produce: Versiones incrementadas para forzar descarga de archivos actualizados

- [ ] **Step 1: Incrementar versión de styles.css**

Cambiar `styles.css?v=73` a `styles.css?v=74`

- [ ] **Step 2: Incrementar versión de main.js**

Cambiar `main.js?v=106` a `main.js?v=107`

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: bump CSS y JS versions para cache-busting"
```

---

### Task 4: Verificación visual

**Files:**
- Sin cambios en archivos

**Interfaces:**
- Consumes: Cambios de Tasks 1-3
- Produce: Confirmación de que el tab se ve correctamente

- [ ] **Step 1: Verificar que no hay errores en consola**

Abrir la app en el navegador, ir a Clasificación, pulsar en un usuario, cambiar al tab Plantilla. Verificar que no hay errores en la consola del navegador.

- [ ] **Step 2: Verificar layout horizontal**

Comprobar que cada jugador se muestra en una fila horizontal con:
- Foto circular a la izquierda (40px)
- Nombre del jugador (13px bold)
- Escudo del equipo (18px) + nombre del equipo (12px muted)
- Badge de puntos con fondo verde a la derecha

- [ ] **Step 3: Verificar interacción**

Pulsar en un jugador y verificar que se abre el modal de desglose de puntos correctamente.

- [ ] **Step 4: Verificar en móvil**

Abrir en un dispositivo móvil o emulador y verificar que el layout es responsive y no se desborda.
