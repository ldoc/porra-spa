# Cajas de drop slots con ancho fijo y nombre en máx 3 líneas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fijar el ancho de las cajas de drop slots de la pantalla Pronósticos → Eliminatorias y mostrar el nombre del equipo en hasta 3 líneas, cortándolo con "…" si excede.

**Architecture:** Cambio 100% CSS en `css/styles.css`. Se elimina el `min-content` amplio que causa el blowout del grid (`repeat(2, minmax(0, 1fr))` + `min-width: 0` en `.drop-slot`) y se cambia el nombre de nowrap+ellipsis a wrap con `-webkit-line-clamp: 3`. Se eliminan las overrides read-only que quedan redundantes y se hace cache-busting.

**Tech Stack:** CSS3 vanilla, CSS Grid, `-webkit-line-clamp`.

## Global Constraints

- No hay lógica JS nueva: no se toca `js/main.js` ni `js/eliminatorias.js`.
- Cache-busting obligatorio (AGENTS.md) al tocar `css/styles.css`: `index.html:19` pasa de `css/styles.css?v=46` a `?v=47`.
- El podium (campeón/subcampeón, `.podium-slot` / `.podium-team-name`) NO se modifica (decisión de usuario).
- Los tests del repo son de lógica JS (Node) y no cubren CSS; no se añaden tests.
- Sin frameworks CSS externos; usar variables de `:root`.

---

### Task 1: Ancho fijo + nombre en máx 3 líneas en drop slots

**Files:**
- Modify: `css/styles.css:3881-3885` (`.drop-zone-slots`)
- Modify: `css/styles.css:3888-3900` (`.drop-slot`)
- Modify: `css/styles.css:3920-3932` (`.drop-slot-name`)
- Modify: `css/styles.css:4524-4536` (eliminar overrides read-only redundantes)
- Modify: `index.html:19` (cache-busting)

**Interfaces:**
- Consumes: clases existentes `.drop-zone-slots`, `.drop-slot`, `.drop-slot-name`, `.eliminatorias-view` (todas ya definidas en `css/styles.css`).
- Produces: no produce interfaces para otras tareas (tarea única).

- [ ] **Step 1: Fijar el ancho de las columnas del grid de slots**

En `css/styles.css:3881-3885`, cambiar el `grid-template-columns` de `.drop-zone-slots` de `1fr` a `minmax(0, 1fr)`:

```css
.drop-zone-slots {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}
```

Nota: `1fr` equivale a `minmax(auto, 1fr)`; `minmax(0, 1fr)` impide que el `min-content` de un nombre largo ensanche la columna.

- [ ] **Step 2: Proteger el grid item contra el blowout**

En `css/styles.css:3888-3900`, añadir `min-width: 0;` a `.drop-slot` (mantener el resto de propiedades tal cual):

```css
.drop-slot {
  aspect-ratio: 1;
  min-width: 0;
  background: var(--bg-input);
  border: 1.5px dashed rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  position: relative;
  min-height: 60px;
}
```

- [ ] **Step 3: Nombre en hasta 3 líneas con corte**

En `css/styles.css:3920-3932`, reemplazar las líneas `overflow: hidden;`, `text-overflow: ellipsis;` y `white-space: nowrap;` por el bloque de wrap + clamp. El resultado final de `.drop-slot-name` debe ser:

```css
.drop-slot-name {
  font-size: 8px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 3px;
  max-width: 100%;
  padding: 0 2px;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  line-height: 1.2;
}
```

- [ ] **Step 4: Eliminar overrides read-only redundantes**

En `css/styles.css:4524-4536`, eliminar los dos bloques completos que quedan duplicados por la base:

```css
/* Cajas fijas con nombre en varias líneas (vista read-only) */
.eliminatorias-view .drop-slot {
  min-width: 0;
}

.eliminatorias-view .drop-slot-name {
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}
```

Eliminar también el comentario `/* Cajas fijas con nombre en varias líneas (vista read-only) */` que los precede (4523). Las cuadrículas read-only `repeat(4, 1fr)` (`css/styles.css:4475-4500`) quedan protegidas por el `min-width: 0` de la base.

- [ ] **Step 5: Cache-busting**

En `index.html:19`, cambiar:

```html
<link rel="stylesheet" href="css/styles.css?v=46">
```

por:

```html
<link rel="stylesheet" href="css/styles.css?v=47">
```

NO tocar `js/main.js?v=` ni `js/eliminatorias.js?v=`.

- [ ] **Step 6: Verificar los cambios por lectura**

Run:
```bash
node -e "const c=require('fs').readFileSync('css/styles.css','utf8'); if(!c.includes('repeat(2, minmax(0, 1fr))')) throw new Error('grid minmax no presente'); if(!c.match(/.drop-slot \{[\s\S]*?min-width: 0;/)) throw new Error('min-width no presente'); if(!c.includes('-webkit-line-clamp: 3')) throw new Error('clamp no presente'); if(c.includes('.eliminatorias-view .drop-slot-name')) throw new Error('override read-only no eliminada'); console.log('CSS OK')"
```
Expected: `CSS OK`

Run:
```bash
grep -n "styles.css?v" index.html
```
Expected: `css/styles.css?v=47` (una sola línea).

Run (para confirmar que no se tocó JS):
```bash
git diff --stat js/
```
Expected: sin salida (ningún fichero JS modificado).

- [ ] **Step 7: Verificación visual manual (usuario)**

Abrir la app en el navegador, entrar en Pronósticos → Eliminatorias y colocar un equipo de nombre largo (el más largo del torneo es "Royale Union Saint-Gilloise", 27 caracteres, según `data/teams.json`). Comprobar:
1. La caja del drop slot tiene el mismo ancho que el resto de cajas de su fila, independientemente del nombre.
2. El nombre se muestra en hasta 3 líneas centrado dentro de la caja.
3. Si el nombre excede 3 líneas, se corta con "…".
4. El podium (campeón/subcampeón) no ha cambiado.
5. La vista read-only de eliminatorias (Resultados → Eliminatorias y perfil) sigue mostrando los nombres igual que antes.

- [ ] **Step 8: Commit**

```bash
git add css/styles.css index.html
git commit -m "fix: cajas de drop slots con ancho fijo y nombre en máx 3 líneas"
```
