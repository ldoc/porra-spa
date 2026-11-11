# Bloque 1 de rendimiento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reducir el tiempo de carga percibido y real del SPA en Vercel con cambios pequeños e independientemente revertibles.

**Architecture:** Cinco commits atómicos sobre la rama `perf/bloque-1`. No se toca `api-porra`, ni Mongo, ni variables de entorno. La minificación es conservadora (sin renombrar identificadores) para no romper globals ni handlers inline.

**Tech Stack:** HTML/CSS/JS vanilla, Vercel static + build con esbuild, sharp solo para convertir el trofeo a WebP.

## Global Constraints

- Rama `perf/bloque-1`; tag `pre-bloque-1` en `main` como punto de retorno.
- Un commit por tarea; cada uno debe poder revertirse sin tocar los demás.
- Minificación: `minifyWhitespace: true`, `minifySyntax: true`, `minifyIdentifiers: false`, `legalComments: 'none'`, `target: 'es2020'`.
- No cambiar nombres de funciones globales ni el orden de los scripts.
- Baseline de tests SPA: 285/287 (los 2 fallos ya existentes en `clasifClasToggle` y `estadisticasPronosticos`).
- Rollback inmediato en producción: Vercel → Deployments → Instant Rollback.

---

### Task 0: Plan

**Files:**
- Create: `docs/superpowers/plans/2026-11-11-bloque-1-rendimiento.md`

- [x] **Step 1: Escribir este plan**
- [x] **Step 2: Commit**

```bash
git add docs/superpowers/plans/2026-11-11-bloque-1-rendimiento.md
git commit -m "docs(perf): plan del bloque 1 de rendimiento"
```

---

### Task 1: `.vercelignore`

**Files:**
- Create: `.vercelignore`

- [ ] **Step 1: Crear el fichero**

```gitignore
# No se suben al deployment estático
node_modules/
tests/
docs/
.superpowers/
.agents/
api/
extract/
AGENTS.md
DESIGN.md
README.md
pantallas-usuarios-fases.md
server.mjs
```

- [ ] **Step 2: Comprobar que el runtime sigue incluido**

Run: `ls index.html css js data sounds reglas config.json`
Expected: todos existen (no se excluye ninguno).

- [ ] **Step 3: Commit**

```bash
git add .vercelignore
git commit -m "chore(deploy): excluye docs y tests del deployment de Vercel"
```

---

### Task 2: Headers de caché

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Añadir reglas al principio del array `headers`**

```json
{
  "source": "/",
  "headers": [
    { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
  ]
},
{
  "source": "/index.html",
  "headers": [
    { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
  ]
},
{
  "source": "/data/img/(.*)",
  "headers": [
    { "key": "Cache-Control", "value": "public, max-age=604800, stale-while-revalidate=86400" }
  ]
},
```

- [ ] **Step 2: Validar JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "perf(cache): evita revalidar HTML y cachea imagenes estaticas"
```

---

### Task 3: Splash más rápido y trofeo en WebP

**Files:**
- Modify: `js/main.js:73`
- Modify: `index.html` (img del splash)
- Create: `data/img/splash-trophy.webp`
- Delete: `data/img/splash-trophy.png`

- [ ] **Step 1: Convertir la imagen (desde `api-porra`, que ya tiene sharp)**

```bash
node --input-type=module -e "
import sharp from 'sharp';
await sharp('/home/ldoc/Proyectos/porra-spa/data/img/splash-trophy.png')
  .resize({ width: 520 })
  .webp({ quality: 82 })
  .toFile('/home/ldoc/Proyectos/porra-spa/data/img/splash-trophy.webp');
"
```

Expected: `splash-trophy.webp` ≈ 50-120 KB (frente a 815 KB del PNG).

- [ ] **Step 2: Reducir el splash mínimo**

En `js/main.js`, cambiar:

```js
const SPLASH_MIN_MS = 2500;
```

por:

```js
const SPLASH_MIN_MS = 700;
```

- [ ] **Step 3: Actualizar `index.html`**

```html
<img class="splash-trophy" src="data/img/splash-trophy.webp" alt="Porra Champions"
  width="260" height="466" fetchpriority="high">
