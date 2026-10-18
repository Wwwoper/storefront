import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const clientHtml = readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');
const stylesHtml = readFileSync(new URL('../src/Styles.html', import.meta.url), 'utf8');

test('copy inquiry button explains what it copies and where to send it', () => {
  assert.match(clientHtml, /copyHelp\.className = 'copy-help'/);
  assert.match(clientHtml, /названием, кодом, ценой и ссылкой на товар/);
  assert.match(clientHtml, /чат с продавцом в Telegram, MAX или другом мессенджере/);
  assert.match(clientHtml, /actions\.appendChild\(copyHelp\);[\s\S]*?copyButton\.textContent = 'Скопировать запрос'/);
});

test('copy feedback tells the buyer what to do next', () => {
  assert.match(clientHtml, /Текст скопирован\. Вставьте его в чат с продавцом и отправьте\./);
  assert.match(clientHtml, /Окно с текстом открыто\. Скопируйте его, затем вставьте в чат с продавцом и отправьте\./);
  assert.match(stylesHtml, /\.copy-help \{ grid-column: 1 \/ -1;[^}]*font-size: 11px;[^}]*line-height: 1\.45;/);
});
