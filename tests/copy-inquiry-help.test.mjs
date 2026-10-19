import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const clientHtml = readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');
const stylesHtml = readFileSync(new URL('../src/Styles.html', import.meta.url), 'utf8');

test('Telegram button has clear Russian text and copy guidance follows the copy button', () => {
  assert.match(clientHtml, /copyHelp\.className = 'copy-help'/);
  assert.match(clientHtml, /Скопирует название, код, цену и ссылку на товар — вставьте сообщение в чат продавцу\./);
  assert.doesNotMatch(clientHtml, /Кнопка копирует готовое сообщение с названием, кодом, ценой и ссылкой на товар/);
  assert.match(clientHtml, /createLinkButton\('Написать в TG', telegramUrl/);
  assert.match(clientHtml, /copyButton\.textContent = 'Скопировать запрос';[\s\S]*?actions\.appendChild\(copyButton\);[\s\S]*?actions\.appendChild\(copyHelp\);/);
});

test('copy feedback tells the buyer what to do next', () => {
  assert.match(clientHtml, /Текст скопирован\. Вставьте его в чат с продавцом и отправьте\./);
  assert.match(clientHtml, /Окно с текстом открыто\. Скопируйте его, затем вставьте в чат с продавцом и отправьте\./);
  const modernDesign = stylesHtml.slice(stylesHtml.indexOf('/* Contemporary editorial storefront'));
  assert.match(modernDesign, /\.copy-help \{[^}]*font-size: 12px;[^}]*line-height: 1\.5;/);
});