```

- [ ] **Step 4: Borrar el PNG y añadir el WebP (está bajo `data/img/`, ignorado)**

```bash
git rm data/img/splash-trophy.png
git add -f data/img/splash-trophy.webp
```

- [ ] **Step 5: Verificar referencias**

Run: `grep -rn "splash-trophy" index.html js css`
Expected: solo la referencia al `.webp`.

- [ ] **Step 6: Commit**

```bash
git add index.html js/main.js
git commit -m "perf(splash): reduce el splash a 700ms y usa WebP"
```

---

### Task 4: `defer` en los scripts

**Files:**
- Modify: `index.html:316-333`

- [ ] **Step 1: Añadir `defer` a los 18 `<script src=...>`**

Cada línea pasa de:

```html
<script src="js/eliminatorias.js?v=6"></script>
```

a:

```html
<script src="js/eliminatorias.js?v=6" defer></script>
```

Se mantiene el orden actual; `defer` garantiza la misma secuencia de ejecución.

- [ ] **Step 2: Comprobar que no hay scripts inline**

Run: `grep -n "<script" index.html | grep -v "src="`
Expected: sin resultados (no hay inline que dependa del orden).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "perf(scripts): carga los scripts con defer"
```

---

### Task 5: Build con esbuild y minificación conservadora

**Files:**
- Create: `package.json`
- Create: `scripts/build.mjs`
- Modify: `vercel.json`

- [ ] **Step 1: Instalar esbuild como devDependency**

```bash
npm install --save-dev esbuild@0.28.2
```

- [ ] **Step 2: Crear `scripts/build.mjs`**

```js
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
const RUNTIME = ['index.html', 'css', 'js', 'data', 'sounds', 'reglas', 'config.json'];
const JS_OPTS = {
  minifyWhitespace: true,
  minifySyntax: true,
  minifyIdentifiers: false,
  legalComments: 'none',
  target: 'es2020'
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });

for (const entry of RUNTIME) {
  await cp(path.join(root, entry), path.join(out, entry), { recursive: true });
}

async function minifyDir(rel, loader) {
  const dir = path.join(out, rel);
  for (const file of await readdir(dir)) {
    if (!file.endsWith(`.${loader}`)) continue;
    const full = path.join(dir, file);
    const source = await readFile(full, 'utf8');
    const result = await transform(source, { loader, ...(loader === 'js' ? JS_OPTS : { minifyWhitespace: true, minifySyntax: true }) });
    await writeFile(full, result.code);
  }
}

await minifyDir('js', 'js');
await minifyDir('css', 'css');
console.log('build ok:', out);
```

- [ ] **Step 3: Añadir build a `vercel.json`**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "headers": [ ... ]
}
```

- [ ] **Step 4: Verificar el build local**

```bash
npm run build
node --check dist/js/*.js
du -sh dist/js dist/css
```

Expected: sin errores de sintaxis; `dist` contiene `index.html`, `data`, `sounds`, `reglas`.

- [ ] **Step 5: Comprobar que los globals siguen con su nombre**

```bash
grep -c "AppState" dist/js/main.js
grep -c "showToast" dist/js/main.js
```

Expected: ambos > 0 (no se han renombrado identificadores).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/build.mjs vercel.json
git commit -m "build(perf): minifica JS y CSS con esbuild en el build de Vercel"
```

---

## Verificación final

- `node --test tests/*.test.js` → 285/287 (mismos 2 fallos preexistentes).
- `npm run build && node --check dist/js/*.js`.
- Preview de Vercel de la rama y smoke manual: login, Inicio, Pronósticos, Plantilla, Resultados/Live, admin, consola sin errores.
- `curl -I` al preview: `/` sin caché; `.js`/`.css` con caché; WebP con caché.

## Rollback

- Un cambio concreto: `git revert <sha>`.
- Todo el bloque: volver a `main` (`git switch main`) y desplegar; o Instant Rollback del deployment anterior en Vercel.
- El tag `pre-bloque-1` conserva el estado exacto previo.
