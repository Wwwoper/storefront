/**
 * Safe helpers for the first real-data pilot.
 * Keep this file in the separate maintenance Apps Script project; do not copy
 * it into src/, which is the only directory deployed as the public Web App.
 */

var PILOT_PRODUCT_HEADERS_ = [
  'product_id', 'title', 'category', 'description', 'price_rub', 'quantity',
  'size_or_variant', 'condition', 'photo_1_url', 'photo_2_url', 'photo_3_url',
  'status', 'sort_order', 'updated_at'
];

/**
 * Adds three clearly marked draft rows to an empty product sheet.
 * This never overwrites existing rows and never publishes the examples.
 */
function addPilotSampleProducts() {
  var spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '').trim();
  if (!spreadsheetId) {
    throw new Error('В свойствах служебного скрипта не задан SPREADSHEET_ID.');
  }

  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var sheet = spreadsheet.getSheetByName('Товары');
  if (!sheet) {
    throw new Error('Не найден лист «Товары». Сначала выполните setupCatalogTemplate.');
  }

  var values = sheet.getDataRange().getValues();
  if (!values.length || !pilotHeadersMatch_(values[0])) {
    throw new Error('Структура листа «Товары» отличается от ожидаемой. Запустите runPilotPreflight и исправьте заголовки.');
  }

  var hasData = values.slice(1).some(function (row) {
    return row.some(function (value) { return pilotText_(value) !== ''; });
  });
  if (hasData) {
    throw new Error('В листе «Товары» уже есть данные. Примеры не добавлены, чтобы не смешивать их с вашим каталогом.');
  }

  var samples = [
    [
      'DEMO-CLOTH-001', 'ПРИМЕР — одежда', 'Одежда',
      'Демонстрационная строка. Замените название, описание, цену и фото реального товара.',
      1000, 1, 'M', 'Б/у, хорошее', '', '', '', 'Черновик', 10, ''
    ],
    [
      'DEMO-HOME-001', 'ПРИМЕР — вещь для дома', 'Дом и быт',
      'Демонстрационная строка. Не публикуйте, пока не замените данные на реальные.',
      500, 1, '', 'Хорошее', '', '', '', 'Черновик', 20, ''
    ],
    [
      'DEMO-OTHER-001', 'ПРИМЕР — другой товар', 'Другое',
      'Демонстрационная строка для проверки нескольких категорий в каталоге.',
      1500, 1, '', 'Новое', '', '', '', 'Черновик', 30, ''
    ]
  ];

  sheet.getRange(2, 1, samples.length, PILOT_PRODUCT_HEADERS_.length).setValues(samples);
  var message = 'Добавлены 3 демонстрационные строки со статусом «Черновик». Они не отображаются в публичной витрине. Замените их своими данными и фото до публикации.';
  console.log(message);
  return { ok: true, added: samples.length, message: message };
}

/**
 * Checks the setup needed for a pilot. This checks configuration and sheet
 * data only; it cannot prove that the deployed URL or images are reachable by
 * anonymous visitors. Those checks are listed in PILOT_LAUNCH.md.
 */
