/* On-device agent. Understands short requests in English, Pidgin, Yoruba, Igbo, Hausa and French
 * and turns them into actions. Runs with no network; the API uses the same code as its fallback.
 */
import { addDays, fmtDate, fromMin, minOfDay, toMin } from './dates';
import { t } from './i18n';
import { computeReschedule, lateMessage, suggestSlot } from './planner';
import { scamCheck } from './scam';
import type { Action, AgentReply, DateStr, Kind, Lang, PlannerState, Reason, TimeStr } from './types';

/** Lowercase, strip tone marks and Hausa hooked letters, so "Ó rẹ̀ mí" matches "o re mi". */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/ɗ/g, 'd').replace(/ƙ/g, 'k').replace(/ɓ/g, 'b').replace(/[’‘]/g, "'");

const esc = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const reCache = new Map<string, RegExp>();
/** Whole-word match ("hi" must not fire on "this"). A trailing * allows a prefix: "concentr*". */
const wordRe = (p: string) => {
  let re = reCache.get(p);
  if (!re) {
    const prefix = p.endsWith('*');
    const body = esc((prefix ? p.slice(0, -1) : p).trim());
    re = new RegExp('(^|[^a-z0-9])' + body + (prefix ? '' : '(?=$|[^a-z0-9])'));
    reCache.set(p, re);
  }
  return re;
};
const has = (n: string, list: readonly string[]) => list.some((p) => wordRe(p).test(n));

// Matches a phrase in the original text whatever tone marks the user typed.
const LOOSE: Record<string, string> = { d: '[dɗ]', k: '[kƙ]', b: '[bɓ]' };
const loose = (phrase: string) => phrase.split('').map((ch) => {
  if (ch === ' ') return '\\s+';
  if (/[a-z]/i.test(ch)) return (LOOSE[ch] ?? esc(ch)) + '[\\u0300-\\u036f]*';
  return esc(ch);
}).join('');
const strip = (text: string, phrases: string[]) =>
  phrases.reduce((s, p) => s.replace(new RegExp('(^|\\s|,)' + loose(p) + '(?=$|\\s|,|\\.|!|\\?)', 'gi'), ' '), text);

const P = {
  traffic: ['traffic', 'go-slow', 'go slow', 'hold up', 'holdup', 'hold-up', 'stuck', 'sun-kere', 'sunkere', 'okporo uzo', 'cunkoso', 'embouteillage', 'bouchon'],
  late: ['running late', "i'm late", 'im late', 'i am late', 'i dey late', 'i don late', 'late', 'na makara', 'ina makara', 'en retard', 'mo ti pe'],
  power: ['power cut', 'power is out', 'no power', 'no light', 'light don go', 'nepa', 'blackout', 'ina ti lo', 'ko si ina', 'oku anyuola', 'enweghi oku', 'babu wuta', 'wuta ta dauke', 'coupure', 'pas de courant', "pas d'electricite", 'delestage'],
  tired: ['tired', 'exhausted', 'body don tire', 'i don tire', 'i dey tire', 'o re mi', 'ike gwuru m', 'ike agwula m', 'na gaji', 'fatigue', 'epuise*'],
  emergency: ['emergency', 'family issue', 'hospital', 'wahala for house', 'pajawiri', 'ihe mberede', 'gaggawa', 'urgence'],
  focus: ['focus', 'do not disturb', "don't disturb", 'dont disturb', 'no disturb', 'deep work now', 'concentr*', 'ifokansi', 'tinye uche', 'mayar da hankali'],
  brief: ["what's my day", 'whats my day', 'my day', 'what do i have', 'what is next', "what's next", 'whats next', 'today', 'brief', 'agenda', 'wetin dey', 'wetin i get', 'lonii', 'kini o wa', 'ki lo wa', 'gini di', 'taa', 'me ke gare ni', 'yau', "aujourd'hui", 'ma journee', 'programme'],
  greet: ['hello', 'hi', 'hey', 'how far', 'good morning', 'good afternoon', 'good evening', 'bawo', 'e kaaro', 'e kaasan', 'kedu', 'ndewo', 'sannu', 'ina kwana', 'bonjour', 'salut', 'bonsoir'],
  add: ['remind me', 'reminder', 'add task', 'add a task', 'add', 'todo', 'to-do', 'to do', 'i need to', 'i have to', 'abeg', 'make i', 'ran mi leti', 'fi kun', 'chetara m', 'tinye', 'tunatar da ni', 'kara', 'rappelle-moi', 'rappelle moi', 'ajoute', 'je dois'],
  schedule: ['schedule', 'book', 'plan time', 'block time', 'set up a meeting', 'meeting', 'appointment', 'call with', 'fix am', 'seto', 'ipade', 'hazo', 'taro', 'planifie', 'reunion', 'rendez-vous', 'rdv'],
  sleek: ['sleek', 'artisan', 'plumber', 'mechanic', 'electrician', 'carpenter', 'cleaner', 'tailor', 'vulcanizer', 'painter', 'ac technician', 'mecanicien', 'plombier'],
  domestica: ['domestica', 'sweep', 'mop', 'clean the house', 'clean my room', 'clean the living room', 'robot cleaner'],
  afrika: ['afrika i', 'afrika', 'farm', 'patrol', 'drone'],
} as const;

