/* A quick, on-device check for common scam patterns in a message (a preview of ID'd by Me AI).
 * It looks for the tricks scammers use most in Nigeria and across Africa. It is a warning, not proof.
 */
export type ScamLevel = 'high' | 'medium' | 'low';
export interface ScamResult { level: ScamLevel; reasons: string[] }

const SIGNALS: { re: RegExp; weight: number; reason: string }[] = [
  { re: /\b(otp|one[- ]time (pass)?code|pin|bvn|nin|password|cvv|card (number|details)|token code)\b/i, weight: 3, reason: 'It asks for a code, PIN, BVN or card details. Your bank will never ask for these.' },
  { re: /\b(urgent(ly)?|immediately|right now|within (24|48) ?hours|account (will be|has been) (blocked|suspended|restricted|frozen)|last warning)\b/i, weight: 2, reason: 'It rushes you or threatens to block your account.' },
  { re: /\b(you (have )?won|winner|lucky (draw|number)|promo|grant|free (money|airtime|data)|claim your (prize|reward))\b/i, weight: 2, reason: 'It promises a prize, grant or free money.' },
  { re: /\b(processing|clearance|registration|release|activation|delivery) fee\b|pay (a )?(small )?fee/i, weight: 3, reason: 'It asks you to pay a fee to receive money or a job.' },
  { re: /\b(send|transfer|pay)\b.{0,30}\b(money|naira|₦|\d{3,}|account)\b/i, weight: 2, reason: 'It asks you to send money.' },
  { re: /\b(new (number|line)|changed? (my )?(number|account)|use this account|account number has changed)\b/i, weight: 2, reason: 'It says a number or bank account has changed. Confirm by calling the person on their old number.' },
  { re: /\b(cbn|efcc|customer care|customer service|support team|bank officer|mtn|airtel|glo|9mobile)\b/i, weight: 1, reason: 'It claims to be from a bank, agency or network.' },
  { re: /(https?:\/\/|www\.|bit\.ly|tinyurl|t\.me\/|wa\.me\/)/i, weight: 1, reason: 'It has a link. Do not open links you did not expect.' },
  { re: /\b(double your money|investment opportunity|guaranteed (profit|returns)|crypto|forex|ponzi)\b/i, weight: 2, reason: 'It promises big or guaranteed returns.' },
  { re: /\b(job offer|you have been (selected|shortlisted))\b/i, weight: 1, reason: 'It offers a job you did not apply for.' },
];

export function scamCheck(text: string): ScamResult {
  const reasons: string[] = [];
  let score = 0;
  for (const s of SIGNALS) if (s.re.test(text)) { score += s.weight; reasons.push(s.reason); }
  const level: ScamLevel = score >= 4 ? 'high' : score >= 2 ? 'medium' : 'low';
  return { level, reasons };
}
