# Design: Rediseño del Tab Plantilla en Clasificación

**Fecha:** 2026-08-17
**Estado:** Aprobado

## Contexto

El tab "Plantilla" en el modal de perfil de usuario (Clasificación) muestra actualmente los 25 jugadores de la plantilla ideal en una grilla de 3 columnas con tarjetas cuadradas (foto, nombre, club, puntos). El usuario quiere que este tab tenga un diseño más parecido a los slots horizontales que acabamos de implementar en la pantalla de selección de plantilla, con los puntos mostrados en un badge con fondo de color a la derecha.

## Objetivo

Rediseñar el tab Plantilla para usar tarjetas horizontales con:
- Foto del jugador (40px circular)
- Nombre del jugador (13px bold)
- Escudo del equipo (18px) + nombre del equipo (12px muted)
- Badge de puntos con fondo semitransparente a la derecha

## Diseño

### Estructura por jugador

```
┌──────────────────────────────────────────────┐
│ [foto 40px]  Nombre del Jugador    [14 pts]  │
│              ⚽ Equipo del jugador           │
└──────────────────────────────────────────────┘
```

### Layout por posición

```
PORTEROS
┌──────────────────────────────────────────────┐
│ [foto] Thibaut Courtois            [14 pts]  │
│        ⚽ Real Madrid                        │
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ [foto] Manuel Neuer                [14 pts]  │
│        ⚽ Bayern München                     │
└──────────────────────────────────────────────┘

DEFENSAS
┌──────────────────────────────────────────────┐
│ [foto] Virgil van Dijk             [12 pts]  │
│        ⚽ Liverpool FC                       │
└──────────────────────────────────────────────┘
...
```

### Cambios en CSS (`css/styles.css`)

| Selector | Cambio | Descripción |
|----------|--------|-------------|
| `.profile-squad-grid` | Modificar | Cambiar de `grid 3 cols` a `flex column; gap: 6px` |
| `.profile-squad-card` | Modificar | Cambiar de layout vertical centrado a horizontal: `display: flex; align-items: center; gap: 10px; padding: 8px 10px` |
| `.profile-squad-img` | Modificar | Mantener tamaño 40px circular |
| `.profile-squad-name` | Modificar | Cambiar font-size a 13px, ajustar alineación |
| `.profile-squad-club` | Modificar | Reemplazar por `.profile-squad-team-info` con layout flex row |
| `.profile-squad-pts` | Eliminar | Reemplazar por `.profile-squad-badge` |
| `.profile-squad-badge` | **Nuevo** | Badge con fondo semitransparente: `background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; padding: 4px 10px; font-size: 13px; font-weight: 700; color: var(--accent-primary)` |
| `.profile-squad-team-info` | **Nuevo** | Flex row para escudo + nombre: `display: flex; align-items: center; gap: 6px` |
| `.profile-squad-team-badge` | **Nuevo** | Imagen del escudo: `width: 18px; height: 18px; border-radius: 50%; object-fit: cover` |
| `.profile-squad-team-name` | **Nuevo** | Nombre del equipo: `font-size: 12px; color: var(--text-muted)` |

### Cambios en JS (`js/main.js`)

| Función | Cambio | Línea aprox. |
|---------|--------|--------------|
| `renderSquadTab()` | Modificar HTML generado | ~1260 |

**HTML actual (por jugador):**
```html
<div class="profile-squad-card" onclick="...">
  <img class="profile-squad-img" src="..." alt="..." loading="lazy">
  <div class="profile-squad-name">Nombre</div>
  <div class="profile-squad-club">Equipo</div>
  <div class="profile-squad-pts">14 pts</div>
</div>
```

**HTML nuevo (por jugador):**
```html
<div class="profile-squad-card" onclick="...">
  <img class="profile-squad-img" src="..." alt="..." loading="lazy">
  <div class="profile-squad-details">
    <div class="profile-squad-name">Nombre</div>
    <div class="profile-squad-team-info">
      <img class="profile-squad-team-badge" src="data/imgEquipos/{id}.{ext}" alt="Equipo">
      <span class="profile-squad-team-name">Equipo</span>
    </div>
  </div>
  <div class="profile-squad-badge">14 pts</div>
</div>
```

### Datos requeridos

- `AppState.teamsMap[player.equipo]` para obtener `ext` del escudo del equipo
- `player.equipo` (team ID) para la ruta de la imagen del escudo

### No se toca

- `calculateSquadPoints()` — lógica de cálculo de puntos
- `showPlayerPointsBreakdown()` — modal de desglose por partido
- `calculatePlayerMatchPoints()` — cálculo por jugador por partido
- Flujo de datos y persistencia

## Restricciones

- Modo oscuro, variables CSS existentes en `:root`
- Mobile vertical first, contenedor max-width ~480px
- Mantener estética existente del proyecto
- Cache-busting: incrementar versiones en `index.html`
