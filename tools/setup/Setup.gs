
function setupCellText_(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

var PRODUCT_HEADERS_ = [
  'product_id', 'title', 'category', 'description', 'price_rub', 'quantity',
  'size_or_variant', 'condition', 'photo_1_url', 'photo_2_url', 'photo_3_url',
  'status', 'sort_order', 'updated_at'
];

var DEFAULT_CATEGORIES_ = [
  ['Одежда'], ['Обувь'], ['Электроника'], ['Дом и быт'], ['Спорт'], ['Другое']
];

var DEFAULT_SETTINGS_ = [
  ['store_title', 'Мои вещи'],
  ['store_description', 'Личная витрина вещей, которые ищут новых владельцев.'],
  ['seller_telegram_username', ''],
  ['seller_contact_note', ''],
  ['max_enabled', 'FALSE'],
  ['google_form_url', ''],
  ['google_form_product_id_entry', ''],
  ['google_form_product_url_entry', ''],
  ['delivery_note', '']
];

/**
 * One-time, non-destructive initial setup. Run from the Apps Script editor
 * after setting Script Property SPREADSHEET_ID. Existing populated sheets
 * are not overwritten.
 */
function setupCatalogTemplate() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = String(properties.getProperty('SPREADSHEET_ID') || '').trim();
  if (!spreadsheetId) {
    throw new Error('В свойствах скрипта не задан SPREADSHEET_ID.');
  }
  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var products = setupEnsureSheet_(spreadsheet, 'Товары', PRODUCT_HEADERS_);
  var reference = setupEnsureSheet_(spreadsheet, 'Справочники', ['Категория']);
  var settings = setupEnsureSheet_(spreadsheet, 'Настройки', ['key', 'value']);

  setupSeedSheetIfEmpty_(reference, [['Категория']].concat(DEFAULT_CATEGORIES_));
  setupSeedSheetIfEmpty_(settings, [['key', 'value']].concat(DEFAULT_SETTINGS_));
  setupConfigureSheet_(products, PRODUCT_HEADERS_.length);
  setupConfigureSheet_(reference, 1);
  setupConfigureSheet_(settings, 2);
  setupConfigureProductValidation_(products, reference);

  return {
    ok: true,
    message: 'Листы проверены. Проверьте структуру и заполните настройки витрины.'
  };
}

function setupEnsureSheet_(spreadsheet, sheetName, headers) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function setupSeedSheetIfEmpty_(sheet, rows) {
  // ensureSheet_ may already have written the header, so a header-only sheet
  // is still treated as empty for these reference/configuration tabs.
  if (sheet.getLastRow() <= 1) {
    sheet.clearContents();
    sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  }
}

function setupConfigureSheet_(sheet, columnCount) {
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, columnCount)
    .setFontWeight('bold')
    .setFontColor('#ffffff')
    .setBackground('#253047');
  sheet.getRange(1, 1, Math.max(1, sheet.getMaxRows()), columnCount).setVerticalAlignment('top');
  if (sheet.getFilter()) {
    sheet.getFilter().remove();
  }
  sheet.getRange(1, 1, Math.max(2, sheet.getMaxRows()), columnCount).createFilter();
  sheet.autoResizeColumns(1, columnCount);
  if (columnCount >= 4) {
    sheet.setColumnWidth(2, 220);
    sheet.setColumnWidth(4, 320);
    var dataRows = Math.max(1, sheet.getMaxRows() - 1);
    sheet.getRange(2, 4, dataRows, 1).setWrap(true);
    sheet.getRange(2, 5, dataRows, 1).setNumberFormat('#,##0.## \"₽\"');
  }
}

function setupConfigureProductValidation_(products, reference) {
  var rowCount = Math.max(1, products.getMaxRows() - 1);
  var statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Черновик', 'В наличии', 'Зарезервирован', 'Продан', 'Скрыт'], true)
    .setAllowInvalid(false)
    .setHelpText('Выберите статус публикации товара.')
    .build();
  products.getRange(2, 12, rowCount, 1).setDataValidation(statusRule);

  var categoryRowCount = Math.max(1, reference.getMaxRows() - 1);
  var categoryRule = SpreadsheetApp.newDataValidation()
    .requireValueInRange(reference.getRange(2, 1, categoryRowCount, 1), true)
    .setAllowInvalid(false)
    .setHelpText('Категория берётся из листа «Справочники».')
    .build();
  products.getRange(2, 3, rowCount, 1).setDataValidation(categoryRule);

  var priceRule = SpreadsheetApp.newDataValidation()
    .requireNumberGreaterThanOrEqualTo(0)
    .setAllowInvalid(false)
    .setHelpText('Цена должна быть числом, равным нулю или больше.')
    .build();
  products.getRange(2, 5, rowCount, 1).setDataValidation(priceRule);

  var quantityRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=OR(F2="",AND(ISNUMBER(F2),F2>=0,MOD(F2,1)=0))')
    .setAllowInvalid(false)
    .setHelpText('Количество должно быть целым числом, равным нулю или больше.')
    .build();
  products.getRange(2, 6, rowCount, 1).setDataValidation(quantityRule);

  var productIdRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=OR(A2="",COUNTIF($A$2:$A,A2)=1)')
    .setAllowInvalid(false)
    .setHelpText('Код товара должен быть уникальным.')
    .build();
  products.getRange(2, 1, rowCount, 1).setDataValidation(productIdRule);

  var sortOrderRule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=OR(M2="",AND(ISNUMBER(M2),MOD(M2,1)=0))')
    .setAllowInvalid(false)
    .setHelpText('Порядок сортировки должен быть целым числом.')
    .build();
  products.getRange(2, 13, rowCount, 1).setDataValidation(sortOrderRule);

  var formattingRules = products.getConditionalFormatRules();
  var incompleteProductRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($L2="В наличии",OR($A2="",$B2="",$C2="",$D2="",$E2="",$F2="",$I2=""))')
    .setBackground('#fce8e6')
    .setRanges([products.getRange(2, 1, rowCount, PRODUCT_HEADERS_.length)])
    .build();
  formattingRules.push(incompleteProductRule);
  products.setConditionalFormatRules(formattingRules);
}

