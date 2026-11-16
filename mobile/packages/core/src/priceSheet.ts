// The live offer on the phone: the server sends a device's price sheet once (GET /api/pricing/sheet) and the price is
// worked out here on every tick and untick, with no network round trip. The steps are the backend's SheetPricer, line
// for line; backend/src/test/resources/golden/price-sheet-cases.json holds the cases both must agree on, so the price
// the customer watches is the price the order is booked at.
import type { QuestionOption, QuestionStep } from './questionnaire';

export interface PriceSheetLine {
  question: string;
  /** Option id, "!item" for an item the customer does not have, "true" / "false" for yes/no. */
  answer: string;
  /** "value": a share of the max value (scratches, age, accessories); "repair": rupees for a part, paid once. */
  kind: 'value' | 'repair';
  share: number;
  part: string | null;
  cost: number;
  confidence: number;
  /** builtin, admin, prior, official, fonzkart_repair, observed */
  source: string;
}

export interface ProfitGuard {
  /** The most Fonzkart can pay for a flawless one and keep its margin (resale value less the margin). */
  payable: number;
  logistics: number;
  confidence: number;
  sales: number;
}

export interface PriceSheet {
  engineVersion: string;
  category: string;
  maxValue: number;
  floor: number;
  labourFirst: number;
  labourExtra: number;
  lines: PriceSheetLine[];
  caps: Record<string, number>;
  profitGuard: ProfitGuard | null;
  confidence: number;
  maxValueSource: 'auto' | 'manual';
}

export interface SheetPrice {
  price: number;
  /** Rupees off the max value for how it looks and sells, and for repairs (with labour). */
  valueOff: number;
  repairsOff: number;
  /** The lowest offer raised the price. */
  floorApplied: boolean;
}

const MAX_SHARE = 0.9;

const clamp = (v: number, low: number, high: number) => (Number.isNaN(v) ? low : Math.max(low, Math.min(high, v)));

/** Whether an answer key matches the customer's answer (as PriceCalculator.applies on the server). */
export function answerApplies(answer: unknown, key: string): boolean {
  const notTicked = key.startsWith('!');
  if (answer === undefined || answer === null) return notTicked;
  if (typeof answer === 'boolean') return key === String(answer);
  if (Array.isArray(answer)) {
    const item = notTicked ? key.slice(1) : key;
    const ticked = answer.some(v => typeof v === 'string' && v === item);
    return notTicked !== ticked;
  }
  return typeof answer === 'string' && answer === key;
}

/**
 * The offer for these answers, exactly as the server prices them. `only`: price only these questions (the live
 * price while the customer is still answering: questions not reached yet take nothing, so an accessory list not seen
 * yet does not count as "none owned"); with every question it is the booked price.
 */
export function priceFromSheet(sheet: PriceSheet, answers: Record<string, unknown>, only?: ReadonlySet<string>): SheetPrice {
  const max = sheet.maxValue;
  if (!(max > 0)) return { price: 0, valueOff: 0, repairsOff: 0, floorApplied: false };

  const shareQuestions = new Map<string, PriceSheetLine[]>();
  const parts = new Map<string, PriceSheetLine>();
  for (const line of sheet.lines) {
    if (only && !only.has(line.question)) continue;
    if (line.kind === 'repair') {
      if (answerApplies(answers[line.question], line.answer)) {
        const held = line.part === null ? undefined : parts.get(line.part);
        if (line.part !== null && (held === undefined || line.cost > held.cost)) parts.set(line.part, line);
      }
    } else {
      const list = shareQuestions.get(line.question);
      if (list) list.push(line);
      else shareQuestions.set(line.question, [line]);
    }
  }

  let kept = 1;
  for (const [question, lines] of shareQuestions) {
    const answer = answers[question];
    let left = 1;
    for (const line of lines) {
      if (answerApplies(answer, line.answer)) left *= 1 - clamp(line.share, 0, MAX_SHARE);
    }
    const cap = sheet.caps?.[question];
    const taken = Math.min(1 - left, cap === undefined || cap === null ? MAX_SHARE : clamp(cap, 0, MAX_SHARE));
    if (taken > 0) kept *= 1 - taken;
  }

  let repairs = 0;
  for (const line of parts.values()) repairs += line.cost;
  const labour = parts.size === 0 ? 0 : sheet.labourFirst + sheet.labourExtra * (parts.size - 1);

  const guard = sheet.profitGuard;
  const guarded = !!guard && guard.payable > 0;
  const affordable = guarded ? guard!.payable * kept - repairs - labour - guard!.logistics : 0;
  if (kept >= 1 && parts.size === 0 && (!guarded || affordable >= max)) {
    return { price: max, valueOff: 0, repairsOff: 0, floorApplied: false };
  }

  let offer = max * kept - repairs - labour;
  const floor = Math.max(0, Math.min(sheet.floor, max));
  if (guarded && affordable < offer) offer = affordable;
  const floorApplied = offer < floor;
  if (floorApplied) offer = floor;
  const price = Math.max(0, Math.min(max, Math.floor(offer / 10) * 10));
  return { price, valueOff: Math.round(max - max * kept), repairsOff: repairs + labour, floorApplied };
}

