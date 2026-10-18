import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const client = await readFile(path.join(root, 'src', 'Client.html'), 'utf8');
const styles = await readFile(path.join(root, 'src', 'Styles.html'), 'utf8');
const newDesign = styles.slice(styles.lastIndexOf('/* Editorial card details:'));

test('product availability badge is placed below the photo, before product details', () => {
  assert.match(client, /badgeContainer\.className = 'product-status-row'/);
  assert.match(client, /card\.appendChild\(media\);\s*card\.appendChild\(badgeContainer\);\s*card\.appendChild\(body\);/);
  assert.match(newDesign, /\.product-status-row\s*\{[^}]*display:\s*flex/s);
  assert.match(newDesign, /\.product-status-row \.status-available\s*\{[^}]*background:\s*#e5efe5/s);
  assert.match(newDesign, /\.product-status-row \.status-reserved\s*\{[^}]*background:\s*#fbf0d9/s);
  assert.match(newDesign, /\.product-status-row \.status-unavailable\s*\{[^}]*background:\s*#eeece8/s);
});

test('Telegram and MAX links share contact-button styling and have distinct colors', () => {
  assert.match(client, /createLinkButton\('Написать в TG', telegramUrl, 'button button-primary button-contact button-telegram'\)/);
  assert.match(client, /createLinkButton\('Написать в MAX', maxUrl, 'button button-secondary button-contact button-max'\)/);
  assert.match(newDesign, /\.product-actions \.button-contact\s*\{[^}]*min-height:\s*48px/s);
  assert.match(newDesign, /\.product-actions \.button-telegram\s*\{[^}]*background:\s*#086f9f/s);
  assert.match(newDesign, /\.product-actions \.button-max\s*\{[^}]*background:\s*#471aff/s);
  assert.match(newDesign, /\.product-actions \.button-contact:focus-visible/);
});
