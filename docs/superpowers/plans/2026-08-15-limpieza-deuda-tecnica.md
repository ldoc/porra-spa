# Limpieza de deuda técnica (código muerto y legacy) — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el código muerto y legacy detectado en la auditoría: `points`/`hits` fantasma en `/api/players`, endpoint `GET /usuario`, `codes.json`/`validCodes`, `renderLeaderboard()`, fallback de escudos roto (`default.png`), y 86 fotos huérfanas.

**Architecture:** Cambios quirúrgicos en dos repos: api-porra (backend: simplificar `getAllPlayers()` y eliminar el endpoint legacy) y porra-spa (frontend: eliminar `codes.json` y `renderLeaderboard`, crear `default.webp` como fallback real, borrar fotos huérfanas). Ningún consumidor externo de la API (solo porra-spa).

**Tech Stack:** Node.js (ES Modules), `http` nativo, sharp (solo para generar la imagen placeholder), tests autocontenidos en Node (`node tests/*.test.js`).

## Global Constraints

- El único consumidor de la API es porra-spa; ningún script externo depende de los campos/endpoints eliminados.
- No tocar la lógica de cálculo de puntos del frontend (`calculateUserTotalPoints`, `calculateClassificationPoints`, `calculateRealStandings`).
- No eliminar ninguna función que siga en uso; solo lo indicado en cada tarea.
- Verificación estática con `node --check` en los JS modificados de ambos repos.
- Tests de porra-spa: se ejecutan con `node tests/<archivo>.test.js` (no hay package.json ni runner central). Todos deben seguir pasando.
- Convención: ES Modules en api-porra, IIFE/module en porra-spa.

---

### Task 1: api-porra — simplificar `getAllPlayers()` y `/api/players`

**Files:**
- Modify: `api-porra/api/auth.js:134-142`
- Modify: `api-porra/server.js:606-623`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `getAllPlayers()` devuelve `[{ name, avatar }]`; `/api/players` responde siempre `{ ok: true, players: [{ name, avatar }] }`.

- [ ] **Step 1: Simplificar `getAllPlayers()` en `api/auth.js`**

Reemplazar el cuerpo de `getAllPlayers`:

```js
export async function getAllPlayers() {
  const users = await User.find({}, 'username avatar');
  return users.map(user => ({
    name: user.username,
    avatar: user.avatar || null,
  }));
}
```

- [ ] **Step 2: Simplificar el endpoint `/api/players` en `server.js`**

Reemplazar el bloque completo del endpoint (`server.js:606-623`) por:

```js
  if (reqUrl.pathname === '/api/players' && req.method === 'GET') {
    const phaseCheck = await checkPhaseConsistency(req, res);
    if (!phaseCheck) return;
    const players = await getAllPlayers();
    sendJson(req, res, 200, { ok: true, players }, 300);
    return;
  }
```

- [ ] **Step 3: Verificar sintaxis**

Run: `cd /home/ldoc/Proyectos/api-porra && node --check api/auth.js && node --check server.js`
Expected: sin errores (exit 0).

- [ ] **Step 4: Commit**

```bash
cd /home/ldoc/Proyectos/api-porra
git add api/auth.js server.js
git commit -m "refactor: /api/players devuelve solo name y avatar (points/hits eran siempre 0)"
```

---

### Task 2: api-porra — eliminar endpoint legacy `GET /usuario`

**Files:**
- Modify: `api-porra/server.js:1101-1124` (bloque `if (reqUrl.pathname === '/usuario')`)
- Modify: `api-porra/server.js:1129-1131` (campo `usuario:` en la respuesta por defecto)

**Interfaces:**
- Consumes: nada.
- Produces: el endpoint `/usuario` deja de existir; la respuesta por defecto de `GET /` ya no lista `usuario`.

- [ ] **Step 1: Eliminar el bloque de `/usuario` en `server.js`**

Borrar el bloque completo que empieza en `// Endpoint para obtener un usuario por su clave` y termina antes de `// Respuesta por defecto`:

