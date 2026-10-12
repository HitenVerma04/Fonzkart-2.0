import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatInr } from './format';
import { imageUrl } from './images';

test('formatInr uses Indian grouping', () => {
  assert.equal(formatInr(0), '₹0');
  assert.equal(formatInr(999), '₹999');
  assert.equal(formatInr(51239), '₹51,239');
  assert.equal(formatInr(123456), '₹1,23,456');
  assert.equal(formatInr(12345678), '₹1,23,45,678');
  assert.equal(formatInr(1234.6), '₹1,235');
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
