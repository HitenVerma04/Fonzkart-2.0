import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInr } from './format';
import { imageUrl, modelImage } from './images';

test('formatInr uses Indian grouping', () => {
  assert.equal(formatInr(0), '₹0');
  assert.equal(formatInr(999), '₹999');
  assert.equal(formatInr(51239), '₹51,239');
  assert.equal(formatInr(123456), '₹1,23,456');
  assert.equal(formatInr(12345678), '₹1,23,45,678');
  assert.equal(formatInr(1234.6), '₹1,235');
});

test('modelImage drops phone photos standing in for other devices', () => {
  assert.equal(modelImage('/models/samsung/Samsung_Galaxy_S25_Ultra.png', 'watch'), null);
  assert.equal(modelImage('/models/samsung/Samsung_Galaxy_S25_Ultra.png', 'smartwatch'), null);
  assert.equal(modelImage('/models/samsung/Samsung_Galaxy_S25_Ultra.png', 'tablet'), null);
  assert.equal(modelImage('/models/samsung/Samsung_Galaxy_S25_Ultra.png', 'smartphone'), '/models/samsung/Samsung_Galaxy_S25_Ultra.png');
  assert.equal(modelImage('/models/samsung/Samsung_Galaxy_S25_Ultra.png', 'mobile'), '/models/samsung/Samsung_Galaxy_S25_Ultra.png');
  assert.equal(modelImage('/models/samsung/Samsung_Galaxy_S25_Ultra.png', undefined), '/models/samsung/Samsung_Galaxy_S25_Ultra.png');
  assert.equal(modelImage('/models/apple-smartwatch/APPLE_SE.png', 'watch'), '/models/apple-smartwatch/APPLE_SE.png');
  assert.equal(modelImage('/models/samsung-tablet/Tab_S9.png', 'tablet'), '/models/samsung-tablet/Tab_S9.png');
  assert.equal(modelImage('https://s3ng.cashify.in/x.jpg', 'watch'), 'https://s3ng.cashify.in/x.jpg');
  assert.equal(modelImage('/uploads/x.png', 'watch'), '/uploads/x.png');
  assert.equal(modelImage('  ', 'watch'), null);
  assert.equal(modelImage(null, 'watch'), null);
});

test('imageUrl resolves website paths and keeps full URLs', () => {
  const web = 'https://web.example';
  assert.equal(imageUrl('/models/apple/x.png', web), 'https://web.example/models/apple/x.png');
  assert.equal(imageUrl('uploads/x.png', web), 'https://web.example/uploads/x.png');
  assert.equal(imageUrl('https://cdn.example/a.jpg', web), 'https://cdn.example/a.jpg');
  assert.equal(imageUrl('//cdn.example/a.jpg', web), 'https://cdn.example/a.jpg');
  assert.equal(imageUrl('data:image/png;base64,AA', web), 'data:image/png;base64,AA');
  assert.equal(imageUrl('', web), null);
  assert.equal(imageUrl(null, web), null);
});