/**
 * Owner-only maintenance diagnostic. This function exists in the separate,
 * unpublished maintenance project, not in the public Web App deployment.
 */
function validateCatalog() {
  var spreadsheetId = String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '').trim();
  if (!spreadsheetId) {
    throw new Error('В свойствах служебного скрипта не задан SPREADSHEET_ID.');
  }

  var spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  var productSheet = spreadsheet.getSheetByName('Товары');
  var categorySheet = spreadsheet.getSheetByName('Справочники');
  if (!productSheet || !categorySheet) {
    throw new Error('Не найдены листы «Товары» и/или «Справочники». Сначала выполните setupCatalogTemplate.');
  }

  var values = productSheet.getDataRange().getValues();
  if (!values || values.length === 0) {
    return setupLogValidation_(['Лист «Товары» не содержит заголовков.']);
  }

  var indexes = Object.create(null);
  values[0].forEach(function (heading, index) {
    indexes[setupCellText_(heading)] = index;
  });
  var requiredHeaders = ['product_id', 'title', 'category', 'description', 'price_rub', 'quantity', 'photo_1_url', 'status'];
  var missingHeaders = requiredHeaders.filter(function (heading) {
    return !Object.prototype.hasOwnProperty.call(indexes, heading);
  });
  if (missingHeaders.length) {
    return setupLogValidation_(['Отсутствуют обязательные заголовки: ' + missingHeaders.join(', ')]);
  }

  var categoryValues = categorySheet.getDataRange().getValues().slice(1);
  var categories = Object.create(null);
  categoryValues.forEach(function (row) {
    var category = setupCellText_(row[0]);
    if (category) categories[category] = true;
  });

  var rows = values.slice(1);
  var idCounts = Object.create(null);
  rows.forEach(function (row) {
    var id = setupCellText_(row[indexes.product_id]);
    if (/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) {
      idCounts[id] = (idCounts[id] || 0) + 1;
    }
  });

  var errors = [];
  var allowedStatuses = ['Черновик', 'В наличии', 'Зарезервирован', 'Продан', 'Скрыт'];
  rows.forEach(function (row, offset) {
    var rowNumber = offset + 2;
    var status = setupCellText_(row[indexes.status]);
    var hasContent = row.some(function (value) { return setupCellText_(value) !== ''; });
    if (!hasContent) return;

    if (allowedStatuses.indexOf(status) === -1) {
      errors.push('Строка ' + rowNumber + ': неизвестный или пустой статус.');
      return;
    }

    var id = setupCellText_(row[indexes.product_id]);
    if (id && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id)) {
      errors.push('Строка ' + rowNumber + ': product_id должен содержать латинские буквы, цифры, дефис или подчёркивание.');
    } else if (id && idCounts[id] > 1) {
      errors.push('Строка ' + rowNumber + ': product_id «' + id + '» повторяется.');
    }

    if (status === 'Черновик' || status === 'Скрыт' || status === 'Продан') return;
    if (!id) errors.push('Строка ' + rowNumber + ': для публикации нужен product_id.');
    if (!setupCellText_(row[indexes.title])) errors.push('Строка ' + rowNumber + ': не заполнено название.');
    if (!setupCellText_(row[indexes.category])) {
      errors.push('Строка ' + rowNumber + ': не заполнена категория.');
    } else if (Object.keys(categories).length && !categories[setupCellText_(row[indexes.category])]) {
      errors.push('Строка ' + rowNumber + ': категория отсутствует в листе «Справочники»; на витрине товар попадёт в «Другое».');
    }
    if (!setupCellText_(row[indexes.description])) errors.push('Строка ' + rowNumber + ': не заполнено описание.');

    var price = row[indexes.price_rub];
    if (!(typeof price === 'number' && isFinite(price) && price >= 0)) {
      errors.push('Строка ' + rowNumber + ': price_rub должна быть числом от 0 и выше.');
    }
    var quantity = row[indexes.quantity];
    if (!(typeof quantity === 'number' && isFinite(quantity) && quantity >= 0 && Math.floor(quantity) === quantity)) {
      errors.push('Строка ' + rowNumber + ': quantity должна быть целым числом от 0 и выше.');
    }
    if (!setupIsPublicImageUrl_(row[indexes.photo_1_url])) {
      errors.push('Строка ' + rowNumber + ': основное фото должно быть доступно по HTTPS-ссылке.');
    }
  });

  return setupLogValidation_(errors);
}

function setupIsPublicImageUrl_(value) {
  var url = setupCellText_(value);
  if (!/^https:\/\/[^\s]+$/i.test(url)) return false;
  var hostMatch = url.match(/^https:\/\/([^/?#]+)/i);
  var host = hostMatch ? hostMatch[1].toLowerCase() : '';
  if (host === 'drive.google.com' || host === 'www.drive.google.com') {
    return /\/file\/d\/[A-Za-z0-9_-]+/i.test(url) || /[?&]id=[A-Za-z0-9_-]+/i.test(url);
  }
  return true;
}

function setupLogValidation_(errors) {
  var message = errors.length
    ? 'Проверка завершена. Найдено проблем: ' + errors.length + '\n' + errors.join('\n')
    : 'Проверка завершена: ошибок в каталоге не обнаружено.';
  console.log(message);
  return { ok: errors.length === 0, errors: errors };
}
