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
const CSS_OPTS = {
  minifyWhitespace: true,
  minifySyntax: true,
  legalComments: 'none'
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
    const result = await transform(source, { loader, ...(loader === 'js' ? JS_OPTS : CSS_OPTS) });
    await writeFile(full, result.code);
  }
}

await minifyDir('js', 'js');
await minifyDir('css', 'css');
console.log('build ok:', out);
