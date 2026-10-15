// Unit tests always run. The contract tests call the staging backend and run only with FONZKART_LIVE_API=1
// (they check the response shapes the apps rely on, against real data).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildUrl } from './client';
import { catalogApi, healthApi } from './catalog';
import { authOutcome } from './auth';
import { tokenUser } from './session';
import { quoteApi } from './quote';

test('sign-in responses map to the next screen', () => {
  const res = (data: object | null, authToken: string | null = null) => ({ data, authToken });
  assert.deepEqual(authOutcome(res({ redirectTo: '/' }, 'tok'), 'a@b.in'), { kind: 'signedIn', token: 'tok' });
  assert.deepEqual(authOutcome(res({ redirectTo: '/admin' }, 'tok'), 'a@b.in'), { kind: 'signedIn', token: 'tok' });
  assert.deepEqual(authOutcome(res({ redirectTo: '/verify-email?email=r%2Bx%40b.in' }), '9876543210'), { kind: 'verifyEmail', email: 'r+x@b.in' });
  assert.deepEqual(authOutcome(res({ error: 'Invalid email/phone or password' }), 'x'), { kind: 'error', message: 'Invalid email/phone or password' });
  assert.equal(authOutcome(res(null), 'x').kind, 'error');
});

test('tokenUser reads an unexpired token only', () => {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const user = { id: 'u1', email: 'a@b.in', name: 'Kāvya', role: 'USER' };
  const token = (exp: number) => `${b64({ alg: 'HS256' })}.${b64({ user, exp })}.sig`;
  const now = 1_800_000_000_000;
  assert.deepEqual(tokenUser(token(now / 1000 + 60), now), user);
  assert.equal(tokenUser(token(now / 1000 - 60), now), null);
  assert.equal(tokenUser('garbage', now), null);
});

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

  test('questionnaire, price and pincode check', async () => {
    const questionnaire = await quoteApi.questionnaire();
    assert.ok(questionnaire.smartphone?.some(s => s.id === 'physical_condition'));
    const best = await quoteApi.price(51239, { physical_condition: 'flawless', body_condition: 'flawless', functional_issues: [] }, 'smartphone');
    const worse = await quoteApi.price(51239, { physical_condition: 'below_average', body_condition: 'average', functional_issues: ['camera'] }, 'smartphone');
    assert.equal(typeof best, 'number');
    assert.ok(worse! < best!, `worse condition pays less (${worse} < ${best})`);
    assert.equal(typeof await quoteApi.pincodeAvailable('600001'), 'boolean');
  });
});