```js
  // Endpoint para obtener un usuario por su clave
  if (reqUrl.pathname === '/usuario') {
    const clave = reqUrl.searchParams.get('clave');
    if (!clave) {
      sendJson(req, res, 400, {
        status: 'error',
        message: 'Debe proporcionar una clave de usuario.'
      });
      return;
    }

    const usuario = await User.findOne({ clave: clave }, '-passwordHash -__v');
    if (!usuario) {
      sendJson(req, res, 404, {
        status: 'error',
        message: 'Usuario no encontrado.'
      });
      return;
    }

    sendJson(req, res, 200, usuario);
    return;
  }
```

- [ ] **Step 2: Quitar la referencia en la respuesta por defecto**

En el objeto `endpoints` de la respuesta por defecto (`server.js:1130`), eliminar la línea:

```js
      usuario: '/usuario?clave=xxxx',
```

- [ ] **Step 3: Verificar sintaxis**

Run: `cd /home/ldoc/Proyectos/api-porra && node --check server.js`
Expected: sin errores (exit 0).

- [ ] **Step 4: Commit**

```bash
cd /home/ldoc/Proyectos/api-porra
git add server.js
git commit -m "refactor: eliminar endpoint legacy GET /usuario (sin consumidores)"
```

---

### Task 3: api-porra — actualizar AGENTS.md tras los cambios de backend

**Files:**
- Modify: `api-porra/AGENTS.md`

**Interfaces:**
- Consumes: cambios de Task 1 y Task 2.
- Produces: AGENTS.md coherente con el código.

- [ ] **Step 1: Actualizar tabla "Legacy"**

En la sección `### Legacy (compatibilidad)` (líneas ~103-108), eliminar la fila de `GET /usuario`:

```markdown
### Legacy (compatibilidad)

| Método | Ruta | Descripción                                    |
|--------|------|------------------------------------------------|
| GET    | `/`  | Info del servidor y lista de endpoints         |
```

- [ ] **Step 2: Actualizar "Respuesta Players"**

Reemplazar el bloque `### Respuesta Players` (incluida la nota sobre points/hits) por:

````markdown
### Respuesta Players

```json
// GET /api/players
// Solo nombre y avatar. Los puntos reales se calculan en el frontend
// con GET /api/predictions/all + GET /api/match-stats.
{
  "ok": true,
  "players": [
    { "name": "usuario1", "avatar": "⚽" },
    { "name": "usuario2", "avatar": "🏆" }
  ]
}
```
````

- [ ] **Step 3: Actualizar "Notas Importantes"**

Eliminar la línea de "Notas Importantes" que dice:

```markdown
- El endpoint legacy `/usuario?clave=X` se mantiene por compatibilidad (la SPA no lo usa). Candidato a eliminación si no se necesita.
```

- [ ] **Step 4: Commit**

```bash
cd /home/ldoc/Proyectos/api-porra
git add AGENTS.md
git commit -m "docs: actualizar AGENTS.md (eliminar /usuario y points/hits de /api/players)"
```

---

### Task 4: porra-spa — crear `data/imgEquipos/default.webp` (placeholder de recurso faltante)

**Files:**
- Create: `porra-spa/data/imgEquipos/default.webp`

**Interfaces:**
- Consumes: sharp disponible en `api-porra/node_modules`.
- Produces: imagen webp 128x128 que muestre claramente un recurso faltante (fondo oscuro, símbolo "?" y texto).

- [ ] **Step 1: Generar la imagen con sharp**

Ejecutar desde el directorio de api-porra (donde está sharp instalado), creando el fichero en porra-spa:

