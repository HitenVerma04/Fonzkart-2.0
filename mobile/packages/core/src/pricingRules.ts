// The rows of the website's pricing rules editor (components/admin/PricingRulesManager.tsx): one rule per answer that
// can lower the price, keyed like the price calculation reads them (questionKey + answerKey). Yes/no questions are
// priced on "No" ('false'); accessories on being missing ('!charger'); other options on being chosen.
import type { QuestionStep } from './questionnaire';

export interface PricingRuleRow {
  questionKey: string;
  answerKey: string;
  questionLabel: string;
  answerLabel: string;
}

const isAccessory = (groupId: string, optionId: string) =>
  groupId === 'accessories' || optionId === 'charger' || optionId === 'box' || optionId === 'bill';

export function pricingRuleRows(steps: QuestionStep[]): PricingRuleRow[] {
  const rows: PricingRuleRow[] = [];
  for (const step of steps) {
    for (const q of step.questions ?? []) {
      rows.push({ questionKey: q.id, answerKey: 'false', questionLabel: q.text, answerLabel: 'Defective / No' });
    }
    for (const opt of step.options ?? []) {
      const missing = isAccessory(step.id, opt.id);
      rows.push({
        questionKey: step.id, answerKey: missing ? `!${opt.id}` : opt.id,
        questionLabel: step.title, answerLabel: missing ? `Missing ${opt.label}` : opt.label,
      });
    }
    if (step.type === 'combined-step') {
      for (const section of step.sections ?? []) {
        for (const opt of section.options ?? []) {
          const missing = isAccessory(section.id, opt.id);
          rows.push({
            questionKey: section.id, answerKey: missing ? `!${opt.id}` : opt.id,
            questionLabel: `${step.title} - ${section.title}`, answerLabel: missing ? `Missing ${opt.label}` : opt.label,
          });
        }
      }
    }
  }
  return rows;
}