function runPilotPreflight() {
  var checks = [];
  var spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '').trim();

  if (!spreadsheetId) {
    pilotAddCheck_(checks, 'ERROR', 'SPREADSHEET_ID', 'В свойствах скрипта не задан ID таблицы.');
    return pilotFinishChecks_(checks);
  }
  pilotAddCheck_(checks, 'OK', 'SPREADSHEET_ID', 'ID таблицы задан.');

  var spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    pilotAddCheck_(checks, 'OK', 'Доступ к таблице', 'Таблица открывается от имени текущего служебного аккаунта.');
  } catch (error) {
    pilotAddCheck_(checks, 'ERROR', 'Доступ к таблице', 'Не удалось открыть таблицу. Проверьте ID и права доступа у аккаунта скрипта.');
    return pilotFinishChecks_(checks);
  }

  var products = spreadsheet.getSheetByName('Товары');
  var categories = spreadsheet.getSheetByName('Справочники');
  var settings = spreadsheet.getSheetByName('Настройки');
  if (!products) pilotAddCheck_(checks, 'ERROR', 'Лист «Товары»', 'Лист не найден. Выполните setupCatalogTemplate.');
  if (!categories) pilotAddCheck_(checks, 'ERROR', 'Лист «Справочники»', 'Лист не найден. Выполните setupCatalogTemplate.');
  if (!settings) pilotAddCheck_(checks, 'ERROR', 'Лист «Настройки»', 'Лист не найден. Выполните setupCatalogTemplate.');
  if (!products || !categories || !settings) return pilotFinishChecks_(checks);

  var productValues = products.getDataRange().getValues();
  if (!productValues.length || !pilotHeadersMatch_(productValues[0])) {
    pilotAddCheck_(checks, 'ERROR', 'Заголовки листа «Товары»', 'Заголовки не совпадают с шаблоном. Не переименовывайте столбцы; восстановите структуру до загрузки товаров.');
  } else {
    pilotAddCheck_(checks, 'OK', 'Заголовки листа «Товары»', 'Все 14 столбцов шаблона на месте.');
  }

  var categoryValues = categories.getDataRange().getValues();
  var categoryCount = Math.max(0, categoryValues.length - 1);
  if (categoryCount > 0) {
    pilotAddCheck_(checks, 'OK', 'Категории', 'В справочнике есть строки категорий.');
  } else {
    pilotAddCheck_(checks, 'ERROR', 'Категории', 'Добавьте хотя бы одну категорию на лист «Справочники».');
  }

  var settingValues = settings.getDataRange().getValues();
  var settingMap = Object.create(null);
  settingValues.slice(1).forEach(function (row) {
    var key = pilotText_(row[0]);
    if (key) settingMap[key] = pilotText_(row[1]);
  });

  var telegramUsername = pilotText_(settingMap.seller_telegram_username).replace(/^@/, '');
  var telegramReady = /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegramUsername);
  var maxReady = pilotText_(settingMap.max_enabled).toLowerCase() === 'true';
  var formReady = /^https:\/\/docs\.google\.com\/forms\//i.test(pilotText_(settingMap.google_form_url))
    && /^\d+$/.test(pilotText_(settingMap.google_form_product_id_entry));

  if (telegramReady || maxReady || formReady) {
    var channels = [];
    if (telegramReady) channels.push('Telegram');
    if (maxReady) channels.push('MAX включён в настройках');
    if (formReady) channels.push('Google Forms');
    pilotAddCheck_(checks, 'OK', 'Канал обратной связи', 'Настроен хотя бы один канал: ' + channels.join(', ') + '. Проверьте его вручную с телефона.');
  } else {
    pilotAddCheck_(checks, 'ERROR', 'Канал обратной связи', 'Настройте username Telegram, включите MAX после проверки ссылки или укажите Google Form с полем product_id.');
  }

  if (formReady) {
    pilotAddCheck_(checks, 'OK', 'Заявки через Google Forms', 'Ссылка и ID поля товара заданы; проверьте предварительно заполненную форму вручную.');
  } else {
    pilotAddCheck_(checks, 'WARN', 'Заявки через Google Forms', 'Форма не настроена. Это допустимо, если покупатели будут писать напрямую через другой канал.');
  }

  try {
    var validation = validateCatalog();
    if (validation.ok) {
      pilotAddCheck_(checks, 'OK', 'Проверка каталога', 'Ошибок структуры активных товаров не обнаружено.');
    } else {
      pilotAddCheck_(checks, 'ERROR', 'Проверка каталога', 'Обнаружены проблемы: ' + validation.errors.slice(0, 5).join(' | '));
      if (validation.errors.length > 5) {
        pilotAddCheck_(checks, 'WARN', 'Остальные ошибки каталога', 'Дополнительно найдено ошибок: ' + (validation.errors.length - 5) + '. Смотрите журнал выполнения.');
      }
    }
  } catch (error) {
    pilotAddCheck_(checks, 'ERROR', 'Проверка каталога', 'Не удалось выполнить проверку. Убедитесь, что Setup.gs и Pilot.gs находятся в одном служебном Apps Script-проекте.');
  }

  var publishedCount = 0;
  productValues.slice(1).forEach(function (row) {
    var status = pilotText_(row[11]);
    if (status === 'В наличии' || status === 'Зарезервирован') publishedCount += 1;
  });
  if (publishedCount > 0) {
    pilotAddCheck_(checks, 'OK', 'Опубликованные строки', 'Найдено строк со статусом «В наличии» или «Зарезервирован»: ' + publishedCount + '. Проверьте карточки в анонимном окне.');
  } else {
    pilotAddCheck_(checks, 'WARN', 'Опубликованные строки', 'Пока нет опубликованных товаров. Это нормально до загрузки реальных данных.');
  }

  pilotAddCheck_(checks, 'WARN', 'Публичный доступ', 'Скрипт не может подтвердить работу анонимного URL и доступность фото. Откройте витрину в приватном окне без входа в Google.');
  return pilotFinishChecks_(checks);
}

function pilotHeadersMatch_(actualHeaders) {
  if (!actualHeaders || actualHeaders.length < PILOT_PRODUCT_HEADERS_.length) return false;
  return PILOT_PRODUCT_HEADERS_.every(function (expected, index) {
    return pilotText_(actualHeaders[index]) === expected;
  });
}

function pilotText_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function pilotAddCheck_(checks, severity, name, message) {
  checks.push({ severity: severity, name: name, message: message });
}

function pilotFinishChecks_(checks) {
  var errorCount = checks.filter(function (item) { return item.severity === 'ERROR'; }).length;
  var warningCount = checks.filter(function (item) { return item.severity === 'WARN'; }).length;
  var message = 'Проверка завершена: ошибок — ' + errorCount + ', предупреждений — ' + warningCount + '.\n'
    + checks.map(function (item) { return '[' + item.severity + '] ' + item.name + ': ' + item.message; }).join('\n');
  console.log(message);
  return { ok: errorCount === 0, errorCount: errorCount, warningCount: warningCount, checks: checks, message: message };
}