```bash
cd /home/ldoc/Proyectos/api-porra
node -e "
const sharp = require('sharp');
const W = 128, H = 128;
const svg = \`
<svg width=\"\${W}\" height=\"\${H}\" xmlns=\"http://www.w3.org/2000/svg\">
  <rect width=\"100%\" height=\"100%\" fill=\"#1E293B\"/>
  <rect x=\"4\" y=\"4\" width=\"\${W-8}\" height=\"\${H-8}\" fill=\"none\" stroke=\"#EF4444\" stroke-width=\"4\" stroke-dasharray=\"8 6\"/>
  <text x=\"50%\" y=\"48%\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"52\" font-weight=\"bold\" fill=\"#EF4444\">?</text>
  <text x=\"50%\" y=\"78%\" text-anchor=\"middle\" font-family=\"sans-serif\" font-size=\"15\" fill=\"#94A3B8\">FALTA</text>
</svg>\`;
sharp(Buffer.from(svg)).resize(W, H).webp({ quality: 90 }).toFile('/home/ldoc/Proyectos/porra-spa/data/imgEquipos/default.webp').then(() => console.log('default.webp creado')).catch(e => { console.error(e); process.exit(1); });
"
```

- [ ] **Step 2: Verificar que el fichero existe**

Run: `ls -la /home/ldoc/Proyectos/porra-spa/data/imgEquipos/default.webp`
Expected: fichero presente.

- [ ] **Step 3: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add data/imgEquipos/default.webp
git commit -m "feat: placeholder default.webp para escudos faltantes"
```

---

### Task 5: porra-spa — apuntar los fallbacks de escudo a `default.webp`

**Files:**
- Modify: `porra-spa/js/main.js` (5 ocurrencias de `data/imgEquipos/default.png`)

**Interfaces:**
- Consumes: `default.webp` creado en Task 4.
- Produces: los `onerror` usan `data/imgEquipos/default.webp`.

- [ ] **Step 1: Reemplazar las 5 referencias `default.png` → `default.webp`**

Ejecutar:

```bash
cd /home/ldoc/Proyectos/porra-spa
sed -i "s|data/imgEquipos/default\.png|data/imgEquipos/default.webp|g" js/main.js
```

- [ ] **Step 2: Verificar que no queda ninguna referencia a default.png**

Run: `grep -n "default.png" js/main.js`
Expected: sin resultados (exit 1 de grep).

- [ ] **Step 3: Verificar sintaxis**

Run: `cd /home/ldoc/Proyectos/porra-spa && node --check js/main.js`
Expected: sin errores (exit 0).

- [ ] **Step 4: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add js/main.js
git commit -m "fix: fallback de escudos apunta a default.webp (default.png no existía)"
```

---

### Task 6: porra-spa — eliminar `codes.json` y `AppState.validCodes`

**Files:**
- Delete: `porra-spa/data/codes.json`
- Modify: `porra-spa/js/main.js:17` (declaración `validCodes`)
- Modify: `porra-spa/js/main.js:259-270` (`loadInitialData`)

**Interfaces:**
- Consumes: nada.
- Produces: `AppState.validCodes` deja de existir; `loadInitialData()` ya no carga `data/codes.json`.

- [ ] **Step 1: Eliminar `data/codes.json`**

```bash
rm /home/ldoc/Proyectos/porra-spa/data/codes.json
```

- [ ] **Step 2: Quitar `validCodes` de la declaración de `AppState`**

En `main.js:17`, eliminar la línea:

```js
  validCodes: [],
```

- [ ] **Step 3: Quitar la carga de codes.json en `loadInitialData()`**

En `main.js:259-270`, cambiar el `Promise.all` y eliminar la asignación de `AppState.validCodes`:

```js
    const [calendarRes, jugadoresRes, teamsRes, fasesRes] = await Promise.all([
      fetch('data/calendar.json').catch(() => null),
      fetch('data/jugadores.json').catch(() => null),
      fetch('data/teams.json').catch(() => null),
      fetch('data/fases.json').catch(() => null),
    ]);
```

(Quitar las líneas de `codesRes` y el bloque `// Codigos de acceso` con el fallback `[{ code: 'UCL2026', ... }]`.)

- [ ] **Step 4: Verificar que no quedan referencias**

Run: `grep -rn "validCodes\|codes.json" /home/ldoc/Proyectos/porra-spa/js /home/ldoc/Proyectos/porra-spa/index.html`
Expected: sin resultados (exit 1 de grep).

- [ ] **Step 5: Verificar sintaxis**

Run: `cd /home/ldoc/Proyectos/porra-spa && node --check js/main.js`
Expected: sin errores (exit 0).

