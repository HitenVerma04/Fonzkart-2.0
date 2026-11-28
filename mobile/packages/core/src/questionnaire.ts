// The device questionnaire as the website runs it (components/sell/ChecklistWizard.tsx). The steps come from the
// backend (GET /api/catalog/questionnaire); these rules pick the steps for a device, record answers in the shape
// the price rules expect, and decide when a step may be left.

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  /** The heading this option is shown under in a tick-all-that-apply list ("Camera", "Buttons & controls"). */
  group?: string;
  /** Only for some devices: "apple" (iPhones), "android" (every other phone) or "foldable" (fold and flip phones). */
  showFor?: string;
  /** Choosing this means Fonzkart cannot buy the device as it is: the reason and what to do, shown instead of Continue. */
  stopsSale?: string;
}

export interface YesNoQuestion {
  id: string;
  text: string;
  subtext?: string;
  type?: string;
}

export interface QuestionSection {
  id: string;
  title: string;
  type: 'single-select' | 'multi-select' | string;
  options?: QuestionOption[];
  showFor?: string;
}

export interface QuestionStep {
  id: string;
  title: string;
  subtitle?: string;
  /** Absent on yes/no steps, which carry `questions` instead. */
  type?: 'single-select' | 'multi-select' | 'multi-select-grid' | 'combined-step' | string;
  options?: QuestionOption[];
  questions?: YesNoQuestion[];
  sections?: QuestionSection[];
  /** Only for some devices, as on an option. */
  showFor?: string;
}

export type Questionnaire = Record<string, QuestionStep[]>;

/** Answers keyed by step, section or question id: an option id, a list of option ids, or yes/no. */
export type Answers = Record<string, string | string[] | boolean>;

/** The questionnaire category for a sell category (smartwatch → watch, smarttv → tv; none → smartphone). */
export function questionnaireCategory(category: string | undefined): string {
  if (category === 'smartwatch') return 'watch';
  if (category === 'smarttv') return 'tv';
  return category || 'smartphone';
}

/** Words in a folding phone's name (Galaxy Z Fold / Flip, Razr, OnePlus Open, ...), as the backend's PartCatalog. */
const FOLD_WORDS = ['fold', 'flip', 'razr', 'duo', 'open', 'magic v'];

/** Whether a device name is an iPhone, and whether it folds (the backend decides the same way). */
export function deviceTraits(deviceName: string): { apple: boolean; foldable: boolean } {
  const name = ` ${deviceName.toLowerCase()} `;
  return { apple: name.includes('iphone'), foldable: FOLD_WORDS.some(w => name.includes(` ${w}`)) };
}

/** Whether a step, section or option with this `showFor` is shown for the device (none: for every device). */
export function shownFor(showFor: string | undefined, traits: { apple: boolean; foldable: boolean }): boolean {
  if (!showFor) return true;
  if (showFor === 'apple') return traits.apple;
  if (showFor === 'android') return !traits.apple;
  if (showFor === 'foldable') return traits.foldable;
  return true;
}

/**
 * The steps shown for a device. Unknown categories get the smartphone steps. Steps, sections and options marked
 * `showFor` appear only on those devices (the iCloud lock on iPhones, the hinge on fold and flip phones). For iPhones
 * the "Battery" issue is split into battery health below / above 85%, as on the website.
 */
export function stepsForDevice(questionnaire: Questionnaire, category: string | undefined, deviceName: string): QuestionStep[] {
  const traits = deviceTraits(deviceName);
  const keep = <T extends { showFor?: string }>(list: T[] | undefined) => list?.filter(item => shownFor(item.showFor, traits));
  const all = questionnaire[questionnaireCategory(category)] ?? questionnaire.smartphone ?? [];
  const steps = all
    .filter(step => shownFor(step.showFor, traits))
    .map(step => ({
      ...step,
      ...(step.options ? { options: keep(step.options) } : {}),
      ...(step.sections
        ? { sections: keep(step.sections)!.map(section => (section.options ? { ...section, options: keep(section.options) } : section)) }
        : {}),
    }));
  if (!traits.apple) return steps;
  return steps.map(step => {
    if (step.id !== 'functional_issues' || !step.options) return step;
    const options = step.options.flatMap(option =>
      option.id === 'battery'
        ? [
            { id: 'battery_health_low', label: 'Battery Health < 85%', icon: 'Battery', group: option.group },
            { id: 'battery_health_high', label: 'Battery Health > 85%', icon: 'Battery', group: option.group },
          ]
        : [option],
    );
    return { ...step, options };
  });
}

