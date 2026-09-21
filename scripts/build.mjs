// Builds dist/code.js (main thread) and dist/ui.html (UI with JS + CSS inlined).
// Figma loads the UI as a single HTML string, so nothing can be a separate file.
import * as esbuild from 'esbuild';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const define = { __VERSION__: JSON.stringify(pkg.version) };

async function writeUiHtml(js) {
  const [template, css] = await Promise.all([
    readFile('src/ui/ui.html', 'utf8'),
    readFile('src/ui/ui.css', 'utf8'),
  ]);
  // Function replacers so "$" in the bundle isn't treated as a pattern.
  const html = template
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js.replace(/<\/script/gi, '<\\/script'));
  await writeFile('dist/ui.html', html);
}

const inlineUi = {
  name: 'inline-ui',
  setup(build) {
    build.onEnd(async (result) => {
      if (result.errors.length) return;
      await writeUiHtml(result.outputFiles[0].text);
      console.log(`[build] dist/ui.html ${new Date().toLocaleTimeString()}`);
    });
  },
};

const common = { bundle: true, logLevel: 'info', define, minify: !watch, sourcemap: false };

const codeOptions = {
  ...common,
  entryPoints: ['src/code.ts'],
  outfile: 'dist/code.js',
  format: 'iife',
  target: 'es2017', // Figma's main-thread sandbox
};

const uiOptions = {
  ...common,
  entryPoints: ['src/ui/ui.ts'],
  outfile: 'dist/ui.js',
  format: 'iife',
  target: 'es2020',
  write: false,
  plugins: [inlineUi],
};

await mkdir('dist', { recursive: true });

if (watch) {
  const [code, ui] = await Promise.all([esbuild.context(codeOptions), esbuild.context(uiOptions)]);
  await Promise.all([code.watch(), ui.watch()]);
  console.log('[build] watching… (edit ui.html/ui.css? touch ui.ts to rebuild)');
} else {
  await Promise.all([esbuild.build(codeOptions), esbuild.build(uiOptions)]);
}