const TOMORROW = ['tomorrow', 'tmrw', 'tmr', 'demain', 'lola', 'ni ola', 'echi', 'gobe'];
const TODAY_WORDS = ['today', 'tonight', "aujourd'hui", 'ce soir', 'lonii', 'taa', 'yau', 'this morning', 'this afternoon', 'this evening'];

/** Finds a clock time: "3pm", "15:30", "18h", "by 6", "at 7.30". Returns minutes after midnight or null. */
export function parseTime(n: string): number | null {
  let m = n.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/);
  if (m) { let h = +m[1] % 12; if (m[3] === 'pm') h += 12; return h * 60 + (+m[2] || 0); }
  m = n.match(/\b(\d{1,2})h(\d{2})?\b/); // French 18h / 18h30
  if (m && +m[1] < 24) return +m[1] * 60 + (+m[2] || 0);
  m = n.match(/\b(?:at|by|for|around|a|vers|ni|na|da|on)\s+(\d{1,2})(?:[:.](\d{2}))?\b/);
  if (m && +m[1] < 24) {
    let h = +m[1];
    if (h >= 1 && h <= 6) h += 12; // "at 4" usually means 4 PM in daily life
    return h * 60 + (+m[2] || 0);
  }
  m = n.match(/\b(\d{1,2}):(\d{2})\b/);
  if (m && +m[1] < 24) return +m[1] * 60 + +m[2];
  return null;
}

export function kindOf(n: string): Kind {
  if (has(n, ['meeting', 'call with', 'meet with', 'interview', 'reunion', 'appel', 'ipade', 'taro', 'zoom', 'teams'])) return 'meeting';
  if (has(n, ['finish', 'write', 'work on', 'study', 'deck', 'report', 'proposal', 'design', 'code', 'read', 'prepare', 'rediger', 'travailler'])) return 'deep';
  if (has(n, ['buy', 'pick up', 'pickup', 'bank', 'market', 'diesel', 'fuel', 'petrol', 'shop', 'pay', 'acheter', 'marche', 'oja', 'ahia', 'kasuwa'])) return 'errand';
  return 'personal';
}

/** Pulls the "what" out of a request by removing trigger words, times and day words. */
export function extractTitle(text: string): string {
  let s = text.normalize('NFD');
  s = strip(s, [...P.add, ...P.schedule.filter((p) => p !== 'meeting'), 'please', 'pls', 'abeg', 'for me', 'jowo', 'biko', 'don allah', "s'il te plait", 'stp']);
  s = strip(s, [...TOMORROW, ...TODAY_WORDS]);
  s = s.replace(/\b(?:at|by|for|around|à|a|vers|ni|na|da|on)\s+\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm)?\b/gi, ' ')
    .replace(/\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/gi, ' ')
    .replace(/\b\d{1,2}h\d{0,2}\b/gi, ' ');
  // Leading glue words ("to", "make I", "láti", "d'") and prepositions left behind by the time ("at", "ní", "à").
  const LEAD = ['time to', 'time for', 'to', 'that', 'make i', 'say', 'i', 'de', 'lati', 'ka m', 'in', 'me'];
  for (let i = 0; i < 2; i++) {
    s = s.replace(new RegExp('^[\\s,:-]*(?:' + LEAD.map(loose).join('|') + ')\\s+', 'i'), ' ');
    s = s.replace(/^[\s,:-]*d'\s*/i, ' ');
  }
  s = s.replace(new RegExp('\\s+(?:' + ['at', 'by', 'on', 'for', 'a', 'vers', 'ni', 'na', 'da'].map(loose).join('|') + ')[\\s,.]*$', 'i'), '');
  s = s.normalize('NFC').replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;!?-]+$/g, '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

const cap = (x: string) => (x ? x.charAt(0).toUpperCase() + x.slice(1) : x);
/** A phone number written in the message, if any ("call 0803 123 4567"). */
const phoneIn = (x: string) => { const m = x.match(/\+?\d[\d\s-]{6,}\d/); return m ? m[0].replace(/[\s-]/g, '') : null; };

