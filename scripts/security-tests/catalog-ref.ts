// Re-records backend/src/test/resources/golden/catalog-api-expected.json from the website code: every call listed in
// the existing file (e.g. getModels("samsung","Mobile"); null = argument not passed) is run again against the catalog
// seed (db/01 + db/02) and its result written under the same key, in the same order. CatalogPostgresIntegrationTest
// replays the calls against Spring Boot.
//   tsx scripts/security-tests/catalog-ref.ts <catalog-api-expected.json (input)> <output.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { db } from '@/lib/store';
import { findVariantByName, searchGlobalModels } from '@/actions/catalog';
import { prisma } from './harness';

function args(recorded: string): any[] {
  return JSON.parse('[' + recorded.slice(recorded.indexOf('(') + 1, recorded.lastIndexOf(')')) + ']');
}

async function call(recorded: string): Promise<any> {
  const kind = recorded.slice(0, recorded.indexOf('('));
  const a = args(recorded).map(x => (x === null ? undefined : x));
  switch (kind) {
    case 'getBrands': return db.getBrands(a[0]);
    case 'getBrand': return db.getBrand(a[0]);
    case 'getModels': return db.getModels(a[0], a[1]);
    case 'getVariants': return db.getVariants(a[0]);
    case 'searchGlobalModels': return searchGlobalModels(a[0]);
    case 'findVariantByName': return findVariantByName(a[0]);
    default: throw new Error('unknown call ' + recorded);
  }
}

async function main() {
  const recorded: Record<string, unknown> = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const counts = async () => [await prisma.brand.count(), await prisma.model.count(), await prisma.variant.count()].join('/');
  const before = await counts();
  const modelIdsBefore = new Set((await prisma.model.findMany({ select: { id: true } })).map(m => m.id));
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(recorded)) {
    out[key] = JSON.parse(JSON.stringify((await call(key)) ?? null));
  }
  // getModels() may persist missing 2026 models in the background; the recording is only valid if it did not.
  await new Promise(r => setTimeout(r, 3000));
  const after = await counts();
  if (before !== after) {
    const added = (await prisma.model.findMany({ include: { variants: true } })).filter(m => !modelIdsBefore.has(m.id));
    console.error(JSON.stringify(added, null, 1));
    throw new Error(`catalog rows changed during recording (${before} -> ${after}): background seeding ran (rows above)`);
  }
  writeFileSync(process.argv[3], JSON.stringify(out, null, 1) + '\n');
  console.log('calls:', Object.keys(out).length, 'brands/models/variants:', after);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