- [ ] **Step 6: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add -A js/main.js data/codes.json
git commit -m "refactor: eliminar codes.json y AppState.validCodes (no usados en el registro)"
```

---

### Task 7: porra-spa — eliminar `points`/`hits` fantasma y `renderLeaderboard()`

**Files:**
- Modify: `porra-spa/js/main.js:3300-3316` (`fetchPlayers`)
- Modify: `porra-spa/js/main.js:4420-4454` (`renderLeaderboard`)

**Interfaces:**
- Consumes: cambios de Task 1 (backend ya no envía points/hits).
- Produces: `fetchPlayers()` solo carga `AppState.players`; `renderLeaderboard()` deja de existir.

- [ ] **Step 1: Simplificar `fetchPlayers()`**

En `main.js:3300-3316`, reemplazar el cuerpo para no tocar `AppState.currentUser.points/hits`:

```js
async function fetchPlayers() {
  try {
    const res = await fetchWithPhase(`${API_BASE}/api/players?t=${Date.now()}`);
    const data = await res.json();
    if (data.ok) {
      AppState.players = data.players || [];
    }
  } catch (e) {
    AppState.players = [];
  }
}
```

- [ ] **Step 2: Eliminar `renderLeaderboard()`**

Borrar la función completa `renderLeaderboard()` (`main.js:4420-4454`), desde `function renderLeaderboard() {` hasta la llave de cierre correspondiente (incluye el `all.sort(...)`, `if (!all.length)`, etc.).

- [ ] **Step 3: Verificar que no quedan referencias**

Run: `grep -rn "renderLeaderboard\|leaderboard-container" /home/ldoc/Proyectos/porra-spa/js /home/ldoc/Proyectos/porra-spa/index.html`
Expected: sin resultados (exit 1 de grep).

- [ ] **Step 4: Verificar sintaxis**

Run: `cd /home/ldoc/Proyectos/porra-spa && node --check js/main.js`
Expected: sin errores (exit 0).

- [ ] **Step 5: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add js/main.js
git commit -m "refactor: eliminar points/hits fantasma de fetchPlayers y renderLeaderboard (código muerto)"
```

---

### Task 8: porra-spa — borrar fotos huérfanas de `imgJugadores/`

**Files:**
- Delete: 86 ficheros de `porra-spa/data/imgJugadores/` sin entrada en `jugadores.json`

**Interfaces:**
- Consumes: `data/jugadores.json` como lista de ids válidos.
- Produces: `imgJugadores/` contiene exactamente 1 134 ficheros (1 por jugador).

- [ ] **Step 1: Listar y borrar las huérfanas**

```bash
cd /home/ldoc/Proyectos/porra-spa
node -e "
const fs = require('fs');
const j = JSON.parse(fs.readFileSync('data/jugadores.json', 'utf8'));
const arr = Array.isArray(j) ? j : Object.values(j);
const valid = new Set(arr.map(x => String(x.id)));
const dir = 'data/imgJugadores';
let removed = 0;
for (const f of fs.readdirSync(dir)) {
  const id = f.replace(/\.[a-z]+$/, '');
  if (!valid.has(id)) { fs.unlinkSync(dir + '/' + f); removed++; console.log('borrada', f); }
}
console.log('Total borradas:', removed);
if (removed !== 86) { console.error('ATENCIÓN: se esperaban 86, se borraron ' + removed); process.exit(1); }
"
```

- [ ] **Step 2: Verificar el conteo final**

Run: `ls /home/ldoc/Proyectos/porra-spa/data/imgJugadores | wc -l`
Expected: `1134`

- [ ] **Step 3: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add -A data/imgJugadores
git commit -m "chore: borrar 86 fotos huérfanas de imgJugadores (sin jugador en jugadores.json)"
```

---

### Task 9: porra-spa — actualizar AGENTS.md y data/README.md

**Files:**
- Modify: `porra-spa/AGENTS.md`
- Modify: `porra-spa/data/README.md`

**Interfaces:**
- Consumes: cambios de Tasks 4-8.
- Produces: docs coherentes.

- [ ] **Step 1: AGENTS.md — estructura de directorios**

En la estructura de directorios (`data/`), eliminar la línea:

```text
│   ├── codes.json    # Códigos de acceso (LEGACY: los reales se gestionan en el backend/MongoDB)
```

Y en `imgEquipos/`, añadir la nota de `default.webp`:

```text
│   ├── imgEquipos/   # Escudos de equipos ({id}.webp, + default.webp como placeholder)
```

- [ ] **Step 2: AGENTS.md — tabla de modelos de datos (5.2)**

En la tabla `| Fichero | Registros | Uso en la app |`:
- Eliminar la nota LEGACY de `codes.json` y cualquier fila que lo liste.
- Cambiar `| imgJugadores/ | 1 220 | Fotos de jugadores en WEBP, nombradas {id}.webp (86 fotos sin jugador asociado) |` → `| imgJugadores/ | 1 134 | Fotos de jugadores en WEBP, nombradas {id}.webp |`
- Añadir fila `| imgEquipos/default.webp | 1 | Placeholder para escudos faltantes |` (opcional dentro de imgEquipos).

- [ ] **Step 3: AGENTS.md — tabla de AppState**

Eliminar la fila:

```text
| `validCodes` | array | Códigos de acceso (LEGACY, no usado; se cargan de `data/codes.json` pero la validación real es del backend) |
```

- [ ] **Step 4: data/README.md — resumen**

- Eliminar la fila `| codes.json | 3 | Códigos de acceso (LEGACY, no usado) |`.
- Cambiar `| imgJugadores/ | 1 220 | Fotos de jugadores ({id}.webp) |` → `| imgJugadores/ | 1 134 | Fotos de jugadores ({id}.webp) |`.

- [ ] **Step 5: data/README.md — sección de imágenes**

En la sección `## Imágenes — imgJugadores/ e imgEquipos/`, eliminar la frase:

```text
Hay 86 fotos de jugadores sin entrada asociada en `jugadores.json` (huérfanas).
```

Y añadir mención de `default.webp`:

```text
`imgEquipos/default.webp` es un placeholder que se muestra cuando falta un escudo.
```

- [ ] **Step 6: Commit**

```bash
cd /home/ldoc/Proyectos/porra-spa
git add AGENTS.md data/README.md
git commit -m "docs: actualizar AGENTS.md y data/README.md tras la limpieza"
```

---

### Task 10: Verificación final integrada

**Files:**
- Ninguno (solo verificación).

**Interfaces:**
- Consumes: todo lo anterior.

- [ ] **Step 1: Verificar sintaxis de todos los JS modificados**

Run:
```bash
cd /home/ldoc/Proyectos/api-porra && node --check api/auth.js && node --check server.js
cd /home/ldoc/Proyectos/porra-spa && node --check js/main.js
```
Expected: sin errores (exit 0).

- [ ] **Step 2: Ejecutar todos los tests de porra-spa**

Run:
```bash
cd /home/ldoc/Proyectos/porra-spa
for f in tests/*.test.js; do echo "=== $f ==="; node "$f" || exit 1; done
```
Expected: todos los tests pasan (exit 0 en el bucle).

- [ ] **Step 3: Verificar ausencia de referencias legacy**

Run:
```bash
cd /home/ldoc/Proyectos
grep -rn "validCodes\|codes.json\|renderLeaderboard\|leaderboard-container\|/usuario" porra-spa/js porra-spa/index.html porra-spa/data porra-spa/AGENTS.md api-porra/server.js api-porra/AGENTS.md 2>/dev/null || echo "SIN REFERENCIAS LEGACY"
```
Expected: solo se listan referencias permitidas (p.ej. la spec/plan en docs) o "SIN REFERENCIAS LEGACY".

- [ ] **Step 4: Confirmar estado final de git en ambos repos**

Run: `cd /home/ldoc/Proyectos/api-porra && git status --short` y `cd /home/ldoc/Proyectos/porra-spa && git status --short`
Expected: sin cambios sin commitear (todo commiteado).
