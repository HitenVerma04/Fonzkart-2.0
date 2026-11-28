import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  describeAnswers,
  isRequired,
  isStepComplete,
  questionnaireCategory,
  stepsForDevice,
  toggleOption,
  withSkippedAnswers,
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

test('an iPhone must give exactly one battery health', () => {
  const iphoneIssues = stepsForDevice(questionnaire, 'smartphone', 'iPhone 15')[1]!;
  assert.equal(isStepComplete(iphoneIssues, {}), false, 'battery health is required');
  assert.equal(isStepComplete(iphoneIssues, { functional_issues: ['wifi'] }), false);
  assert.equal(isStepComplete(iphoneIssues, { functional_issues: ['battery_health_high'] }), true);
  assert.equal(isRequired('functional_issues', iphoneIssues.type, iphoneIssues.options), true);
  assert.equal(isRequired('functional_issues', issues.type, issues.options), false, 'other phones: optional');
  // Ticking one health replaces the other; tapping the ticked one keeps it.
  assert.deepEqual(toggleOption(['wifi', 'battery_health_low'], 'battery_health_high'), ['wifi', 'battery_health_high']);
  assert.deepEqual(toggleOption(['battery_health_high'], 'battery_health_high'), ['battery_health_high']);
});

test('device age may be skipped and then counts as out of warranty', () => {
  const details: QuestionStep = {
    id: 'device_details', title: 'Details', type: 'combined-step',
    sections: [
      { id: 'purchase_location', title: 'Bought where?', type: 'single-select', options: [{ id: 'india', label: 'India' }] },
      { id: 'warranty', title: 'Device age', type: 'single-select', options: [{ id: '0_3_months', label: '0 - 3 Months' }] },
    ],
  };
  assert.equal(isStepComplete(details, { purchase_location: 'india' }), true);
  assert.equal(isRequired('warranty', 'single-select'), false);
  assert.equal(isRequired('purchase_location', 'single-select'), true);
  assert.deepEqual(withSkippedAnswers([details], { purchase_location: 'india' }), { purchase_location: 'india', warranty: 'no' });
  assert.deepEqual(withSkippedAnswers([details], { warranty: '0_3_months' }), { warranty: '0_3_months' });
  assert.deepEqual(withSkippedAnswers([single], {}), {}, 'only where the question is asked');
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

test('functional problems are shown under headings, from the options or the built-in list', async () => {
  const { groupOptions } = await import('./questionnaire');
  const options = [
    { id: 'wifi', label: 'WiFi' }, { id: 'front_camera', label: 'Front Camera' }, { id: 'speaker', label: 'Speaker' },
    { id: 'bluetooth', label: 'Bluetooth' }, { id: 'battery_health_low', label: 'Battery Health < 85%' }, { id: 'mystery', label: 'Mystery' },
  ];
  // A server without groups: the built-in list places them, in its order; unknown problems go last under "Miscellaneous".
  assert.deepEqual(groupOptions(options, 'functional_issues').map(g => `${g.title}: ${g.options.map(o => o.id).join(',')}`), [
    'Network & connectivity: wifi,bluetooth',
    'Camera: front_camera',
    'Sound & vibration: speaker',
    'Battery & charging: battery_health_low',
    'Miscellaneous: mystery',
  ]);
  // The options' own groups win, and other lists keep no headings unless their options carry one.
  assert.deepEqual(groupOptions([{ id: 'wifi', label: 'WiFi', group: 'Smart features' }], 'functional_issues')[0]?.title, 'Smart features');
  assert.deepEqual(groupOptions([{ id: 'charger', label: 'Charger' }, { id: 'box', label: 'Box' }], 'accessories'),
    [{ options: [{ id: 'charger', label: 'Charger' }, { id: 'box', label: 'Box' }] }]);
});

test('fold and flip phones get the hinge check, iPhones the iCloud lock, and a locked iPhone stops the sale', async () => {
  const { saleStoppedBy, deviceTraits } = await import('./questionnaire');
  const fold: QuestionStep = {
    id: 'fold_check', title: 'Fold & Flip Check', type: 'combined-step', showFor: 'foldable',
    sections: [{ id: 'hinge', title: 'Hinge', type: 'single-select', options: [{ id: 'fine', label: 'Fine' }, { id: 'faulty', label: 'Faulty' }] }],
  };
  const icloud: QuestionStep = {
    id: 'icloud_lock', title: 'iCloud', type: 'single-select', showFor: 'apple',
    options: [{ id: 'not_locked', label: 'Not locked' }, { id: 'locked', label: 'Still locked', stopsSale: 'Sign out first.' }],
  };
  const problems: QuestionStep = {
    id: 'functional_issues', title: 'Issues', type: 'multi-select-grid',
    options: [{ id: 'wifi', label: 'WiFi' }, { id: 'in_display', label: 'In-display', showFor: 'android' }],
  };
  const q: Questionnaire = { smartphone: [single, fold, icloud, problems] };
  const ids = (name: string) => stepsForDevice(q, 'smartphone', name).map(s => s.id).join(',');
  assert.equal(ids('Galaxy Z Fold5'), 'physical_condition,fold_check,functional_issues');
  assert.equal(ids('Galaxy Z Flip 6'), 'physical_condition,fold_check,functional_issues');
  assert.equal(ids('iPhone 15'), 'physical_condition,icloud_lock,functional_issues');
  assert.equal(ids('Galaxy S24'), 'physical_condition,functional_issues');
  // Options marked for Android phones are not shown on iPhones.
  assert.deepEqual(stepsForDevice(q, 'smartphone', 'iPhone 15').at(-1)?.options?.map(o => o.id), ['wifi']);
  assert.deepEqual(stepsForDevice(q, 'smartphone', 'Pixel 9').at(-1)?.options?.map(o => o.id), ['wifi', 'in_display']);
  assert.deepEqual(deviceTraits('OnePlus Open'), { apple: false, foldable: true });
  assert.deepEqual(deviceTraits('Galaxy S24 Ultra'), { apple: false, foldable: false });

  assert.equal(saleStoppedBy(icloud, { icloud_lock: 'locked' }), 'Sign out first.');
  assert.equal(isStepComplete(icloud, { icloud_lock: 'locked' }), false);
  assert.equal(isStepComplete(icloud, { icloud_lock: 'not_locked' }), true);
  assert.equal(isStepComplete(fold, {}), false);
  assert.equal(isStepComplete(fold, { hinge: 'faulty' }), true);
});
