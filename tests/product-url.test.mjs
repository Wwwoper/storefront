import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const codeGs = readFileSync(new URL('../src/Code.gs', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../src/Index.html', import.meta.url), 'utf8');
const clientHtml = readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');

test('server injects the canonical URL and accepts a validated product query parameter', () => {
  assert.match(codeGs, /template\.webAppUrl\s*=\s*ScriptApp\.getService\(\)\.getUrl\(\)\s*\|\|\s*''/);
  assert.match(codeGs, /function doGet\(e\)/);
  assert.match(codeGs, /e\.parameter\.product/);
  assert.match(codeGs, /template\.requestedProductId\s*=\s*\/\^\[A-Za-z0-9\]\[A-Za-z0-9_\-\]\{0,63\}\$\//);
  assert.match(indexHtml, /window\.STOREFRONT_WEB_APP_URL\s*=\s*<\?!=\s*JSON\.stringify\(webAppUrl\)\s*\?>/);
  assert.match(indexHtml, /window\.STOREFRONT_REQUESTED_PRODUCT_ID\s*=\s*<\?!=\s*JSON\.stringify\(requestedProductId\)\s*\?>/);
});

test('Telegram product link uses a query parameter instead of a fragment that may be lost in the iframe', () => {
  const match = clientHtml.match(/function makeProductUrl\(product\)\s*\{([\s\S]*?)\n    \}/);
  assert.ok(match, 'makeProductUrl function should exist');
  const makeProductUrl = new Function('window', 'URL', `return function makeProductUrl(product) {${match[1]}\n};`);
  const getUrl = makeProductUrl({ STOREFRONT_WEB_APP_URL: 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec' }, URL);
  assert.equal(getUrl({ id: 'DEMO-CLOTH-001' }), 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec?product=DEMO-CLOTH-001');
  assert.match(clientHtml, /window\.STOREFRONT_REQUESTED_PRODUCT_ID/);
  assert.match(clientHtml, /product\.id === state\.requestedProductId/);
  assert.match(clientHtml, /Товар по ссылке не найден/);
  assert.match(indexHtml, /id="show-all-products"/);
  assert.doesNotMatch(match[1], /window\.location\.href/);
});
