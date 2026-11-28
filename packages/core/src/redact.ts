/* Redaction: run before anything reaches admin screens or logs.
 * Removes phone numbers, account and card numbers, emails, identity numbers, OTPs and passwords,
 * plus any contact names the caller knows about. Conservative: when in doubt, it hides. */

const RULES: [RegExp, string][] = [
  // Emails
  [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]'],
  // OTP and PIN phrases: "OTP 482913", "pin is 1234", "code: 55 21 09"
  [/\b(otp|pin|code|password|passcode|pwd)\b(\s*(is|:|=|-))?\s*[A-Z0-9]{3,12}/gi, '$1 [hidden]'],
  // Card numbers (13-19 digits with spaces or dashes)
  [/\b(?:\d[ -]?){13,19}\b/g, '[card]'],
  // Phone numbers: +234 803 123 4567, 0803-123-4567, 08031234567, (0803) 123 4567
  [/(?:\+?\d{1,3}[\s.-]?)?\(?\d{3,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}\b/g, '[phone]'],
  // Account numbers (10-digit NUBAN), BVN and NIN (11 digits) and other long digit runs
  [/\b\d{10,12}\b/g, '[number]'],
];

export function redactText(text: string, knownNames: readonly string[] = []): string {
  let out = text;
  for (const [re, rep] of RULES) out = out.replace(re, rep);
  for (const name of knownNames) {
    const n = name.trim();
    if (n.length < 2) continue;
    out = out.replace(new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), '[name]');
  }
  return out;
}

/** "+2348031234567" → "+234 803 ••• ••67" */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length < 6) return '••••';
  return `${phone.trim().startsWith('+') ? '+' : ''}${d.slice(0, d.length > 11 ? 3 : 1)}${d.length > 11 ? ' ' + d.slice(3, 6) : d.slice(1, 4)} ••• ••${d.slice(-2)}`;
}

/** "ada.obi@gmail.com" → "a•••••@gmail.com" */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!domain) return '•••';
  return `${user.slice(0, 1)}•••••@${domain}`;
}
