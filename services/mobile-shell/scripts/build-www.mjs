#!/usr/bin/env node
/**
 * Bundle shell-bootstrap.ts → www/shell-bootstrap.js (IIFE for index.html)
 */
import * as esbuild from 'esbuild';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outFile = join(root, 'www', 'shell-bootstrap.js');

mkdirSync(dirname(outFile), { recursive: true });

await esbuild.build({
  entryPoints: [join(root, 'src', 'shell-bootstrap.ts')],
  outfile: outFile,
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
});

console.log(`OK  ${outFile}`);
