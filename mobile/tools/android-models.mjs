// Rebuilds apps/customer/src/home/androidModels.json: Android model code -> catalog model name, from Google Play's
// supported devices list and the 2.0 catalog. Run it when the catalog gains models:
//   curl -L -o devices.csv https://storage.googleapis.com/play_public/supported_devices.csv
//   node tools/android-models.mjs devices.csv
import fs from 'fs';
const API = 'https://api-v2.fonzkart.in';
const raw = fs.readFileSync(process.argv[2]);
const text = raw[0] === 0xff ? raw.toString('utf16le').slice(1) : raw.toString('utf8');
const parseLine = l => { const o = []; let c = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { c += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { o.push(c); c = ''; } else c += ch; } o.push(c); return o; };
const lines = text.split(/\r?\n/).filter(Boolean);
console.log('header', lines[0], 'rows', lines.length);
const rows = lines.slice(1).map(parseLine).filter(r => r.length >= 4);

const key = (name, brand = '') => {
  let s = name.toLowerCase().replace(/\+/g, ' plus ').replace(/[™®]/g, '');
  for (const b of [brand, 'samsung', 'oneplus', 'google', 'xiaomi', 'motorola', 'vivo', 'oppo', 'realme', 'nothing', 'nokia', 'apple', 'poco', 'iqoo'].filter(Boolean)) {
    if (['oneplus', 'xiaomi', 'vivo', 'oppo', 'realme', 'nokia', 'poco', 'iqoo', 'redmi', 'mi'].includes(b.toLowerCase())) continue; // those names keep the brand: compared below without it too
    s = s.replace(new RegExp('^' + b.toLowerCase() + '\\s+'), '');
  }
  return s.replace(/\b[45]g\b/g, ' ').replace(/[^a-z0-9]+/g, '');
};
const strip = k => k.replace(/^(oneplus|xiaomi|mi|vivo|oppo|realme|nokia|poco|iqoo|moto|motorola)/, '');

const brands = await (await fetch(API + '/api/catalog/brands')).json();
const catalog = [];
for (const b of brands) for (const c of ['smartphone', 'tablet']) {
  if (!b.categories.includes(c)) continue;
  const m = await (await fetch(`${API}/api/catalog/models?brandId=${b.id}&category=${c}`)).json();
  for (const x of m) catalog.push({ name: x.name, brand: b.id, category: c });
}
console.log('catalog', catalog.length);
const retailToBrand = { samsung: 'samsung', oneplus: 'oneplus', google: 'google', oppo: 'oppo', vivo: 'vivo', xiaomi: 'xiaomi', redmi: 'xiaomi', mi: 'xiaomi', motorola: 'motorola', realme: 'realme', poco: 'poco', iqoo: 'iqoo', nothing: 'nothing', nokia: 'nokia', hmd: 'nokia', 'hmd global': 'nokia', lenovo: 'lenovo', microsoft: 'microsoft' };
const index = new Map();
for (const m of catalog) {
  const k = key(m.name);
  for (const v of new Set([k, strip(k)])) if (v && !index.has(m.brand + '|' + v)) index.set(m.brand + '|' + v, m.name);
}
const codes = {};
const hit = new Set();
const groups = { xiaomi: ['xiaomi', 'poco'], poco: ['poco', 'xiaomi'], vivo: ['vivo', 'iqoo'], iqoo: ['iqoo', 'vivo'] };
for (const [retail, marketing, , model] of rows) {
  const brand = retailToBrand[retail.trim().toLowerCase()];
  if (!brand || !marketing || !model) continue;
  const k = key(marketing, retail.trim());
  for (const b of groups[brand] ?? [brand]) {
    const name = index.get(b + '|' + k) ?? index.get(b + '|' + strip(k));
    if (name) { codes[model.trim().toUpperCase()] = name; hit.add(name); break; }
  }
}
const sorted = Object.fromEntries(Object.entries(codes).sort(([a], [b]) => (a < b ? -1 : 1)));
fs.writeFileSync(new URL('../apps/customer/src/home/androidModels.json', import.meta.url), JSON.stringify(sorted));
console.log('codes', Object.keys(sorted).length, 'bytes', JSON.stringify(sorted).length, 'catalog covered', hit.size, 'of', catalog.length);
const per = {};
for (const m of catalog) { per[m.brand] ??= [0, 0]; per[m.brand][1]++; if (hit.has(m.name)) per[m.brand][0]++; }
console.log(per);
