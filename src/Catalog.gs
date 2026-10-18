var PUBLIC_PRODUCT_STATUSES_ = ['В наличии', 'Зарезервирован'];
var HIDDEN_PRODUCT_STATUSES_ = ['Черновик', 'Скрыт', 'Продан'];

/** Read the data rows from a named sheet. Row one is always treated as header. */
function readSheetRows_(spreadsheet, sheetName) {
  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Не найден обязательный лист: ' + sheetName);
  }

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return [];
  }
  return values.slice(1);
}

function readSettingsRows_(spreadsheet, sheetName) {
  return readSheetRows_(spreadsheet, sheetName);
}

function readCategories_(spreadsheet, sheetName) {
  var rows = readSheetRows_(spreadsheet, sheetName);
  var seen = Object.create(null);
  var categories = [];

  rows.forEach(function (row) {
    var category = cellText_(row[0]);
    if (category && category.toLowerCase() !== 'категория' && !seen[category]) {
      seen[category] = true;
      categories.push(category);
    }
  });
  return categories;
}

function headerIndexes_(headerRow) {
  var indexes = Object.create(null);
  headerRow.forEach(function (heading, index) {
    indexes[cellText_(heading)] = index;
  });
  return indexes;
}

function valueFromRow_(row, indexes, name) {
  if (!Object.prototype.hasOwnProperty.call(indexes, name)) {
    return '';
  }
  return row[indexes[name]];
}

function validProductId_(value) {
  var id = cellText_(value);
  // IDs are used in anchor links and must be stable, simple URL fragments.
  return /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(id) ? id : '';
}

function nonNegativeNumber_(value) {
  if (typeof value === 'number') {
    return isFinite(value) && value >= 0 ? value : null;
  }
  var text = cellText_(value);
  if (!text || !/^(?:\d+\.?\d*|\.\d+)$/.test(text)) {
    return null;
  }
  var number = Number(text);
  return isFinite(number) && number >= 0 ? number : null;
}

function nonNegativeInteger_(value) {
  var number = nonNegativeNumber_(value);
  return number !== null && Math.floor(number) === number ? number : null;
}

function integerValue_(value) {
  if (typeof value === 'number') {
    return isFinite(value) && Math.floor(value) === value ? value : null;
  }
  var text = cellText_(value);
  if (!text || !/^-?\d+$/.test(text)) {
    return null;
  }
  var number = Number(text);
  return isFinite(number) && Math.floor(number) === number ? number : null;
}

/**
 * Accept HTTPS image links only. Drive sharing URLs are normalized to the
 * thumbnail endpoint because /uc?export=view can fail when embedded in an img.
 * The owner must still enable public viewing and verify it in a logged-out browser.
 */
