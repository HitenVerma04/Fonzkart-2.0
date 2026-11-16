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

test('built-in shares pick the bad yes/no answer and add answers only some devices see', () => {
  const steps = [
    { id: 'core', title: 'Checks', type: 'yes-no', questions: [{ id: 'sensor_spots', text: 'Spots on the sensor?' }, { id: 'power', text: 'Turns on?' }] },
    { id: 'functional_issues', title: 'Problems', type: 'multi-select-grid', options: [{ id: 'battery', label: 'Battery' }, { id: 'wifi', label: 'WiFi' }] },
  ] as unknown as QuestionStep[];
  const builtIn = [
    { questionKey: 'sensor_spots', answerKey: 'true', percent: 20 },
    { questionKey: 'power', answerKey: 'false', percent: 60 },
    { questionKey: 'functional_issues', answerKey: 'battery_health_low', percent: 8 },
    { questionKey: 'not_asked', answerKey: 'x', percent: 5 },
  ];
  assert.deepEqual(pricingRuleRows(steps, builtIn).map(r => `${r.questionKey}=${r.answerKey}:${r.answerLabel}`), [
    'sensor_spots=true:Yes',
    'power=false:Defective / No',
    'functional_issues=battery:Battery',
    'functional_issues=wifi:WiFi',
    'functional_issues=battery_health_low:Battery Health < 85% (iPhone)',
  ]);
});
