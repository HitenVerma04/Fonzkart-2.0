import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSeries } from './series';

const list = (names: string[]) => names.map((name, i) => ({ id: String(i), name }));
const labels = (brand: string, names: string[]) => groupSeries(brand, list(names)).map(s => `${s.label}: ${s.modelIds.length}`);

test('Realme models fall into numbered, lettered and named series, in catalog order, shown short', () => {
  assert.deepEqual(labels('Realme', ['Realme 2 Pro', 'Realme C1 2019', 'Realme C1', 'Realme 2', 'Realme Narzo 50', 'Realme Narzo 60 Pro 5G',
    'Realme GT Neo 3', 'Realme 10 Pro+', 'Realme X7']), [
    '2: 2', 'C: 2', 'Narzo: 2', 'GT: 1', '10: 1', 'X: 1',
  ]);
});

test('a first word every model shares is refined by the next one, and only that part is shown', () => {
  assert.deepEqual(labels('Apple', ['iPhone 17 Pro', 'iPhone 16', 'iPhone 15 Pro Max', 'iPhone 15', 'iPhone 14 Plus', 'iPhone SE 2022', 'iPhone 14']),
    ['17: 1', '16: 1', '15: 2', '14: 2', 'SE: 1']);
  assert.deepEqual(labels('Samsung', ['Samsung Galaxy S23 Ultra', 'Samsung Galaxy A54', 'Galaxy S22', 'Samsung Galaxy M34 5G', 'Samsung Galaxy Z Fold 5']),
    ['S: 2', 'A: 1', 'M: 1', 'Z: 1']);
  assert.deepEqual(labels('Google', ['Google Pixel 8 Pro', 'Pixel 7a', 'Pixel 7', 'Pixel 6a']), ['8: 1', '7: 2', '6: 1']);
});

test('nothing to choose between gives no series', () => {
  assert.deepEqual(groupSeries('Nothing', list(['Nothing Phone 1'])), []);
  assert.deepEqual(groupSeries('Apple', list(['iPhone', 'iPhone'])), []);
});

test('one series per name; stray names join the brand-wide series; two that would read the same keep the longer name', () => {
  assert.deepEqual(labels('Realme', ['Realme GT 2', 'Realme GT Neo 3', 'Realme GT2 Pro', 'Realme 9']), ['GT: 3', '9: 1']);
  assert.deepEqual(labels('Samsung', ['Samsung Galaxy A54', 'Samsung Galaxy S23', 'Samsung Galaxy M34', 'Samsung A05', 'Samsung Galaxy A14']),
    ['A: 3', 'S: 1', 'M: 1']);
  assert.deepEqual(labels('Xiaomi', ['Redmi 15', 'Redmi Note 13', 'Redmi 13', 'Xiaomi 15', 'Redmi A3']),
    ['Redmi 15: 1', 'Note: 1', '13: 1', 'Xiaomi 15: 1', 'A: 1']);
});