/**
 * Options of which exactly one must be ticked whenever a list shows them: an iPhone's battery health is either below or
 * above 85%. Ticking one unticks the other, and the list cannot be left until one is ticked.
 */
export const ONE_OF: string[][] = [['battery_health_low', 'battery_health_high']];

/** Single choices the customer may skip, and the answer a skipped one stands for (device age: out of warranty). */
export const SKIPPABLE: Record<string, string> = { warranty: 'no' };

/** The ONE_OF groups a list of options must answer. */
export function requiredGroups(options: QuestionOption[] | undefined): string[][] {
  const ids = new Set((options ?? []).map(o => o.id));
  return ONE_OF.filter(group => group.every(id => ids.has(id)));
}

/** Whether a question (step, section or yes/no) must be answered: marked with an asterisk. */
export function isRequired(key: string, type: string | undefined, options?: QuestionOption[]): boolean {
  if (type === 'single-select') return !(key in SKIPPABLE);
  if (isMultiSelect(type)) return requiredGroups(options).length > 0;
  return type === undefined || type === 'yes-no' || type === 'boolean';
}

const listAnswered = (options: QuestionOption[] | undefined, value: Answers[string] | undefined) => {
  const list = Array.isArray(value) ? value : [];
  return requiredGroups(options).every(group => group.some(id => list.includes(id)));
};

/** The reason Fonzkart cannot buy the device, when an answer on this step says so (an iPhone still locked to iCloud). */
export function saleStoppedBy(step: QuestionStep, answers: Answers): string | undefined {
  const lists: [string, QuestionOption[] | undefined][] = [[step.id, step.options], ...(step.sections ?? []).map(s => [s.id, s.options] as [string, QuestionOption[] | undefined])];
  for (const [key, options] of lists) {
    const value = answers[key];
    const chosen = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    const stop = options?.find(o => o.stopsSale && chosen.includes(o.id));
    if (stop) return stop.stopsSale;
  }
  return undefined;
}

/**
 * Whether "Continue" is allowed: required choices made (one battery health), every yes/no answered, and no answer
 * that stops the sale.
 */
export function isStepComplete(step: QuestionStep, answers: Answers): boolean {
  if (saleStoppedBy(step, answers)) return false;
  if (step.type === 'single-select') return !!answers[step.id] || step.id in SKIPPABLE;
  if (step.questions) return step.questions.every(q => typeof answers[q.id] === 'boolean');
  if (step.type === 'combined-step') {
    return (step.sections ?? []).every(section =>
      section.type === 'single-select' ? !!answers[section.id] || section.id in SKIPPABLE : listAnswered(section.options, answers[section.id]));
  }
  return listAnswered(step.options, answers[step.id]);
}

/** The answers with skipped questions filled in as they count (a skipped device age is "no": out of warranty). */
export function withSkippedAnswers(steps: QuestionStep[], answers: Answers): Answers {
  const keys = steps.flatMap(step => [step.id, ...(step.sections ?? []).map(section => section.id)]);
  const filled = { ...answers };
  for (const key of keys) {
    const skipped = SKIPPABLE[key];
    if (skipped !== undefined && !filled[key]) filled[key] = skipped;
  }
  return filled;
}

/**
 * Adds or removes an option in a multi-select answer, keeping the order of selection. An option of a ONE_OF group
 * works like a radio button: it replaces the other options of its group and stays ticked when tapped again.
 */
export function toggleOption(current: Answers[string] | undefined, optionId: string): string[] {
  const list = Array.isArray(current) ? current : [];
  const group = ONE_OF.find(g => g.includes(optionId));
  if (group) return list.includes(optionId) ? list : [...list.filter(id => !group.includes(id)), optionId];
  return list.includes(optionId) ? list.filter(id => id !== optionId) : [...list, optionId];
}

