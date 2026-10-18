import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';

const clientHtml = readFileSync(new URL('../src/Client.html', import.meta.url), 'utf8');
const stylesHtml = readFileSync(new URL('../src/Styles.html', import.meta.url), 'utf8');

test('product card uses up to three non-empty photo URLs for the gallery', () => {
  assert.match(clientHtml, /product\.photos\.filter\(function \(url\) \{ return typeof url === 'string' && url\.trim\(\); \}\)/);
  assert.match(clientHtml, /\.slice\(0, 3\)/);
  assert.match(clientHtml, /if \(photoUrls\.length\) createProductGallery\(media, photoUrls, product\.title\)/);
});

test('gallery has accessible previous/next buttons and selectable thumbnails', () => {
  assert.match(clientHtml, /aria-label', 'Предыдущая фотография'/);
  assert.match(clientHtml, /aria-label', 'Следующая фотография'/);
  assert.match(clientHtml, /aria-label', 'Показать фотографию ' \+ \(index \+ 1\)/);
  assert.match(clientHtml, /aria-pressed', String\(index === currentIndex\)/);
  assert.match(clientHtml, /setActivePhoto\(currentIndex - 1\)/);
  assert.match(clientHtml, /setActivePhoto\(currentIndex \+ 1\)/);
  assert.match(clientHtml, /setActivePhoto\(index\)/);
});

test('single-photo products hide gallery controls and gallery styles support mobile cards', () => {
  assert.match(clientHtml, /var hasMultiplePhotos = photoUrls\.length > 1/);
  assert.match(clientHtml, /previousButton\.hidden = !hasMultiplePhotos/);
  assert.match(clientHtml, /nextButton\.hidden = !hasMultiplePhotos/);
  assert.match(clientHtml, /thumbnails\.hidden = !hasMultiplePhotos/);
  assert.match(stylesHtml, /\.product-gallery-arrow/);
  assert.match(stylesHtml, /\.product-gallery-thumbnails/);
  assert.match(stylesHtml, /\.product-gallery-thumbnail\.is-active/);
});
