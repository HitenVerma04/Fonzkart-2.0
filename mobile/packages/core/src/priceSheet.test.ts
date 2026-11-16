import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { answerApplies, describeBreakdown, priceFromSheet, stepQuestionIds, type PriceSheet } from './priceSheet';
import type { QuestionStep } from './questionnaire';

// The backend's cases (PriceSheetGoldenTest): the phone must price every one exactly as the server does.
const golden = JSON.parse(readFileSync(join(__dirname, '../../../../backend/src/test/resources/golden/price-sheet-cases.json'), 'utf8')) as {
  sheets: Record<string, PriceSheet>;
  cases: { name: string; sheet: string; answers: Record<string, unknown>; price: number }[];
};

test('every golden case prices as the server does', () => {
  assert.ok(golden.cases.length > 10);
  for (const c of golden.cases) {
    assert.equal(priceFromSheet(golden.sheets[c.sheet]!, c.answers).price, c.price, c.name);
  }
});

test('ticking a problem lowers the price at once; unticking restores it', () => {
  const sheet = golden.sheets.phone!;
  const owned = { accessories: ['charger', 'box', 'bill'] };
  const clean = priceFromSheet(sheet, owned).price;
  const broken = priceFromSheet(sheet, { ...owned, functional_issues: ['back_camera'] });
  assert.equal(clean, sheet.maxValue);
  assert.ok(broken.price < clean);
  assert.equal(broken.repairsOff, 6300 + 300);
  assert.equal(priceFromSheet(sheet, { ...owned, functional_issues: [] }).price, clean);
});

test('answer keys', () => {
  assert.equal(answerApplies(undefined, '!box'), true);
  assert.equal(answerApplies(['box'], '!box'), false);
  assert.equal(answerApplies(['wifi'], 'wifi'), true);
  assert.equal(answerApplies(false, 'false'), true);
  assert.equal(answerApplies('good', 'good'), true);
  assert.equal(answerApplies('good', '!good'), false);
  assert.equal(answerApplies(3, '3'), false);
});

test('the live price counts only the questions reached so far', () => {
  const sheet = golden.sheets.phone!;
  // On the first question the accessories (not seen yet) take nothing; with every question they count as not owned.
  const first = priceFromSheet(sheet, { physical_condition: 'flawless' }, new Set(['physical_condition']));
  const all = priceFromSheet(sheet, { physical_condition: 'flawless' });
  assert.equal(first.price, sheet.maxValue);
  assert.ok(all.price < first.price);
  assert.deepEqual(stepQuestionIds({ id: 'device_details', title: 'x', sections: [{ id: 'accessories', title: 'y' } as never] }), ['device_details', 'accessories']);
});

test('the breakdown in words', () => {
  const steps: QuestionStep[] = [
    { id: 'physical_condition', title: 'Screen condition', type: 'single-select', options: [{ id: 'good', label: 'Good' }] },
    {
      id: 'device_details', title: 'Details', type: 'combined-step',
      sections: [{ id: 'accessories', title: 'Do you have', type: 'multi-select', options: [{ id: 'box', label: 'Original Box' }] }],
    },
  ];
  const lines = describeBreakdown(steps, [
    { kind: 'value', question: 'physical_condition', answers: ['good'], part: null, amount: 1800 },
    { kind: 'value', question: 'accessories', answers: ['!box'], part: null, amount: 900 },
    { kind: 'repair', question: 'functional_issues', answers: ['wifi'], part: 'board', amount: 4100 },
    { kind: 'labour', question: null, answers: [], part: null, amount: 300 },
    { kind: 'rounding', question: null, answers: [], part: null, amount: 4 },
  ]);
  assert.deepEqual(lines.map(l => l.label), ['Screen: Good', 'Missing: Original Box', 'Repair: Board repair (network, SIM, audio)', 'Repair labour']);
});
