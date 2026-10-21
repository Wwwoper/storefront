import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeSettingsSheet(initialRows) {
  const rows = initialRows.map((row) => [...row]);
  return {
    getLastRow() {
      return rows.length;
    },
    getRange(startRow, startColumn, rowCount, columnCount) {
      return {
        getValues() {
          return rows.slice(startRow - 1, startRow - 1 + rowCount)
            .map((row) => row.slice(startColumn - 1, startColumn - 1 + columnCount));
        },
        setValues(values) {
          const firstIndex = startRow - 1;
          while (rows.length < firstIndex + values.length) rows.push([]);
          values.forEach((newRow, offset) => {
            const target = rows[firstIndex + offset];
            for (let column = 0; column < newRow.length; column += 1) {
              target[startColumn - 1 + column] = newRow[column];
            }
          });
        }
      };
    },
    values() {
      return rows.map((row) => [...row]);
    }
  };
}

test('community links UI is accessible, uses text nodes, and opens links safely', async () => {
  const index = await readFile(path.join(projectRoot, 'src/Index.html'), 'utf8');
  const client = await readFile(path.join(projectRoot, 'src/Client.html'), 'utf8');
  const styles = await readFile(path.join(projectRoot, 'src/Styles.html'), 'utf8');

  assert.match(index, /id="community-links"[^>]*hidden/);
  assert.match(index, /aria-labelledby="community-links-title"/);
  assert.match(index, /aria-label="Ссылки на сообщества"/);
  assert.match(client, /function renderCommunityLinks\(settings\)/);
  assert.match(client, /anchor\.target = '_blank'/);
  assert.match(client, /anchor\.rel = 'noopener noreferrer'/);
  assert.match(client, /anchor\.textContent = label/);
  assert.match(client, /Array\.isArray\(settings\.communityLinks\)\s*\?\s*settings\.communityLinks\s*:/);
  assert.match(styles, /\.community-links\[hidden\]\s*\{\s*display:\s*none;/);
  assert.doesNotMatch(client, /\.innerHTML/);
});

test('setup appends missing community settings without overwriting existing values', async () => {
  const source = await readFile(path.join(projectRoot, 'tools/setup/Setup.gs'), 'utf8');
  const runtime = {};
  vm.createContext(runtime);
  vm.runInContext(source, runtime, { filename: 'Setup.gs' });

  const sheet = makeSettingsSheet([
    ['key', 'value'],
    ['store_title', 'Пользовательское название'],
    ['community_telegram_url', 'https://t.me/already_configured']
  ]);

  runtime.setupAppendMissingSettings_(sheet, runtime.DEFAULT_SETTINGS_);
  const rowsAfterFirstRun = sheet.values();
  const valuesByKey = Object.fromEntries(rowsAfterFirstRun.slice(1));
  assert.equal(valuesByKey.store_title, 'Пользовательское название');
  assert.equal(valuesByKey.community_telegram_url, 'https://t.me/already_configured');
  assert.equal(valuesByKey.community_section_title, 'Мы также здесь');
  assert.equal(valuesByKey.community_max_url, '');
  assert.equal(valuesByKey.community_vk_url, '');
  assert.equal(valuesByKey.community_extra_label, 'Дополнительный источник');
  assert.equal(valuesByKey.community_extra_url, '');

  runtime.setupAppendMissingSettings_(sheet, runtime.DEFAULT_SETTINGS_);
  assert.equal(sheet.values().length, rowsAfterFirstRun.length, 'повторный запуск не создаёт дубликаты ключей');
});
