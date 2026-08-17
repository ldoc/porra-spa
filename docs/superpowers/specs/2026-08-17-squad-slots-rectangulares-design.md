# Diseño: Slots rectangulares para Plantilla Ideal

**Fecha:** 2026-08-17
**Objetivo:** Rediseñar los slots de la plantilla ideal de cajas cuadradas a rectangulares horizontales para mostrar foto del jugador, nombre, escudo del equipo y nombre del equipo con más legibilidad.

## Problema actual

Los slots actuales son cuadrados (`aspect-ratio: 1`) en un grid de 4 columnas. Cada slot solo muestra:
- Foto circular (36px)
- Nombre truncado (9px)
- Nombre corto del equipo (7px)

No hay espacio para el escudo del equipo y el texto es demasiado pequeño.

## Solución: Opción A aprobada

Cambiar a cajas rectangulares horizontales que ocupan todo el ancho, manteniendo la estética existente del proyecto.

### Slot vacío

```
┌──────────────────────────────────────────────┐
│  ┌──────────┐                                │
│  │    +     │  Vacío                         │
│  │          │  Toca para buscar              │
│  └──────────┘                                │
└──────────────────────────────────────────────┘
```

- Borde dashed `var(--border-color)`
- Fondo `var(--ucl-surface)`
- Icono `+` a la izquierda, texto a la derecha
- Altura fija ~60px

### Slot relleno

```
┌──────────────────────────────────────────────┐
│  ┌──────┐  ┌─────────────────────┐     ┌──┐ │
│  │ 📸   │  │ Nombre Jugador      │  ⚽ │✕ │ │
│  │ foto │  │ Escudo Equipo Nombre│     └──┘ │
│  └──────┘  └─────────────────────┘           │
└──────────────────────────────────────────────┘
```

- Borde solid `var(--accent-primary)` (verde)
- Fondo `rgba(16, 185, 129, 0.1)`
- Foto circular (40px) a la izquierda
- Nombre del jugador (13px, bold) + escudo del equipo (18px) con nombre del equipo (11px)
- Botón ✕ (rojo) a la derecha, alineado verticalmente
- Altura fija ~60px

## Cambios necesarios

### 1. CSS (`css/styles.css`)

**`.squad-slots-grid`** — Cambiar de grid 4 columnas a 1 columna:
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

**`.squad-slot`** — Cambiar de cuadrado a horizontal:
```css
/* ANTES */
.squad-slot {
  aspect-ratio: 1;
  /* ... */
}

/* DESPUÉS */
.squad-slot {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  min-height: 60px;
  /* quitar aspect-ratio: 1 */
}
```

**Eliminar** (ya no aplica):
- `.squad-slot-plus` (se reemplaza por布局 inline)
- `.squad-slot-label` (se reemplaza)
- `.squad-slot-img` (se reemplaza)
- `.squad-slot-info` (se reemplaza)
- `.squad-slot-name` (se reemplaza)
- `.squad-slot-team` (se reemplaza)

**Añadir** nuevos estilos para el layout horizontal:
```css
.squad-slot-photo {
  width: 40px; height: 40px;
  border-radius: 50%; object-fit: cover;
  border: 1px solid var(--border-color);
  flex-shrink: 0;
}

.squad-slot-details {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 2px;
}

.squad-slot-player-name {
  font-size: 13px; font-weight: 700;
  white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis;
}

.squad-slot-team-info {
  display: flex; align-items: center; gap: 6px;
}

.squad-slot-team-badge {
  width: 18px; height: 18px;
  border-radius: 50%; object-fit: cover;
}

.squad-slot-team-name {
  font-size: 11px; color: var(--text-muted);
  white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis;
}
```

**Estado vacío** (nuevos estilos):
```css
.squad-slot-empty-icon {
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 2px dashed var(--border-color);
  display: flex; align-items: center; justify-content: center;
  font-size: 1.2rem; color: var(--text-muted);
  flex-shrink: 0;
}

.squad-slot-empty-text {
  font-size: 13px; color: var(--text-muted);
}

.squad-slot-empty-hint {
  font-size: 11px; color: var(--text-muted);
  opacity: 0.6;
}
```

**Botón remove** — mantener `.squad-slot-remove` existente, ajustar posición:
```css
.squad-slot-remove {
  position: absolute; top: 50%; right: 8px;
  transform: translateY(-50%);
  /* el resto igual */
}
```

### 2. JavaScript (`js/main.js`)

**`renderSquadSlots()`** — Cambiar el HTML generado para cada slot:

**Slot vacío:**
```html
<div class="squad-slot empty" data-position="G" data-index="0">
  <div class="squad-slot-empty-icon">+</div>
  <div>
    <div class="squad-slot-empty-text">Vacío</div>
    <div class="squad-slot-empty-hint">Toca para buscar</div>
  </div>
</div>
```

**Slot relleno:**
```html
<div class="squad-slot filled" data-position="G" data-index="0">
  <img class="squad-slot-photo" src="data/imgJugadores/{id}.{ext}" alt="Nombre">
  <div class="squad-slot-details">
    <div class="squad-slot-player-name">Nombre Jugador</div>
    <div class="squad-slot-team-info">
      <img class="squad-slot-team-badge" src="data/imgEquipos/{teamId}.{teamExt}" alt="Equipo">
      <span class="squad-slot-team-name">Nombre del Equipo</span>
    </div>
  </div>
  <button class="squad-slot-remove" data-position="G" data-index="0">✕</button>
</div>
```

**`refreshSquadUI()`** — Actualizar selectores si es necesario.

### 3. No se toca

- Panel de búsqueda (search panel) — sin cambios
- Lógica de selección/eliminación de jugadores — sin cambios
- Persistencia (localStorage + backend) — sin cambios
- Bloqueo por fase (`isSquadFrozen`) — sin cambios
- Contadores de posición — sin cambios
- Filtros de búsqueda — sin cambios

## Ficheros a modificar

| Fichero | Cambios |
|---------|---------|
| `css/styles.css` | Modificar `.squad-slots-grid`, `.squad-slot`, eliminar estilos obsoletos, añadir nuevos |
| `js/main.js` | Modificar `renderSquadSlots()` para generar nuevo HTML |

## Verificación

1. Visual: Los 25 slots se muestran como rectangulares horizontales
2. Porteros (3): 3 slots apilados verticalmente
3. Defensas (8): 8 slots apilados
4. Centrocampistas (8): 8 slots apilados
5. Delanteros (6): 6 slots apilados
6. Slot vacío muestra `+`, "Vacío", "Toca para buscar"
7. Slot relleno muestra foto, nombre, escudo del equipo, nombre del equipo
8. Botón ✕ funciona para eliminar jugadores
9. Panel de búsqueda se abre al tocar slot vacío
10. Estilos consistentes con el tema oscuro existente
