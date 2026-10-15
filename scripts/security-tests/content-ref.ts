// Executes backend/src/test/resources/golden/content-scenario.json (catalog and banner-price editing) against the
// website code and writes the expected outcome that ContentScenarioParityTest replays against Spring Boot.
//   tsx scripts/security-tests/content-ref.ts <scenario.json> <expected.json>
import { readFileSync, writeFileSync } from 'node:fs';
import * as admin from '@/actions/admin';
import * as auth from '@/actions/auth';
import { as, form, prisma } from './harness';

const KNOWN_THROWN = ['Unauthorized', 'Forbidden: Admin access required'];
const plain = (v: any) => (v === undefined ? null : JSON.parse(JSON.stringify(v)));

async function resolve(v: any): Promise<any> {
  if (Array.isArray(v)) return Promise.all(v.map(resolve));
  if (v && typeof v === 'object') {
    const out: any = {};
    for (const [k, x] of Object.entries(v)) out[k] = await resolve(x);
    return out;
  }
  if (typeof v === 'string' && v.startsWith('$model:')) return (await prisma.model.findFirst({ where: { name: v.slice(7) } }))?.id ?? 'NO-ID';
  if (typeof v === 'string' && v.startsWith('$variant:')) {
    const [model, variant] = v.slice(9).split('/');
    return (await prisma.variant.findFirst({ where: { name: variant, model: { name: model } } }))?.id ?? 'NO-ID';
  }
  if (typeof v === 'string' && v.startsWith('$banner:')) return (await prisma.deviceDisplayPrice.findFirst({ where: { categoryKey: v.slice(8) } }))?.id ?? 'NO-ID';
  return v;
}

/** The catalog rows this scenario touches (brands acme-*, zeta), labelled by name instead of random ids. */
export async function snapshot() {
  const brands = await prisma.brand.findMany({ where: { OR: [{ id: { startsWith: 'acme' } }, { id: 'zeta' }] }, orderBy: { id: 'asc' } });
  const models = await prisma.model.findMany({ where: { brandId: { in: brands.map(b => b.id) } }, orderBy: { name: 'asc' } });
  const modelName = new Map(models.map(m => [m.id, m.name]));
  const variants = await prisma.variant.findMany({ where: { modelId: { in: models.map(m => m.id) } } });
  return {
    brands: brands.map(b => ({ id: b.id, name: b.name, logo: b.logo, categories: b.categories, priority: b.priority })),
    models: models.map(m => ({ brandId: m.brandId, name: m.name, img: m.img, category: m.category, priority: m.priority })),
    variants: variants.map(v => ({ model: modelName.get(v.modelId), name: v.name, basePrice: v.basePrice }))
      .sort((a, b) => `${a.model}/${a.name}`.localeCompare(`${b.model}/${b.name}`)),
    bannerPrices: (await prisma.deviceDisplayPrice.findMany({ orderBy: { categoryKey: 'asc' } }))
      .map(p => ({ categoryKey: p.categoryKey, categoryName: p.categoryName, displayPrice: p.displayPrice })),
  };
}

async function invoke(action: string, i: any) {
  switch (action) {
    case 'signin': return auth.signin(null, form(i));
    case 'addBrand': return admin.addBrand(i.name, i.logo, i.category, i.priority);
    case 'updateBrand': return admin.updateBrand(i.id, i.name, i.logo, i.priority);
    case 'deleteBrand': return admin.deleteBrand(i.id, i.category);
    case 'addModel': return admin.addModel(i.brandId, i.name, i.img, i.category, i.priority);
    case 'updateModel': return admin.updateModel(i.id, i.brandId, i.name, i.img, i.category, i.priority);
    case 'reorderModels': return admin.reorderModels(i.items);
    case 'deleteModel': return admin.deleteModel(i.id);
    case 'addVariant': return admin.addVariant(i.modelId, i.name, i.basePrice);
    case 'updateVariant': return admin.updateVariant(i.id, i.modelId, i.name, i.basePrice);
    case 'deleteVariant': return admin.deleteVariant(i.id);
    case 'getDeviceDisplayPrices':
      return (await admin.getDeviceDisplayPrices()).map(p => ({ categoryKey: p.categoryKey, categoryName: p.categoryName, displayPrice: p.displayPrice }));
    case 'updateDeviceDisplayPrice': {
      // Compared by its success flag: the returned item comes from the website's backup file, which the backend has not.
      const r = await admin.updateDeviceDisplayPrice(i.id, i.displayPrice, i.categoryKey, i.categoryName);
      return { success: r.success };
    }
    case 'snapshot': return snapshot();
    default: throw new Error('unknown action ' + action);
  }
}

/** New ids are random: models and variants are compared without them; brand ids come from names and are kept. */
function normalize(action: string, v: any) {
  if (v && typeof v === 'object' && !Array.isArray(v) && typeof v.id === 'string' && ['addModel', 'addVariant'].includes(action)) {
    return { ...v, id: '<new-id>' };
  }
  return v;
}

async function main() {
  const scenario = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const results: any[] = [];
  for (const step of scenario.steps) {
    as(step.actor);
    const input = await resolve(step.input);
    let outcome: any;
    try {
      outcome = { returned: normalize(step.action, plain(await invoke(step.action, input))) };
    } catch (e: any) {
      if (e?.digest === 'NEXT_REDIRECT') outcome = { redirect: e.url };
      else outcome = { thrown: KNOWN_THROWN.includes(e?.message) ? e.message : '<server-error>' };
    }
    results.push({ step: `${step.actor}:${step.action}`, outcome });
  }
  writeFileSync(process.argv[3], JSON.stringify({ steps: results, snapshot: await snapshot() }, null, 1) + '\n');
  console.log('steps:', results.length);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
