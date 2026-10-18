import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(projectRoot, 'src');

const productHeaders = [
  'product_id', 'title', 'category', 'description', 'price_rub', 'quantity',
  'size_or_variant', 'condition', 'photo_1_url', 'photo_2_url', 'photo_3_url',
  'status', 'sort_order', 'updated_at'
];

function makeSheet(values) {
  return {
    getDataRange() {
      return { getValues: () => values };
    }
  };
}

async function makeFixture({ spreadsheetId = 'sheet-test-id', productRows = [], settingRows = [] } = {}) {
  const sheets = {
    'Товары': makeSheet([productHeaders, ...productRows]),
    'Справочники': makeSheet([
      ['Категория'],
      ['Одежда'],
      ['Дом и быт']
    ]),
    'Настройки': makeSheet([
      ['key', 'value'],
      ['store_title', 'Тестовая витрина'],
      ['store_description', 'Описание витрины'],
      ['seller_telegram_username', 'seller_example'],
      ['seller_contact_note', 'Пишу вечером'],
      ['max_enabled', 'TRUE'],
      ['google_form_url', 'https://docs.google.com/forms/d/e/FORM_ID/viewform'],
      ['google_form_product_id_entry', '123456'],
      ['google_form_product_url_entry', '234567'],
      ['delivery_note', 'Передача по договорённости'],
      ...settingRows
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
        return {
          getProperty(key) {
            return key === 'SPREADSHEET_ID' ? spreadsheetId : null;
          }
        };
      }
    },
    SpreadsheetApp: {
      openById(id) {
        if (id !== spreadsheetId) throw new Error('Private spreadsheet id mismatch');
        return spreadsheet;
      }
    },
    console: {
      error() {},
      log() {}
    }
  };

  vm.createContext(sandbox);
  for (const filename of ['Config.gs', 'Catalog.gs', 'Code.gs']) {
    const source = await readFile(path.join(sourceDir, filename), 'utf8');
    vm.runInContext(source, sandbox, { filename });
  }

  return { runtime: sandbox, sheets };
}

function row({
  id,
  title = 'Тестовый товар',
  category = 'Одежда',
  description = 'Описание',
  price = 2500,
  quantity = 1,
  size = '',
  condition = 'Новое',
  photo = 'https://example.com/photo.jpg',
  photo2 = '',
  photo3 = '',
  status = 'В наличии',
  sort = ''
}) {
  return [id, title, category, description, price, quantity, size, condition, photo, photo2, photo3, status, sort, ''];
}

function jsonSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

test('публикует только разрешённые статусы и корректные товары', async () => {
  const productRows = [
    row({ id: 'ITEM-001', title: 'Куртка', quantity: 3, photo: 'https://drive.google.com/file/d/drive-file_123/view?usp=sharing', sort: 2 }),
    row({ id: 'ITEM-002', title: 'Чашка', quantity: 0, category: 'Дом и быт', sort: '' }),
    row({ id: 'ITEM-003', title: 'Настольная лампа', status: 'Зарезервирован', category: 'Дом и быт', sort: 1 }),
    row({ id: 'ITEM-004', status: 'Продан', title: 'Проданный товар', photo: '' }),
    row({ id: 'ITEM-005', status: 'Черновик', title: 'Черновик', photo: '' }),
    row({ id: 'ITEM-006', status: 'Скрыт', title: 'Скрытый товар', photo: '' }),
    row({ id: 'ITEM-DUP', title: 'Дубликат номер один' }),
    row({ id: 'ITEM-DUP', title: 'Дубликат номер два' }),
    row({ id: 'ITEM-OTHER', category: 'Коллекционное', title: 'Коллекционный товар', sort: 3 })
  ];
  const { runtime } = await makeFixture({ productRows });
  const result = jsonSafe(runtime.getStorefrontData());

  assert.equal(result.ok, true);
  assert.deepEqual(result.products.map((product) => product.id), [
    'ITEM-003', 'ITEM-001', 'ITEM-OTHER', 'ITEM-002'
  ]);
  assert.equal(result.products.find((product) => product.id === 'ITEM-001').photos[0],
    'https://lh3.googleusercontent.com/d/drive-file_123');
  assert.equal(result.products.find((product) => product.id === 'ITEM-002').availabilityLabel, 'Нет в наличии');
  assert.equal(result.products.find((product) => product.id === 'ITEM-003').availabilityLabel, 'Зарезервирован');
  assert.equal(result.products.find((product) => product.id === 'ITEM-OTHER').category, 'Другое');
  assert.ok(!result.products.some((product) => product.id === 'ITEM-004'));
  assert.ok(!result.products.some((product) => product.id === 'ITEM-DUP'));
  assert.ok(result.categories.includes('Другое'));
});

test('публичная конфигурация содержит только разрешённые настройки', async () => {
  const { runtime } = await makeFixture({
    settingRows: [['private_api_key', 'must-not-leak']]
  });
  const result = jsonSafe(runtime.getStorefrontData());

  assert.equal(result.ok, true);
  assert.equal(result.settings.storeTitle, 'Тестовая витрина');
  assert.equal(result.settings.sellerTelegramUsername, 'seller_example');
  assert.equal(result.settings.maxEnabled, true);
  assert.equal(result.settings.googleFormUrl, 'https://docs.google.com/forms/d/e/FORM_ID/viewform');
  assert.equal(Object.hasOwn(result.settings, 'private_api_key'), false);
  assert.equal(JSON.stringify(result).includes('must-not-leak'), false);
});

