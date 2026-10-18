/** Serves the public storefront. The endpoint is read-only. */
function doGet() {
  var template = HtmlService.createTemplateFromFile('Index');
  // Use the canonical deployed URL for product links. The browser's location
  // may point to Apps Script's userCodeAppPanel iframe instead of the /exec URL.
  template.webAppUrl = ScriptApp.getService().getUrl() || '';
  return template.evaluate()
    .setTitle('Моя витрина')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/** Allows HTML templates to include another Apps Script HTML file. */
function include_(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Public RPC endpoint called by the browser with google.script.run.
 * Only explicitly selected public fields are returned to anonymous visitors.
 */
function getStorefrontData() {
  try {
    var config = getAppConfig_();
    var spreadsheet = SpreadsheetApp.openById(config.spreadsheetId);
    var rawSettings = readSettingsRows_(spreadsheet, config.settingsSheetName);
    var settings = makePublicSettings_(rawSettings);
    var categories = readCategories_(spreadsheet, config.categoriesSheetName);
    var productsResult = readPublishedProducts_(spreadsheet, config.productsSheetName, categories);
    var products = productsResult.products;

    // Include only categories that can be selected in the public catalogue.
    products.forEach(function (product) {
      if (categories.indexOf(product.category) === -1) {
        categories.push(product.category);
      }
    });
    categories.sort(function (left, right) {
      return left.localeCompare(right, 'ru');
    });

    return {
      ok: true,
      generatedAt: new Date().toISOString(),
      settings: settings,
      categories: categories,
      products: products
    };
  } catch (error) {
    // Details are kept in Apps Script logs; never return spreadsheet IDs or stack traces.
    console.error('getStorefrontData failed: ' + String(error && error.message ? error.message : error));
    return {
      ok: false,
      message: 'Не удалось загрузить каталог. Попробуйте обновить страницу позже.'
    };
  }
}
