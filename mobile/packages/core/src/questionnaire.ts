// The device questionnaire as the website runs it (components/sell/ChecklistWizard.tsx). The steps come from the
// backend (GET /api/catalog/questionnaire); these rules pick the steps for a device, record answers in the shape
// the price rules expect, and decide when a step may be left.

export interface QuestionOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
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
            { id: 'battery_health_low', label: 'Battery Health < 85%', icon: 'Battery' },
            { id: 'battery_health_high', label: 'Battery Health > 85%', icon: 'Battery' },
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
