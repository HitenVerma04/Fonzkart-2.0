// The rows of the pricing rules editors (Admin app Pricing, website components/admin/PricingRulesManager.tsx): one
// rule per answer that can lower the price, keyed like the price calculation reads them (questionKey + answerKey).
// Yes/no questions are priced on their bad answer ('false', or 'true' where the server's built-in share says so, as
// for "Are there any spots on the sensor?"); accessories on being missing ('!charger'); other options on being chosen.
import type { QuestionStep } from './questionnaire';

export interface PricingRuleRow {
  questionKey: string;
  answerKey: string;
  questionLabel: string;
  answerLabel: string;
}

/** A built-in share from the server (GET /api/pricing/settings → defaults). */
export interface BuiltInShare {
  questionKey: string;
  answerKey: string;
  percent: number;
}

const isAccessory = (groupId: string, optionId: string) =>
  groupId === 'accessories' || optionId === 'charger' || optionId === 'box' || optionId === 'bill';

/** Answers the questionnaire does not list for every device (iPhones ask for the battery health instead). */
const EXTRA_LABELS: Record<string, string> = {
  battery_health_low: 'Battery Health < 85% (iPhone)',
  battery_health_high: 'Battery Health > 85% (iPhone)',
};

export function pricingRuleRows(steps: QuestionStep[], builtIn: BuiltInShare[] = []): PricingRuleRow[] {
  const rows: PricingRuleRow[] = [];
  for (const step of steps) {
    for (const q of step.questions ?? []) {
      const badIsYes = builtIn.some(b => b.questionKey === q.id && b.answerKey === 'true');
      rows.push({ questionKey: q.id, answerKey: badIsYes ? 'true' : 'false', questionLabel: q.text, answerLabel: badIsYes ? 'Yes' : 'Defective / No' });
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
  // Built-in shares for answers the questionnaire does not show to every device, next to their question.
  for (const b of builtIn) {
    if (rows.some(r => r.questionKey === b.questionKey && r.answerKey === b.answerKey)) continue;
    const at = rows.map(r => r.questionKey).lastIndexOf(b.questionKey);
    if (at < 0) continue;
    rows.splice(at + 1, 0, {
      questionKey: b.questionKey, answerKey: b.answerKey, questionLabel: rows[at]?.questionLabel ?? b.questionKey,
      answerLabel: EXTRA_LABELS[b.answerKey] ?? b.answerKey,
    });
  }
  return rows;
}
