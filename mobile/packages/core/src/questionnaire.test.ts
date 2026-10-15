import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeAnswers,
  isStepComplete,
  questionnaireCategory,
  stepsForDevice,
  toggleOption,
  type Questionnaire,
  type QuestionStep,
} from './questionnaire';
import { cleanPincode, isCompletePincode } from './pincode';

const single: QuestionStep = {
  id: 'physical_condition', title: 'Screen', type: 'single-select',
  options: [{ id: 'good', label: 'Good' }, { id: 'average', label: 'Average' }],
};
const issues: QuestionStep = {
  id: 'functional_issues', title: 'Issues', type: 'multi-select-grid',
  options: [{ id: 'wifi', label: 'WiFi' }, { id: 'battery', label: 'Battery' }, { id: 'camera', label: 'Camera' }],
};
const yesNo: QuestionStep = {
  id: 'core_functionality', title: 'Check',
  questions: [{ id: 'power', text: 'Turns on?' }, { id: 'touch', text: 'Touch works?' }],
};
const combined: QuestionStep = {
  id: 'device_details', title: 'Details', type: 'combined-step',
  sections: [
    { id: 'purchase_location', title: 'Bought where?', type: 'single-select', options: [{ id: 'india', label: 'India' }] },
    { id: 'accessories', title: 'You have', type: 'multi-select', options: [{ id: 'box', label: 'Box' }, { id: 'bill', label: 'Bill' }] },
  ],
};
const questionnaire: Questionnaire = { smartphone: [single, issues, combined], watch: [yesNo], tv: [single] };

test('category mapping matches the website', () => {
  assert.equal(questionnaireCategory('smartwatch'), 'watch');
  assert.equal(questionnaireCategory('smarttv'), 'tv');
  assert.equal(questionnaireCategory(undefined), 'smartphone');
  assert.equal(questionnaireCategory('laptop'), 'laptop');
  assert.deepEqual(stepsForDevice(questionnaire, 'smarttv', 'Bravia').map(s => s.id), ['physical_condition']);
  assert.deepEqual(stepsForDevice(questionnaire, 'drone', 'X').map(s => s.id), ['physical_condition', 'functional_issues', 'device_details']);
});

test('iPhones get battery health options instead of "Battery"', () => {
  const ids = (name: string) => stepsForDevice(questionnaire, 'smartphone', name)[1]!.options!.map(o => o.id);
  assert.deepEqual(ids('iPhone 14 Pro'), ['wifi', 'battery_health_low', 'battery_health_high', 'camera']);
  assert.deepEqual(ids('Galaxy S24'), ['wifi', 'battery', 'camera']);
  assert.deepEqual(questionnaire.smartphone![1]!.options!.map(o => o.id), ['wifi', 'battery', 'camera'], 'source untouched');
});

test('step completion follows the website rules', () => {
  assert.equal(isStepComplete(single, {}), false);
  assert.equal(isStepComplete(single, { physical_condition: 'good' }), true);
  assert.equal(isStepComplete(issues, {}), true, 'multi-select is optional');
  assert.equal(isStepComplete(yesNo, { power: true }), false);
  assert.equal(isStepComplete(yesNo, { power: true, touch: false }), true);
  assert.equal(isStepComplete(combined, { accessories: ['box'] }), false);
  assert.equal(isStepComplete(combined, { purchase_location: 'india' }), true);
});

test('multi-select toggling keeps selection order', () => {
  assert.deepEqual(toggleOption(undefined, 'wifi'), ['wifi']);
  assert.deepEqual(toggleOption(['wifi'], 'camera'), ['wifi', 'camera']);
  assert.deepEqual(toggleOption(['wifi', 'camera'], 'wifi'), ['camera']);
});

test('answers are summarised with labels', () => {
  const lines = describeAnswers([single, issues, yesNo, combined], {
    physical_condition: 'average', functional_issues: ['camera', 'wifi'], power: false, touch: true,
    purchase_location: 'india', accessories: [],
  });
  assert.deepEqual(lines, [
    { title: 'Screen', value: 'Average' },
    { title: 'Issues', value: 'Camera, WiFi' },
    { title: 'Turns on?', value: 'No' },
    { title: 'Touch works?', value: 'Yes' },
    { title: 'Bought where?', value: 'India' },
  ]);
});

test('pincode input', () => {
  assert.equal(cleanPincode(' 600 01a7x9'), '600017');
  assert.equal(isCompletePincode('60001'), false);
  assert.equal(isCompletePincode('600017'), true);
});

test('stored model categories map to the website sell categories', async () => {
  const { sellCategoryOf } = await import('./categories');
  assert.equal(sellCategoryOf('mobile'), 'smartphone');
  assert.equal(sellCategoryOf('Smartphone'), 'smartphone');
  assert.equal(sellCategoryOf('ipad'), 'tablet');
  assert.equal(sellCategoryOf('smartwatch'), 'watch');
  assert.equal(sellCategoryOf('tv'), 'smarttv');
  assert.equal(sellCategoryOf('laptop'), 'laptop');
  assert.equal(sellCategoryOf(''), 'smartphone');
  assert.equal(sellCategoryOf(undefined), 'smartphone');
});
