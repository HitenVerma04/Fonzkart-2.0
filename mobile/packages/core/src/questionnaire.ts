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

/**
 * The steps shown for a device. Unknown categories get the smartphone steps. For iPhones the "Battery" issue is
 * split into battery health below / above 85%, as on the website.
 */
export function stepsForDevice(questionnaire: Questionnaire, category: string | undefined, deviceName: string): QuestionStep[] {
  const steps = questionnaire[questionnaireCategory(category)] ?? questionnaire.smartphone ?? [];
  if (!deviceName.toLowerCase().includes('iphone')) return steps;
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

/** Whether "Continue" is allowed: single choices must be made and every yes/no answered; multi-selects are optional. */
export function isStepComplete(step: QuestionStep, answers: Answers): boolean {
  if (step.type === 'single-select') return !!answers[step.id];
  if (step.questions) return step.questions.every(q => typeof answers[q.id] === 'boolean');
  if (step.type === 'combined-step') {
    return (step.sections ?? []).every(section => section.type !== 'single-select' || !!answers[section.id]);
  }
  return true;
}

/** Adds or removes an option in a multi-select answer, keeping the order of selection. */
export function toggleOption(current: Answers[string] | undefined, optionId: string): string[] {
  const list = Array.isArray(current) ? current : [];
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
  { title: 'Camera', ids: ['front_camera', 'back_camera', 'camera_glass', 'front_camera_blur', 'back_camera_blur'] },
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
