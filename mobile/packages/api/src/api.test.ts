// Unit tests always run. The contract tests call the staging backend and run only with FONZKART_LIVE_API=1
// (they check the response shapes the apps rely on, against real data).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl } from './client';
import { catalogApi, healthApi } from './catalog';

test('buildUrl encodes values and skips empty ones', () => {
  assert.equal(buildUrl('https://api', '/x'), 'https://api/x');
  assert.equal(buildUrl('https://api', '/x', { a: 'iphone 14', b: undefined, c: '' }), 'https://api/x?a=iphone%2014');
  assert.equal(buildUrl('https://api', '/x', { brandId: 'apple', category: 'smartphone' }), 'https://api/x?brandId=apple&category=smartphone');
});

test('searchModels does not call the server for short queries', async () => {
  assert.deepEqual(await catalogApi.searchModels(' i '), []);
});

describe('staging catalog contract', { skip: process.env.FONZKART_LIVE_API !== '1' }, () => {
  test('server is up', async () => {
    assert.equal((await healthApi.status()).status, 'UP');
  });

  test('smartphone brands include Apple with categories', async () => {
    const brands = await catalogApi.brands('smartphone');
    const apple = brands.find(b => b.id === 'apple');
    assert.ok(apple, 'apple listed');
    assert.ok(Array.isArray(apple.categories));
    assert.equal((await catalogApi.brand('apple')).name, apple.name);
  });

  test('brand -> models -> variants', async () => {
    const models = await catalogApi.models('apple', 'smartphone');
    const model = models.find(m => m.name === 'iPhone 14 Pro');
    assert.ok(model, 'iPhone 14 Pro listed');
    assert.match(model.img ?? '', /^\/models\/apple\//i);
    const variants = await catalogApi.variants(model.id);
    assert.ok(variants.length > 0);
    for (const v of variants) {
      assert.equal(v.modelId, model.id);
      assert.equal(typeof v.basePrice, 'number');
    }
  });

  test('search finds models across brands', async () => {
    const found = await catalogApi.searchModels('iphone 14');
    assert.ok(found.some(m => m.brandId === 'apple' && m.name.startsWith('iPhone 14')));
  });
});
