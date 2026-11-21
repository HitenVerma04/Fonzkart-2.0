import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupSeries } from './series';

const list = (names: string[]) => names.map((name, i) => ({ id: String(i), name }));
const labels = (brand: string, names: string[]) => groupSeries(brand, list(names)).map(s => `${s.label}: ${s.modelIds.length}`);

test('Realme models fall into numbered, lettered and named series, in catalog order', () => {
  assert.deepEqual(labels('Realme', ['Realme 2 Pro', 'Realme C1 2019', 'Realme C1', 'Realme 2', 'Realme Narzo 50', 'Realme Narzo 60 Pro 5G',
    'Realme GT Neo 3', 'Realme 10 Pro+', 'Realme X7']), [
    'Realme 2 Series: 2', 'Realme C Series: 2', 'Realme Narzo Series: 2', 'Realme GT Series: 1', 'Realme 10 Series: 1', 'Realme X Series: 1',
  ]);
});

test('a first word every model shares is refined by the next one', () => {
  assert.deepEqual(labels('Apple', ['iPhone 15 Pro Max', 'iPhone 15', 'iPhone 14 Plus', 'iPhone SE 2022', 'iPhone 14']),
    ['iPhone 15 Series: 2', 'iPhone 14 Series: 2', 'iPhone SE Series: 1']);
  assert.deepEqual(labels('Samsung', ['Samsung Galaxy S23 Ultra', 'Samsung Galaxy A54', 'Galaxy S22', 'Samsung Galaxy M34 5G', 'Samsung Galaxy Z Fold 5']),
    ['Galaxy S Series: 2', 'Galaxy A Series: 1', 'Galaxy M Series: 1', 'Galaxy Z Series: 1']);
  assert.deepEqual(labels('Google', ['Google Pixel 8 Pro', 'Pixel 7a', 'Pixel 7', 'Pixel 6a']),
    ['Pixel 8 Series: 1', 'Pixel 7 Series: 2', 'Pixel 6 Series: 1']);
});

test('nothing to choose between gives no series', () => {
  assert.deepEqual(groupSeries('Nothing', list(['Nothing Phone 1'])), []);
  assert.deepEqual(groupSeries('Apple', list(['iPhone', 'iPhone'])), []);
});

test('one series per name, and stray names join the brand-wide series they name', () => {
  assert.deepEqual(labels('Realme', ['Realme GT 2', 'Realme GT Neo 3', 'Realme GT2 Pro', 'Realme 9']), ['Realme GT Series: 3', 'Realme 9 Series: 1']);
  assert.deepEqual(labels('Samsung', ['Samsung Galaxy A54', 'Samsung Galaxy S23', 'Samsung Galaxy M34', 'Samsung A05', 'Samsung Galaxy A14']),
    ['Galaxy A Series: 3', 'Galaxy S Series: 1', 'Galaxy M Series: 1']);
  assert.deepEqual(labels('Xiaomi', ['Redmi 15', 'Redmi Note 13', 'Redmi 13', 'Xiaomi 15', 'Redmi A3']),
    ['Redmi 15 Series: 1', 'Redmi Note Series: 1', 'Redmi 13 Series: 1', 'Xiaomi 15 Series: 1', 'Redmi A Series: 1']);
});
