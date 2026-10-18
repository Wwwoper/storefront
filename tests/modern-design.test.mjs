import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const styles = await readFile(path.join(projectRoot, 'src', 'Styles.html'), 'utf8');

const modernDesign = styles.slice(styles.indexOf('/* Contemporary editorial storefront'));

test('uses a warm editorial palette and deep green primary accent', () => {
  assert.match(modernDesign, /--page:\s*#f7f6f2/);
  assert.match(modernDesign, /--surface:\s*#ffffff/);
  assert.match(modernDesign, /--accent:\s*#263b30/);
  assert.match(modernDesign, /--text:\s*#252821/);
});

test('uses large editorial headings and a restrained eyebrow marker', () => {
  assert.match(modernDesign, /h1\s*\{[^}]*font-size:\s*clamp\(40px,\s*6\.1vw,\s*76px\)/s);
  assert.match(modernDesign, /\.eyebrow::before\s*\{[^}]*border-radius:\s*50%/s);
});

test('product gallery is prominent and product cards stack image above details', () => {
  assert.match(modernDesign, /\.product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(modernDesign, /\.product-card\s*\{[^}]*flex-direction:\s*column/s);
  assert.match(modernDesign, /\.product-media\s*\{[^}]*aspect-ratio:\s*1\s*\/\s*1/s);
  assert.match(modernDesign, /\.product-media img\s*\{\s*object-fit:\s*contain/);
});

test('responsive design adapts grid and catalog controls for tablets and phones', () => {
  assert.match(modernDesign, /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.product-grid\s*\{[^}]*repeat\(2,/);
  assert.match(modernDesign, /@media\s*\(max-width:\s*700px\)[\s\S]*?\.product-grid\s*\{[^}]*minmax\(0,\s*1fr\)/);
  assert.match(modernDesign, /\.search-field\s*\{\s*grid-column:\s*1\s*\/\s*-1/);
});

test('uses visible focus styles and respects reduced-motion preference', () => {
  assert.match(styles, /button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(modernDesign, /\.product-card:hover\s*\{\s*transform:\s*none/);
});