test('некорректные контакты и форма отключаются', async () => {
  const { runtime } = await makeFixture({
    settingRows: [
      ['seller_telegram_username', 'https://evil.example'],
      ['google_form_url', 'javascript:alert(1)'],
      ['google_form_product_id_entry', 'not-a-number']
    ]
  });
  const result = jsonSafe(runtime.getStorefrontData());

  assert.equal(result.settings.sellerTelegramUsername, '');
  assert.equal(result.settings.googleFormUrl, '');
  assert.equal(result.settings.googleFormProductIdEntry, '');
});

test('при отсутствии SPREADSHEET_ID возвращается безопасная ошибка', async () => {
  const { runtime } = await makeFixture({ spreadsheetId: '' });
  const result = jsonSafe(runtime.getStorefrontData());

  assert.equal(result.ok, false);
  assert.match(result.message, /обновить страницу/i);
  assert.equal(JSON.stringify(result).includes('SPREADSHEET_ID'), false);
  assert.equal(JSON.stringify(result).includes('Private spreadsheet'), false);
});

test('не публикует товары с некорректной ценой, остатком, фото или идентификатором', async () => {
  const productRows = [
    row({ id: 'ITEM-PRICE', price: -1 }),
    row({ id: 'ITEM-QTY', quantity: 1.5 }),
    row({ id: 'ITEM-HTTP', photo: 'http://example.com/photo.jpg' }),
    row({ id: 'bad id' }),
    row({ id: 'ITEM-GOOD' })
  ];
  const { runtime } = await makeFixture({ productRows });
  const result = jsonSafe(runtime.getStorefrontData());

  assert.deepEqual(result.products.map((product) => product.id), ['ITEM-GOOD']);
});

test('клиент не использует innerHTML для отображения содержимого таблицы', async () => {
  const client = await readFile(path.join(sourceDir, 'Client.html'), 'utf8');
  assert.equal(client.includes('.innerHTML'), false);
  assert.match(client, /\.textContent\s*=/);
  assert.match(client, /https:\/\/max\.ru\/:share\?text=/);
  assert.match(client, /https:\/\/t\.me\//);
});

test('манифест Apps Script валиден и публикация задумана как анонимная', async () => {
  const manifestText = await readFile(path.join(sourceDir, 'appsscript.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.equal(manifest.webapp.access, 'ANYONE_ANONYMOUS');
  assert.equal(manifest.webapp.executeAs, 'USER_DEPLOYING');
});

test('privileged helpers are private to google.script.run', async () => {
  const names = [];
  for (const filename of ['Config.gs', 'Catalog.gs', 'Code.gs']) {
    const source = await readFile(path.join(sourceDir, filename), 'utf8');
    for (const match of source.matchAll(/function\s+([A-Za-z0-9_]+)\s*\(/g)) {
      names.push(match[1]);
    }
  }
  const remotelyCallable = [...new Set(names.filter((name) => !name.endsWith('_')))].sort();
  assert.deepEqual(remotelyCallable, ['doGet', 'getStorefrontData']);
});

test('сортирует по sort_order, затем по названию, пустой порядок оставляет в конце', async () => {
  const productRows = [
    row({ id: 'ITEM-Z', title: 'Яблоко', sort: 5 }),
    row({ id: 'ITEM-B', title: 'Ботинки', sort: 1 }),
    row({ id: 'ITEM-A', title: 'Аксессуар', sort: 1 }),
    row({ id: 'ITEM-C', title: 'Куртка', sort: '' }),
    row({ id: 'ITEM-NEG', title: 'Первым', sort: -1 })
  ];
  const { runtime } = await makeFixture({ productRows });
  const result = jsonSafe(runtime.getStorefrontData());
  assert.deepEqual(result.products.map((product) => product.id), [
    'ITEM-NEG', 'ITEM-A', 'ITEM-B', 'ITEM-Z', 'ITEM-C'
  ]);
});


test('служебный скрипт настройки не входит в публичное развёртывание', async () => {
  const { readdir } = await import('node:fs/promises');
  const deployedFiles = await readdir(sourceDir);
  assert.equal(deployedFiles.includes('Setup.gs'), false);

  const maintenancePath = path.join(projectRoot, 'tools', 'setup', 'Setup.gs');
  const maintenanceSource = await readFile(maintenancePath, 'utf8');
  assert.doesNotThrow(() => new vm.Script(maintenanceSource, { filename: maintenancePath }));
  assert.match(maintenanceSource, /function setupCatalogTemplate\s*\(/);
  assert.match(maintenanceSource, /function validateCatalog\s*\(/);
});

test('владелческая проверка каталога находит дубликаты и ошибки активных товаров', async () => {
  const { runtime } = await makeFixture({
    productRows: [
      row({ id: 'ITEM-DUP', title: 'Первый товар' }),
      row({ id: 'ITEM-DUP', title: 'Второй товар' }),
      row({ id: 'ITEM-QTY', quantity: 1.5 }),
      row({ id: 'ITEM-CATEGORY', category: 'Неизвестная категория' })
    ]
  });
  const maintenancePath = path.join(projectRoot, 'tools', 'setup', 'Setup.gs');
  const maintenanceSource = await readFile(maintenancePath, 'utf8');
  vm.runInContext(maintenanceSource, runtime, { filename: maintenancePath });
  const validation = jsonSafe(runtime.validateCatalog());

  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((message) => message.includes('повторяется')));
  assert.ok(validation.errors.some((message) => message.includes('quantity')));
  assert.ok(validation.errors.some((message) => message.includes('Справочники')));
});