function publicImageUrl_(value) {
  var input = cellText_(value);
  if (!input || !/^https:\/\/[^\s]+$/i.test(input)) {
    return '';
  }

  var hostMatch = input.match(/^https:\/\/([^/?#]+)/i);
  var host = hostMatch ? hostMatch[1].toLowerCase() : '';
  if (host === 'drive.google.com' || host === 'www.drive.google.com') {
    var pathMatch = input.match(/\/file\/d\/([A-Za-z0-9_-]+)/i);
    var queryMatch = input.match(/[?&]id=([A-Za-z0-9_-]+)/i);
    var fileId = pathMatch ? pathMatch[1] : (queryMatch ? queryMatch[1] : '');
    if (!fileId) {
      return '';
    }
    return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(fileId) + '&sz=w1000';
  }
  return input;
}

function readPublishedProducts_(spreadsheet, sheetName, allowedCategories) {
  if (!Array.isArray(allowedCategories)) {
    var config = getAppConfig_();
    allowedCategories = readCategories_(spreadsheet, config.categoriesSheetName);
  }
  var categoryLookup = Object.create(null);
  allowedCategories.forEach(function (category) { categoryLookup[category] = true; });

  var sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Не найден обязательный лист: ' + sheetName);
  }

  var values = sheet.getDataRange().getValues();
  if (!values || values.length < 2) {
    return { products: [], errors: [] };
  }

  var indexes = headerIndexes_(values[0]);
  var requiredHeaders = [
    'product_id', 'title', 'category', 'description', 'price_rub',
    'quantity', 'photo_1_url', 'status'
  ];
  var missingHeaders = requiredHeaders.filter(function (name) {
    return !Object.prototype.hasOwnProperty.call(indexes, name);
  });
  if (missingHeaders.length) {
    throw new Error('В листе «' + sheetName + '» отсутствуют заголовки: ' + missingHeaders.join(', '));
  }

  var rows = values.slice(1);
  var idCounts = Object.create(null);
  rows.forEach(function (row) {
    var id = validProductId_(valueFromRow_(row, indexes, 'product_id'));
    if (id) {
      idCounts[id] = (idCounts[id] || 0) + 1;
    }
  });

  var products = [];
  var errors = [];
  rows.forEach(function (row, rowOffset) {
    var sheetRow = rowOffset + 2;
    var rawStatus = cellText_(valueFromRow_(row, indexes, 'status'));
    if (HIDDEN_PRODUCT_STATUSES_.indexOf(rawStatus) !== -1 || !rawStatus) {
      return;
    }
    if (PUBLIC_PRODUCT_STATUSES_.indexOf(rawStatus) === -1) {
      errors.push('Строка ' + sheetRow + ': неизвестный статус «' + rawStatus + '».');
      return;
    }

    var id = validProductId_(valueFromRow_(row, indexes, 'product_id'));
    if (!id) {
      errors.push('Строка ' + sheetRow + ': product_id пустой или имеет недопустимый формат.');
      return;
    }
    if (idCounts[id] > 1) {
      errors.push('Строка ' + sheetRow + ': product_id «' + id + '» повторяется; все строки с таким кодом скрыты.');
      return;
    }

    var title = cellText_(valueFromRow_(row, indexes, 'title'));
    var rawCategory = cellText_(valueFromRow_(row, indexes, 'category'));
    var category = rawCategory;
    var description = cellText_(valueFromRow_(row, indexes, 'description'));
    var price = nonNegativeNumber_(valueFromRow_(row, indexes, 'price_rub'));
    var quantity = nonNegativeInteger_(valueFromRow_(row, indexes, 'quantity'));
    var primaryPhoto = publicImageUrl_(valueFromRow_(row, indexes, 'photo_1_url'));

    var missing = [];
    if (!title) missing.push('title');
    if (!rawCategory) missing.push('category');
    if (!description) missing.push('description');
    if (price === null) missing.push('price_rub');
    if (quantity === null) missing.push('quantity');
    if (!primaryPhoto) missing.push('photo_1_url');
    if (missing.length) {
      errors.push('Строка ' + sheetRow + ': некорректны обязательные поля: ' + missing.join(', ') + '.');
      return;
    }

    if (rawCategory && allowedCategories.length && !categoryLookup[rawCategory]) {
      errors.push('Строка ' + sheetRow + ': категория «' + rawCategory + '» отсутствует в справочнике; товар показан в «Другое».');
      category = 'Другое';
    }

    var sortOrder = integerValue_(valueFromRow_(row, indexes, 'sort_order'));
    var extraPhotos = [];
    ['photo_2_url', 'photo_3_url'].forEach(function (field) {
      var photo = publicImageUrl_(valueFromRow_(row, indexes, field));
      if (photo) extraPhotos.push(photo);
    });

    products.push({
      id: id,
      title: title,
      category: category,
      description: description,
      priceRub: price,
      quantity: quantity,
      sizeOrVariant: cellText_(valueFromRow_(row, indexes, 'size_or_variant')),
      condition: cellText_(valueFromRow_(row, indexes, 'condition')),
      photos: [primaryPhoto].concat(extraPhotos),
      status: rawStatus,
      availabilityLabel: rawStatus === 'Зарезервирован' ? 'Зарезервирован' : (quantity > 0 ? 'В наличии' : 'Нет в наличии'),
      sortOrder: sortOrder === null ? Number.MAX_SAFE_INTEGER : sortOrder,
      _rowOrder: rowOffset
    });
  });

  products.sort(function (left, right) {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    var titleComparison = left.title.localeCompare(right.title, 'ru');
    if (titleComparison !== 0) return titleComparison;
    return left._rowOrder - right._rowOrder;
  });

  // Internal sorting helpers are not part of the public API.
  products = products.map(function (product) {
    return {
      id: product.id,
      title: product.title,
      category: product.category,
      description: product.description,
      priceRub: product.priceRub,
      quantity: product.quantity,
      sizeOrVariant: product.sizeOrVariant,
      condition: product.condition,
      photos: product.photos,
      status: product.status,
      availabilityLabel: product.availabilityLabel
    };
  });

  return { products: products, errors: errors };
}
