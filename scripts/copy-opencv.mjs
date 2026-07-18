import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules/@techstark/opencv-js/dist/opencv.js');
const destDir = join(root, 'public/opencv');
const dest = join(destDir, 'opencv.js');

if (!existsSync(src)) {
  console.warn('[copy-opencv] @techstark/opencv-js not installed; skip');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log('[copy-opencv] wrote public/opencv/opencv.js');