export interface AgentContext {
  lang: Lang;
  now: Date;
  /** Formats HH:MM for display in the user's language. */
  fmtTime: (t: TimeStr) => string;
}

export function whenLabel(lang: Lang, date: DateStr, start: TimeStr | null, now: Date, fmtTime: (t: TimeStr) => string) {
  const d0 = fmtDate(now);
  const day = date === d0 ? t(lang, 'today') : date === addDays(d0, 1) ? t(lang, 'tomorrow') : date;
  return start ? `${day}, ${fmtTime(start)}` : day;
}

/** Answers one message. Returns text plus proposed actions; the app decides when to run them. */
export function respond(text: string, state: PlannerState, ctx: AgentContext): AgentReply {
  const { lang, now, fmtTime } = ctx;
  const n = norm(text);
  const reply = (key: string, vars?: Record<string, string | number>, actions: Action[] = [], draft?: string): AgentReply =>
    ({ text: t(lang, key, vars), actions, draft, source: 'device' });

  // 1. Life happened: reschedule.
  for (const reason of ['emergency', 'power', 'traffic', 'tired', 'late'] as Reason[]) {
    if (has(n, P[reason])) {
      const { moves, fixedSoon } = computeReschedule(state, reason, now);
      if (!moves.length && !fixedSoon) return reply('nothing');
      if (!moves.length && fixedSoon) return reply('draft', undefined, [], lateMessage(reason, fixedSoon));
      return reply(reason, { n: moves.length }, [{ type: 'reschedule', reason, moves }], fixedSoon ? lateMessage(reason, fixedSoon) : undefined);
    }
  }

  // 2. ID'd: "is this a scam: …" checks the message right here, on the phone.
  const scam = text.match(/^\s*(?:is\s+this\s+(?:a\s+)?scam|check\s+this(?:\s+message)?|scam\s+check|na\s+scam\s+be\s+this|est-ce\s+une\s+arnaque)\s*[:?\-]?\s*([\s\S]{10,})$/iu);
  if (scam) {
    const r = scamCheck(scam[1]);
    const verdict = r.level === 'high' ? 'This looks like a scam.' : r.level === 'medium' ? 'Be careful with this one.' : 'I see no common scam signs, but never share codes, PINs or your BVN.';
    return { text: [verdict, ...r.reasons.slice(0, 3)].join(' '), actions: [], source: 'device' };
  }

  // 2b. The rest of the Me AI family: book a Sleek artisan, command Domestica I or Afrika I.
  if (has(n, P.sleek)) {
    const trade = (n.match(/\b(plumber|mechanic|electrician|carpenter|cleaner|tailor|vulcanizer|painter|ac technician|technician|artisan|mecanicien|plombier)\b/) ?? [])[1] ?? 'artisan';
    const tm = parseTime(n);
    const date = has(n, TOMORROW) ? addDays(fmtDate(now), 1) : tm !== null ? fmtDate(now) : null;
    const tradeName = trade === 'mecanicien' ? 'mechanic' : trade === 'plombier' ? 'plumber' : trade;
    return reply('ecosystemSleek', { trade: tradeName }, [{ type: 'ecosystem', product: 'sleek', command: `book ${tradeName}`, detail: text.trim().slice(0, 300), date, start: tm !== null ? fromMin(tm) : null }]);
  }
  if (has(n, P.domestica)) {
    const command = /\b(status|battery|where)\b/.test(n) ? 'status' : /\b(map|scan)\b/.test(n) ? 'map rooms' : /\bmop\b/.test(n) ? 'mop' : 'sweep';
    return reply('ecosystemDevice', { name: 'Domestica I', command }, [{ type: 'ecosystem', product: 'domestica', command, detail: text.trim().slice(0, 300), date: null, start: null }]);
  }
  if (has(n, P.afrika)) {
    const command = /\b(status|battery|report|where)\b/.test(n) ? 'status' : 'patrol';
    return reply('ecosystemDevice', { name: 'Afrika I', command }, [{ type: 'ecosystem', product: 'afrika', command, detail: text.trim().slice(0, 300), date: null, start: null }]);
  }

  // 3. Focus protection.
  if (has(n, P.focus)) {
    const m = n.match(/(\d{1,3})\s*(?:min|minutes|mins|m\b|iseju|nkeji|minti)/);
    const hr = n.match(/(\d)\s*(?:hour|hr|heure|wakati|awa|sa'?a)/);
    const mins = m ? Math.min(180, Math.max(5, +m[1])) : hr ? Math.min(180, +hr[1] * 60) : state.focusMins;
    return reply('focus', { m: mins }, [{ type: 'focus', mins }]);
  }

  // 3b. "Remember that…": personal facts the user wants Ugent to keep.
  const mem = text.match(/^\s*(?:please\s+|abeg\s+)?(?:remember(?:\s+that)?|don'?t\s+forget(?:\s+that)?|make\s+you\s+remember(?:\s+say)?|no\s+forget(?:\s+say)?|r[aá]n?t[ií]\s+p[eé]|cheta(?:\s+na)?|ka\s+tuna(?:\s+cewa)?|souviens[- ]toi(?:\s+que)?|retiens(?:\s+que)?)\s+(.{3,280})$/iu);
  if (mem) {
    const fact = cap(mem[1].trim().replace(/[.!]+$/, ''));
    return reply('rememberAction', { fact }, [{ type: 'remember', text: fact }]);
  }

  // 4. Real actions through connected apps: call, message, directions. Only when asked to do it now
  //    (a time or "remind me" makes it a reminder instead, handled below).
  const now_ = !has(n, P.add) && parseTime(n) === null;
  const call = text.match(/^\s*(?:please\s+|abeg\s+)?(?:call|ring|phone|dial|pe|kpoo|kpọọ|kira|appelle|appeler)\s+([\p{L}' .-]{1,60}?)\s*(?:now|for me|abeg|biko|please)?[.!?]*\s*$/iu);
  if (call && now_) {
    const name = cap(call[1].trim());
    return reply('callAction', { name }, [{ type: 'call', name, phone: phoneIn(text) }]);
  }
  const msg = text.match(/^\s*(?:please\s+)?(tell|message|text|whatsapp|sms)\s+([\p{L}'-]+)\s*(?:that\s+|say\s+|to\s+)?(.*)$/iu);
  if (msg && now_) {
    const who = cap(msg[2]);
    let body = (msg[3] || '').trim().replace(/^i'?m\b/i, "I'm").replace(/^i\b/, 'I');
    body = body ? cap(body) : 'Just checking in.';
    if (!/[.!?]$/.test(body)) body += '.';
    const channel = /^(text|sms)$/i.test(msg[1]) ? 'sms' : 'whatsapp';
    return reply('messageAction', { name: who, app: channel === 'sms' ? 'SMS' : 'WhatsApp' },
      [{ type: 'message', channel, name: who, phone: phoneIn(text), text: `Hi ${who}, ${body}` }]);
  }
  const dir = text.match(/(?:directions?\s+to|how\s+(?:do|can)\s+i\s+get\s+to|take\s+me\s+to|navigate\s+to|route\s+to|itin[ée]raire\s+(?:vers|pour)|show\s+me\s+(?:the\s+)?(?:way|road)\s+to|road\s+go)\s+(.{2,120}?)[.!?]*\s*$/iu);
  if (dir) {
    const place = cap(dir[1].trim());
    return reply('directionsAction', { place }, [{ type: 'directions', destination: place }]);
  }

  // 5. Add a task or a plan.
  if (has(n, P.add) || has(n, P.schedule)) {
    const title = extractTitle(text);
    if (title) {
      const tm = parseTime(n);
      const date = has(n, TOMORROW) ? addDays(fmtDate(now), 1) : fmtDate(now);
      const kind = kindOf(n);
      if (tm !== null || has(n, P.schedule)) {
        const dur = kind === 'meeting' ? 60 : kind === 'deep' ? 90 : 30;
        const slot = tm !== null ? { date, start: fromMin(tm) } : suggestSlot(state, kind, dur, now, date);
        return reply('eventAdded', { title, when: whenLabel(lang, slot.date, slot.start, now, fmtTime) },
          [{ type: 'addEvent', title, date: slot.date, start: slot.start, dur, kind }]);
      }
      return reply('taskAdded', { title }, [{ type: 'addTask', title, date }]);
    }
  }

  // 6. What's my day?
  if (has(n, P.brief)) {
    const d0 = fmtDate(now);
    const evs = state.events.filter((e) => !e.deleted && e.date === d0);
    const open = state.tasks.filter((x) => !x.deleted && !x.done && x.date <= d0);
    const next = evs.filter((e) => toMin(e.start) >= minOfDay(now)).sort((a, b) => a.start.localeCompare(b.start))[0];
    const lines = [t(lang, 'brief', { e: evs.length, t: open.length }), next ? t(lang, 'next', { title: next.title, time: fmtTime(next.start) }) : t(lang, 'nonext')];
    return { text: lines.join(' '), actions: [], source: 'device' };
  }

  // 7. Greeting.
  if (has(n, P.greet) && n.length < 40) return reply('greet', { name: state.name });

  return reply('help');
}
