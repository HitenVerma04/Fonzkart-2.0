// Regenerates (1) static catalog JSON for the Java backend and (2) golden test fixtures
// computed by the ORIGINAL TypeScript helpers, so Java can be tested for parity.
import { writeFileSync } from 'node:fs';
import {
    CATALOG_2026_MODELS,
    getCanonicalModelKey,
    resolveModelImage,
    deduplicateModels,
    BRAND_DEFAULT_IMAGES,
} from '/src/lib/catalog2026.ts';

// /out is mounted to backend/src (see backend/README.md).
const staticDir = '/out/main/resources/catalog';
const goldenDir = '/out/test/resources/golden';

// ---- 1. Static data -------------------------------------------------------
writeFileSync(`${staticDir}/catalog-2026.json`, JSON.stringify(CATALOG_2026_MODELS, null, 2) + '\n');
writeFileSync(`${staticDir}/brand-default-images.json`, JSON.stringify(BRAND_DEFAULT_IMAGES, null, 2) + '\n');

// ---- 2. Golden fixtures ---------------------------------------------------
const tricky = [
    '', 'iPhone 15', 'Iphone 15', 'iPhone 15 Pro', 'iPhone15', 'iPhone 15 Pro Max',
    'Galaxy S24+', 'Galaxy S24 Plus', 'Galaxy S24 Ultra', 'galaxy s24', 'Samsung Galaxy S24 5G',
    'Redmi Note 13 Pro+ 5G', 'Redmi Note 13 Pro 5G', 'Redmi Note 13 Pro', 'Mi 11X', 'Mi TV 4A 32"',
    'OnePlus Nord CE 4G', 'OnePlus 12R', 'Pixel 8a', 'Google Pixel 8 Pro', 'Z Fold-6', 'Z Flip',
    '_test', 'Ásus Zenfone', 'asus zenfone', 'Nothing Phone (2a)', 'Nothing Phone (2)',
    'Watch Series 8', 'X100', 'x100', '10T', '9 Pro', 'A-Series', 'A Series', 'Vivo X300 Pro',
    'Vivo X300 Pro 5G', 'iQOO 13 5G', 'POCO F7', 'Poco F7 5G', 'realme GT 7 Pro', '5G', '45g phone',
    'Moto G85 5G', 'Motorola Edge 50', 'Galaxy Tab S9 FE+', '  spaced  name  ', 'OPPO Reno 12',
];

const allNames = [...new Set([...CATALOG_2026_MODELS.map(m => m.name), ...tricky])];
const canonicalKeys = allNames.map(n => ({ input: n, expected: getCanonicalModelKey(n) }));

const imgSamples = [
    undefined, '', '   ', '/models/a.png', 'https://x/y.svg', 'https://x/y.svg?v=1',
    'https://upload.wikimedia.org/a.png', 'https://x/Wikipedia/a.png', 'https://x/Logo.png',
    'https://x/logo.png', 'https://fdn2.gsmarena.com/vv/bigpic/apple-iphone-13.jpg',
];
const brandSamples = ['samsung', 'SAMSUNG ', 'apple', 'unknownbrand', '', 'google', 'realme', 'poco', 'redmi', 'xiaomi'];
const nameSamples = ['Galaxy S26 Ultra 5G', 'galaxy s26 ultra', 'iPhone 13', 'Random Phone', '', 'Redmi Note 15 Pro+',
    // cross-brand look-alikes: must only match within the same brand (family)
    'iPhone 14', 'iPhone 14 Pro', 'C75 5G', 'Realme 14 Pro 5G', 'POCO F7'];
const resolveImage = [];
for (const b of brandSamples) for (const n of nameSamples) for (const i of imgSamples) {
    resolveImage.push({ brandId: b, name: n, img: i ?? null, expected: resolveModelImage(b, n, i) });
}

// Dedupe: catalog models (no variants) + synthetic DB-like models designed to collide.
const catalogAsModels = CATALOG_2026_MODELS.map(m => ({
    id: m.id, brandId: m.brandId, name: m.name, img: m.img, category: m.category, priority: m.priority,
}));
const synthetic = [
    { id: 'db-1', brandId: 'samsung', name: 'Galaxy S26 Ultra', img: 'https://x/Logo.svg', category: 'smartphone', priority: 100 },
    { id: 'db-2', brandId: 'samsung', name: 'Galaxy S26 Ultra 5G', img: '/models/x.png', category: 'smartphone', priority: 5 },
    { id: 'db-3', brandId: 'apple', name: 'iPhone 13', img: '', category: 'smartphone', priority: 100 },
    { id: 'db-4', brandId: 'apple', name: 'Apple iPhone 13', img: '/a.png', category: 'smartphone', priority: 100 },
    { id: 'db-5', brandId: 'apple', name: 'iPhone 13 5G', img: '/b.png', category: 'smartphone', priority: 100 },
    { id: 'db-6', brandId: 'misc', name: '5G', img: '/c.png', category: 'smartphone', priority: 100 },
    { id: 'db-7', brandId: 'misc', name: '5G', img: '/d.png', category: 'smartphone', priority: 50 },
    { id: 'db-8', brandId: 'xiaomi', name: 'Redmi Note 15 Pro+ 5G', img: '/e.png', category: 'smartphone', priority: 10 },
];
const dedupeInputs = [
    [...catalogAsModels, ...synthetic],
    [...synthetic, ...catalogAsModels],
    synthetic,
];
const dedupe = dedupeInputs.map(input => ({ input, expected: deduplicateModels(input) }));

// Sorting with the exact comparator used in lib/store.ts.
const cmp = (a, b) => {
    const pDiff = (a.priority ?? 100) - (b.priority ?? 100);
    if (pDiff !== 0) return pDiff;
    return a.name.localeCompare(b.name);
};
const sortInputSame = allNames.filter(n => n !== '').map((name, i) => ({ id: `s${i}`, name, priority: 100 }));
const sortInputMixed = allNames.filter(n => n !== '').map((name, i) => ({ id: `m${i}`, name, priority: [10, 100, 1, 100, 50][i % 5] }));
const sorting = [sortInputSame, sortInputMixed].map(input => ({
    input,
    expectedIds: [...input].sort(cmp).map(x => x.id),
}));

writeFileSync(`${goldenDir}/golden-catalog-rules.json`, JSON.stringify({
    node: process.version,
    icu: process.versions.icu,
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    canonicalKeys, resolveImage, dedupe, sorting,
}, null, 2) + '\n');

console.log('catalog models:', CATALOG_2026_MODELS.length, 'node', process.version, 'icu', process.versions.icu,
    'locale', Intl.DateTimeFormat().resolvedOptions().locale);