/** True when the step (or section) records several choices. */
export function isMultiSelect(type: string | undefined): boolean {
  return type === 'multi-select' || type === 'multi-select-grid';
}

/**
 * The headings of the functional problems, in display order, and which problems go under each. The questionnaire
 * carries the same groups on each option (`group`); this list is used when it does not (a server from before the
 * groups), so every app version shows the problems grouped.
 */
export const ISSUE_GROUPS: { title: string; ids: string[] }[] = [
  { title: 'Network & connectivity', ids: ['wifi', 'sim1', 'sim2', 'bluetooth'] },
  { title: 'Display', ids: ['screen_replaced'] },
  { title: 'Camera', ids: ['camera_glass', 'back_camera', 'back_camera_blur', 'front_camera', 'front_camera_blur'] },
  { title: 'Sensors', ids: ['finger_sensor', 'face_sensor', 'proximity', 'heart_sensor', 'remote_sensor'] },
  { title: 'Buttons & controls', ids: ['power_button', 'volume_button', 'silent_button', 'buttons', 'crown', 'mode_dial'] },
  { title: 'Sound & vibration', ids: ['speaker', 'earpiece', 'microphone', 'audio_ic', 'vibrator', 'sound'] },
  { title: 'Battery & charging', ids: ['battery', 'battery_health_low', 'battery_health_high', 'battery_low', 'charging_port'] },
  { title: 'Display & power', ids: ['display_flicker', 'power_fault'] },
  { title: 'Ports & slots', ids: ['ports', 'hdmi_usb', 'card_slot', 'mic_jack'] },
];

/** The heading of problems that fit no other group (always shown last). */
export const MISC_GROUP = 'Miscellaneous';

/**
 * A list of options split under headings: each option's own `group`, or for the functional problems step the
 * group {@link ISSUE_GROUPS} gives it. Known headings come in ISSUE_GROUPS order, others in the order they appear,
 * and options with no heading last under "Miscellaneous". A list without any heading comes back as one group with no
 * title.
 */
export function groupOptions(options: QuestionOption[], stepId?: string): { title?: string; options: QuestionOption[] }[] {
  const headingOf = (o: QuestionOption) =>
    o.group ?? (stepId === 'functional_issues' ? ISSUE_GROUPS.find(g => g.ids.includes(o.id))?.title : undefined);
  if (!options.some(o => headingOf(o))) return [{ options }];
  const order = ISSUE_GROUPS.map(g => g.title);
  const groups = new Map<string, QuestionOption[]>();
  for (const o of options) {
    const title = headingOf(o) ?? MISC_GROUP;
    groups.set(title, [...(groups.get(title) ?? []), o]);
  }
  const rank = (title: string) => (title === MISC_GROUP ? 1e6 : order.includes(title) ? order.indexOf(title) : 1e3);
  return [...groups.entries()]
    .map(([title, list], index) => ({ title, options: list, index }))
    .sort((a, b) => rank(a.title) - rank(b.title) || a.index - b.index)
    .map(({ title, options: list }) => ({ title, options: list }));
}

/** Readable summary of the answers, in step order, for the offer screen. */
export function describeAnswers(steps: QuestionStep[], answers: Answers): { title: string; value: string }[] {
  const lines: { title: string; value: string }[] = [];
  const label = (options: QuestionOption[] | undefined, id: string) => options?.find(o => o.id === id)?.label ?? id;
  const add = (title: string, options: QuestionOption[] | undefined, value: Answers[string] | undefined) => {
    if (Array.isArray(value)) {
      if (value.length) lines.push({ title, value: value.map(id => label(options, id)).join(', ') });
    } else if (typeof value === 'string' && value) {
      lines.push({ title, value: label(options, value) });
    }
  };
  for (const step of steps) {
    if (step.questions) {
      for (const q of step.questions) {
        const value = answers[q.id];
        if (typeof value === 'boolean') lines.push({ title: q.text, value: value ? 'Yes' : 'No' });
      }
    } else if (step.type === 'combined-step') {
      for (const section of step.sections ?? []) add(section.title, section.options, answers[section.id]);
    } else {
      add(step.title, step.options, answers[step.id]);
    }
  }
  return lines;
}