/** The answer keys a step sets: its own id, its yes/no questions' ids and its sections' ids. */
export function stepQuestionIds(step: QuestionStep): string[] {
  return [step.id, ...(step.questions ?? []).map(q => q.id), ...(step.sections ?? []).map(sec => sec.id)];
}

/** Names of the parts a repair line is for (the backend's PartCatalog). */
export const PART_LABELS: Record<string, string> = {
  display: 'Display', back_panel: 'Back panel / body', battery: 'Battery', rear_camera: 'Rear camera',
  front_camera: 'Front camera', camera_glass: 'Camera glass', face_id: 'Face ID / face unlock', fingerprint: 'Fingerprint sensor',
  sensors: 'Sensors', buttons: 'Buttons', speaker: 'Speaker', earpiece: 'Earpiece', microphone: 'Microphone',
  vibrator: 'Vibration motor', charging_port: 'Charging port', board: 'Board repair (network, SIM, audio)', keyboard: 'Keyboard',
  backlight: 'Backlight', power_board: 'Power board',
};

/** One step of the server's breakdown (the quote's `breakdown`). */
export interface BreakdownStep {
  kind: string;
  question: string | null;
  answers: string[];
  part: string | null;
  amount: number;
}

const SHORT_TITLES: Record<string, string> = {
  physical_condition: 'Screen', body_condition: 'Body', accessories: 'Missing', purchase_location: 'Bought outside India',
  warranty: 'Device age', functional_issues: 'Problems',
};

/**
 * The breakdown in words for the customer: "Screen: Good" −₹1,800, "Repair: Display" −₹9,400, "Lowest offer
 * guarantee" +₹600. Rounding of a few rupees is left out.
 */
export function describeBreakdown(steps: QuestionStep[], items: BreakdownStep[]): { label: string; amount: number }[] {
  const find = (question: string): { title: string; options?: QuestionOption[]; yesNo?: boolean } | undefined => {
    for (const step of steps) {
      if (step.id === question) return { title: step.title, options: step.options };
      for (const q of step.questions ?? []) if (q.id === question) return { title: q.text, yesNo: true };
      for (const sec of step.sections ?? []) if (sec.id === question) return { title: sec.title, options: sec.options };
    }
    return undefined;
  };
  const out: { label: string; amount: number }[] = [];
  for (const item of items) {
    if (item.kind === 'rounding' && Math.abs(item.amount) < 10) continue;
    let label: string;
    if (item.kind === 'repair') {
      label = 'Repair: ' + (PART_LABELS[item.part ?? ''] ?? item.part ?? 'part');
    } else if (item.kind === 'value' && item.question) {
      const q = find(item.question);
      const title = SHORT_TITLES[item.question] ?? q?.title ?? item.question;
      const names = item.answers.map(a => {
        if (q?.yesNo) return a === 'false' ? 'No' : 'Yes';
        const id = a.startsWith('!') ? a.slice(1) : a;
        return q?.options?.find(o => o.id === id)?.label ?? id;
      });
      label = item.question === 'purchase_location' || !names.length ? title : `${title}: ${names.join(', ')}`;
    } else {
      label = item.kind === 'labour' ? 'Repair labour'
        : item.kind === 'floor' ? 'Lowest offer guarantee'
        : item.kind === 'profit' ? 'Resale market adjustment'
        : 'Rounding';
    }
    out.push({ label, amount: item.amount });
  }
  return out;
}
