import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(projectRoot, 'src');
const indexHtml = await readFile(path.join(sourceDir, 'Index.html'), 'utf8');
const clientHtml = await readFile(path.join(sourceDir, 'Client.html'), 'utf8');
const stylesHtml = await readFile(path.join(sourceDir, 'Styles.html'), 'utf8');

test('status filter defaults to in-stock and provides every public availability option', () => {
  assert.match(indexHtml, /<select id="status-filter"[^>]*>/);
  assert.match(indexHtml, /<option value="available" selected>В наличии<\/option>/);
  assert.match(indexHtml, /<option value="reserved">Зарезервирован<\/option>/);
  assert.match(indexHtml, /<option value="unavailable">Нет в наличии<\/option>/);
  assert.match(indexHtml, /<option value="all">Все статусы<\/option>/);
});

test('status filter changes results and direct product links are not hidden by availability filter', () => {
  assert.match(clientHtml, /elements\['status-filter'\]\.addEventListener\('change', renderProducts\)/);
  assert.match(clientHtml, /selectedStatus === 'available' && product\.availabilityLabel === 'В наличии'/);
  assert.match(clientHtml, /selectedStatus === 'reserved' && product\.availabilityLabel === 'Зарезервирован'/);
  assert.match(clientHtml, /selectedStatus === 'unavailable' && product\.availabilityLabel === 'Нет в наличии'/);
  assert.match(clientHtml, /Boolean\(state\.requestedProductId\) \|\| selectedStatus === 'all'/);
});

test('reset filters restores in-stock as the default status', () => {
  assert.match(clientHtml, /elements\['status-filter'\]\.value = 'available'/);
});

test('status badge is prominent and visually distinguishes availability', () => {
  assert.match(clientHtml, /badge\.setAttribute\('aria-label', 'Статус товара:/);
  assert.match(stylesHtml, /\.status-badge::before/);
  assert.match(stylesHtml, /\.status-available\s*\{[^}]*--available-text/s);
  assert.match(stylesHtml, /\.status-reserved\s*\{[^}]*--reserved-text/s);
  assert.match(stylesHtml, /\.status-unavailable\s*\{[^}]*--unavailable-text/s);
});

test('product photo is visually dominant on desktop and displayed above details on phones', () => {
  assert.match(stylesHtml, /\.product-card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.12fr\)\s+minmax\(0,\s*\.95fr\)/s);
  assert.match(stylesHtml, /\.product-media\s*\{[^}]*min-height:\s*330px/s);
  assert.match(stylesHtml, /@media \(max-width: 600px\)[\s\S]*?\.product-card\s*\{\s*display:\s*flex;\s*flex-direction:\s*column/);
  assert.match(stylesHtml, /@media \(max-width: 600px\)[\s\S]*?\.product-media\s*\{[^}]*aspect-ratio:\s*1 \/ 1/s);
});

test('status-specific empty state explains how to view other availability states', () => {
  assert.match(clientHtml, /Сейчас нет товаров в наличии/);
  assert.match(clientHtml, /Выберите «Все статусы»/);
});
