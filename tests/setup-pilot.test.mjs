import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const productHeaders = [
  'product_id', 'title', 'category', 'description', 'price_rub', 'quantity',
  'size_or_variant', 'condition', 'photo_1_url', 'photo_2_url', 'photo_3_url',
  'status', 'sort_order', 'updated_at'
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeSheet(initialValues) {
  const sheet = {
    values: clone(initialValues),
    getDataRange() {
      return { getValues: () => clone(sheet.values) };
    },
    getLastRow() {
      return sheet.values.length;
    },
    getRange(startRow, startColumn, rowCount, columnCount) {
      return {
        setValues(rows) {
          for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
            const destinationRow = startRow - 1 + rowIndex;
            while (sheet.values.length <= destinationRow) sheet.values.push([]);
            for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
              sheet.values[destinationRow][startColumn - 1 + columnIndex] = rows[rowIndex][columnIndex];
            }
          }
        }
      };
    }
  };
  return sheet;
}

async function makeRuntime({ spreadsheetId = 'spreadsheet-test-id', productRows = [], settings = [] } = {}) {
  const sheets = {
    'Товары': makeSheet([productHeaders, ...productRows]),
    'Справочники': makeSheet([['Категория'], ['Одежда'], ['Дом и быт'], ['Другое']]),
    'Настройки': makeSheet([
      ['key', 'value'],
      ['store_title', 'Тестовая витрина'],
      ...settings
    ])
  };
  const spreadsheet = {
    getSheetByName(name) {
      return sheets[name] || null;
    }
  };
  const sandbox = {
    PropertiesService: {
      getScriptProperties() {
        return { getProperty: (key) => key === 'SPREADSHEET_ID' ? spreadsheetId : null };
      }
    },
    SpreadsheetApp: {
      openById(id) {
        if (!spreadsheetId || id !== spreadsheetId) throw new Error('not available');
        return spreadsheet;
      }
    },
    console: { log() {}, error() {} }
  };
  vm.createContext(sandbox);
  for (const filename of ['Setup.gs', 'Pilot.gs']) {
    const source = await readFile(path.join(projectRoot, 'tools', 'setup', filename), 'utf8');
    vm.runInContext(source, sandbox, { filename });
  }
  return { runtime: sandbox, sheets };
}

function productRow({
  id = 'ITEM-001',
  title = 'Куртка',
  category = 'Одежда',
  description = 'Хорошее состояние',
  price = 2500,
  quantity = 1,
  photo = 'https://example.com/photo.jpg',
  status = 'В наличии'
} = {}) {
  return [id, title, category, description, price, quantity, 'M', 'Б/у, хорошее', photo, '', '', status, 10, ''];
}

test('добавляет демонстрационные товары только как черновики', async () => {
  const { runtime, sheets } = await makeRuntime();
  const result = JSON.parse(JSON.stringify(runtime.addPilotSampleProducts()));
  const rows = sheets['Товары'].getDataRange().getValues().slice(1);

  assert.equal(result.ok, true);
  assert.equal(result.added, 3);
  assert.deepEqual(rows.map((row) => row[0]), ['DEMO-CLOTH-001', 'DEMO-HOME-001', 'DEMO-OTHER-001']);
  assert.ok(rows.every((row) => row[11] === 'Черновик'));
  assert.ok(rows.every((row) => row[8] === ''));
});

test('не добавляет примеры поверх уже заполненного каталога', async () => {
  const { runtime, sheets } = await makeRuntime({ productRows: [productRow({ status: 'Черновик' })] });
  assert.throws(() => runtime.addPilotSampleProducts(), /уже есть данные/i);
  assert.equal(sheets['Товары'].getDataRange().getValues().length, 2);
});

test('предварительная проверка сообщает об отсутствующем SPREADSHEET_ID', async () => {
  const { runtime } = await makeRuntime({ spreadsheetId: '' });
  const result = JSON.parse(JSON.stringify(runtime.runPilotPreflight()));

  assert.equal(result.ok, false);
  assert.equal(result.errorCount, 1);
  assert.match(result.checks[0].message, /не задан ID таблицы/i);
});

test('предварительная проверка обнаруживает отсутствие канала обратной связи', async () => {
  const { runtime } = await makeRuntime();
  const result = JSON.parse(JSON.stringify(runtime.runPilotPreflight()));

  assert.equal(result.ok, false);
  assert.ok(result.checks.some((item) => item.severity === 'ERROR' && item.name === 'Канал обратной связи'));
  assert.ok(result.checks.some((item) => item.severity === 'WARN' && item.name === 'Опубликованные строки'));
});

test('успешная проверка требует корректный активный товар и настроенный контакт', async () => {
  const { runtime } = await makeRuntime({
    productRows: [productRow()],
    settings: [['seller_telegram_username', 'seller_example']]
  });
  const result = JSON.parse(JSON.stringify(runtime.runPilotPreflight()));

  assert.equal(result.ok, true, result.message);
  assert.equal(result.errorCount, 0);
  assert.ok(result.checks.some((item) => item.severity === 'OK' && item.name === 'Проверка каталога'));
  assert.ok(result.checks.some((item) => item.severity === 'OK' && item.name === 'Опубликованные строки'));
  assert.ok(result.checks.some((item) => item.severity === 'WARN' && item.name === 'Публичный доступ'));
});

test('публичная и служебная части не смешаны', async () => {
  const clientSource = await readFile(path.join(projectRoot, 'src', 'Code.gs'), 'utf8');
  assert.equal(clientSource.includes('function addPilotSampleProducts'), false);
  assert.equal(clientSource.includes('function runPilotPreflight'), false);
});

test('строит формулы проверки данных с разделителем российской локали', async () => {
  const { runtime } = await makeRuntime();
  const formula = '=OR(F2="",AND(ISNUMBER(F2),F2>=0,MOD(F2,1)=0))';
  const localized = runtime.setupFormulaForSpreadsheet_(
    { getSpreadsheetLocale: () => 'ru_RU' },
    formula
  );

  assert.equal(localized, '=OR(F2="";AND(ISNUMBER(F2);F2>=0;MOD(F2;1)=0))');
});

test('оставляет запятые для локали США', async () => {
  const { runtime } = await makeRuntime();
  const formula = '=OR(F2="",AND(ISNUMBER(F2),F2>=0,MOD(F2,1)=0))';
  const localized = runtime.setupFormulaForSpreadsheet_(
    { getSpreadsheetLocale: () => 'en_US' },
    formula
  );

  assert.equal(localized, formula);
});
