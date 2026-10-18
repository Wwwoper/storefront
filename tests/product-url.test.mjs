import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const codeGs = readFileSync(new URL('../src/Code.gs', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../src/Index.html', import.meta.url), 'utf8');
const clientHtml = readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');

test('server injects the canonical deployed web-app URL into the template', () => {
  assert.match(codeGs, /template\.webAppUrl\s*=\s*ScriptApp\.getService\(\)\.getUrl\(\)\s*\|\|\s*''/);
  assert.match(indexHtml, /window\.STOREFRONT_WEB_APP_URL\s*=\s*<\?!=\s*JSON\.stringify\(webAppUrl\)\s*\?>/);
});

test('Telegram product link uses the public /exec URL and product hash, not the sandbox iframe URL', () => {
  const match = clientHtml.match(/function makeProductUrl\(product\)\s*\{([\s\S]*?)\n    \}/);
  assert.ok(match, 'makeProductUrl function should exist');
  const makeProductUrl = new Function('window', 'URL', `return function makeProductUrl(product) {${match[1]}\n};`);
  const getUrl = makeProductUrl({ STOREFRONT_WEB_APP_URL: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec' }, URL);
  assert.equal(getUrl({ id: 'DEMO-CLOTH-001' }), 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec#DEMO-CLOTH-001');
  assert.equal(getUrl({ id: 'A B' }), 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec#A%20B');
  assert.doesNotMatch(match[1], /window\.location\.href/);
});
