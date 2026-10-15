import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pricingRuleRows } from './pricingRules';
import type { QuestionStep } from './questionnaire';

test('pricing rule rows are keyed like the website editor and the price calculation', () => {
  const steps = [
    { id: 'functional', title: 'Device works', type: 'yes-no', questions: [{ id: 'calls', text: 'Can you make calls?' }] },
    { id: 'functional_issues', title: 'Problems', type: 'multi-select-grid', options: [{ id: 'wifi', label: 'WiFi' }] },
    { id: 'accessories', title: 'Accessories', type: 'multi-select', options: [{ id: 'charger', label: 'Charger' }] },
    { id: 'details', title: 'Device Details', type: 'combined-step', sections: [
      { id: 'warranty', title: 'Warranty', type: 'single-select', options: [{ id: '0_3_months', label: '0 - 3 Months' }] },
      { id: 'kit', title: 'Kit', type: 'multi-select', options: [{ id: 'box', label: 'Box' }] },
    ] },
  ] as unknown as QuestionStep[];
  assert.deepEqual(pricingRuleRows(steps).map(r => `${r.questionKey}=${r.answerKey}:${r.answerLabel}`), [
    'calls=false:Defective / No',
    'functional_issues=wifi:WiFi',
    'accessories=!charger:Missing Charger',
    'warranty=0_3_months:0 - 3 Months',
    'kit=!box:Missing Box',
  ]);
});
