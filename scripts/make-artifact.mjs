#!/usr/bin/env node
/**
 * Empaqueta dist/ en un único HTML autocontenido para publicarlo como artifact.
 *
 * El visor de artifacts envuelve el archivo en su propio <html><head><body>, así que
 * aquí se quita ese envoltorio y se deja solo el contenido. Tampoco registra el
 * service worker: los artifacts no los permiten. Todo lo demás es el mismo build.
 *
 *   npm run build && node scripts/make-artifact.mjs
 */

import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const OUT = join(ROOT, 'build', 'artifact.html');

const html = await readFile(join(DIST, 'index.html'), 'utf8');
const assets = await readdir(join(DIST, 'assets'));
const css = assets.find(f => f.endsWith('.css'));
const js = assets.find(f => f.endsWith('.js'));

const title = html.match(/<title>(.*?)<\/title>/s)?.[1] ?? 'Vocabulario en Ruta';
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/)?.[0] ?? '';
const body = html.match(/<body>(.*)<\/body>/s)[1]
  .replace(/<script[^>]*>[\s\S]*?<\/script>/g, '')   // los <script> se vuelven a añadir abajo
  .trim();

const page = `<title>${title}</title>
${fonts}
<style>
${await readFile(join(DIST, 'assets', css), 'utf8')}
</style>

${body}

<script type="module">
${await readFile(join(DIST, 'assets', js), 'utf8')}
</script>
`;

await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, page);
console.log(`build/artifact.html  ${(page.length / 1024).toFixed(0)} KB`);
