// Executes backend/src/test/resources/golden/pricing-scenario.json against the website's actions
// (getEvaluationRules / upsertEvaluationRule / calculatePrice / signin) on the staff + pricing-rules seed and writes
// the expected outcome that PricingScenarioParityTest replays against Spring Boot.
//   tsx scripts/security-tests/pricing-ref.ts <scenario.json> <expected.json>
import { readFileSync, writeFileSync } from 'node:fs';
import * as auth from '@/actions/auth';
import * as admin from '@/actions/admin';
import { calculatePrice } from '@/actions/priceCalculation';
import { as, form, prisma } from './harness';

const KNOWN_THROWN = ['Unauthorized', 'Forbidden: Admin access required'];
const DROP = new Set(['id', 'createdAt', 'updatedAt']);
const normalize = (v: any): any => Array.isArray(v) ? v.map(normalize)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([k, x]) => !DROP.has(k) && x !== undefined).map(([k, x]) => [k, normalize(x)]))
  : (typeof v === 'number' && Number.isNaN(v)) ? 'NaN' : v;

async function invoke(action: string, i: any) {
  switch (action) {
    case 'signin': return auth.signin(null, form(i));
    case 'getEvaluationRules': return admin.getEvaluationRules(i.category);
    case 'upsertEvaluationRule': return admin.upsertEvaluationRule(i);
    case 'calculatePrice': return i.category === undefined ? (calculatePrice as any)(i.basePrice, i.answers) : calculatePrice(i.basePrice, i.answers, i.category);
    default: throw new Error(action);
  }
}

async function main() {
  const scenario = JSON.parse(readFileSync(process.argv[2], 'utf8'));
  const steps: any[] = [];
  for (const step of scenario.steps) {
    as(step.actor);
    let outcome: any;
    try { outcome = { returned: (await invoke(step.action, step.input)) ?? null }; }
    catch (e: any) {
      outcome = e?.digest === 'NEXT_REDIRECT' ? { redirect: e.url } : { thrown: KNOWN_THROWN.includes(e?.message) ? e.message : '<server-error>' };
    }
    steps.push({ step: `${step.actor}:${step.action}`, outcome: normalize(outcome) });
  }
  const rules = normalize(await prisma.evaluationRule.findMany({ orderBy: [{ category: 'asc' }, { questionKey: 'asc' }, { answerKey: 'asc' }] }));
  writeFileSync(process.argv[3], JSON.stringify({ steps, rules }, null, 1));
  console.log('steps:', steps.length, 'rules:', rules.length);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
