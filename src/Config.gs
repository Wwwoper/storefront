/** Server-side configuration. Never send Script Properties to the browser. */
function getAppConfig_() {
  var properties = PropertiesService.getScriptProperties();
  var spreadsheetId = String(properties.getProperty('SPREADSHEET_ID') || '').trim();

  if (!spreadsheetId) {
    throw new Error('В свойствах скрипта не задан SPREADSHEET_ID.');
  }

  return {
    spreadsheetId: spreadsheetId,
    productsSheetName: 'Товары',
    categoriesSheetName: 'Справочники',
    settingsSheetName: 'Настройки'
  };
}

/** Return a string cell value without coercing null/undefined to their names. */
function cellText_(value) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

/** Convert a raw boolean-like setting to a strict boolean. */
function settingIsEnabled_(value) {
  return cellText_(value).toLowerCase() === 'true';
}

/** Accept only HTTPS URLs for public links. */
function safeHttpsUrl_(value) {
  var url = cellText_(value);
  // Require a hostname and reject whitespace, credentials, and non-HTTPS schemes.
  // The URL is later assigned to an anchor's href property, never interpolated into HTML.
  if (!/^https:\/\/[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?(?::\d{1,5})?(?:[/?#][^\s]*)?$/i.test(url)) {
    return '';
  }
  return url;
}

/** Google Forms links are only accepted from the official Forms host. */
function safeGoogleFormUrl_(value) {
  var url = safeHttpsUrl_(value);
  if (!/^https:\/\/docs\.google\.com\/forms\//i.test(url)) {
    return '';
  }
  return url;
}

/** Return only allow-listed settings, never the whole Settings sheet. */
function makePublicSettings_(rows) {
  var values = {};
  rows.forEach(function (row) {
    var key = cellText_(row[0]);
    if (key) {
      values[key] = row.length > 1 ? row[1] : '';
    }
  });

  var telegramUsername = cellText_(values.seller_telegram_username).replace(/^@/, '');
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(telegramUsername)) {
    telegramUsername = '';
  }

  var formUrl = safeGoogleFormUrl_(values.google_form_url);
  var productIdEntry = cellText_(values.google_form_product_id_entry);
  var productUrlEntry = cellText_(values.google_form_product_url_entry);
  if (!/^\d+$/.test(productIdEntry)) {
    productIdEntry = '';
  }
  if (!/^\d+$/.test(productUrlEntry)) {
    productUrlEntry = '';
  }
  // A form without the product-id field cannot create a useful prefilled request.
  if (!formUrl || !productIdEntry) {
    formUrl = '';
    productIdEntry = '';
    productUrlEntry = '';
  }

  var communityLinks = [];
  [
    { key: 'community_telegram_url', label: 'Telegram' },
    { key: 'community_max_url', label: 'MAX' },
    { key: 'community_vk_url', label: 'ВКонтакте' }
  ].forEach(function (definition) {
    var url = safeHttpsUrl_(values[definition.key]);
    if (url) {
      communityLinks.push({ label: definition.label, url: url });
    }
  });

  var extraCommunityUrl = safeHttpsUrl_(values.community_extra_url);
  if (extraCommunityUrl) {
    var extraCommunityLabel = cellText_(values.community_extra_label).slice(0, 60);
    communityLinks.push({
      label: extraCommunityLabel || 'Дополнительный источник',
      url: extraCommunityUrl
    });
  }

  return {
    storeTitle: cellText_(values.store_title) || 'Мои вещи',
    storeDescription: cellText_(values.store_description),
    sellerTelegramUsername: telegramUsername,
    sellerContactNote: cellText_(values.seller_contact_note),
    maxEnabled: settingIsEnabled_(values.max_enabled),
    googleFormUrl: formUrl,
    googleFormProductIdEntry: productIdEntry,
    googleFormProductUrlEntry: productUrlEntry,
    deliveryNote: cellText_(values.delivery_note),
    communitySectionTitle: cellText_(values.community_section_title).slice(0, 80) || 'Мы также здесь',
    communityLinks: communityLinks
  };
}
