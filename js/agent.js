/* Ugent — on-device agent.
 * Understands short requests in English, Pidgin, Yoruba, Igbo, Hausa and French, and turns them into actions.
 * It runs fully offline. A cloud model (Me AI Labs) can be plugged in behind `Agent.respond` when online.
 */
(function () {
  const { today, addDays, fromMin } = Store.date;
  const nowMin = () => Store.date.nowMin();

  // Lowercase, strip accents/tone marks and Hausa hooked letters so "Ó rẹ̀ mí" matches "o re mi".
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/ɗ/g, 'd').replace(/ƙ/g, 'k').replace(/ɓ/g, 'b').replace(/[’‘]/g, "'");
  const esc = (c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Whole-word match ("hi" must not fire on "this"). A trailing * allows a word prefix: "concentr*".
  const cache = new Map();
  const wordRe = (p) => {
    if (!cache.has(p)) {
      const prefix = p.endsWith('*');
      const body = esc((prefix ? p.slice(0, -1) : p).trim());
      cache.set(p, new RegExp('(^|[^a-z0-9])' + body + (prefix ? '' : '(?=$|[^a-z0-9])')));
    }
    return cache.get(p);
  };
  const has = (n, list) => list.some((p) => wordRe(p).test(n));

  // Builds a regex that matches a phrase in the original text, whatever tone marks the user typed.
  const LOOSE = { d: '[dɗ]', k: '[kƙ]', b: '[bɓ]' };
  function loose(phrase) {
    return phrase.split('').map((ch) => {
      if (ch === ' ') return '\\s+';
      if (/[a-z]/i.test(ch)) return (LOOSE[ch] || esc(ch)) + '[\\u0300-\\u036f]*';
      return esc(ch);
    }).join('');
  }
  const strip = (text, phrases) =>
    phrases.reduce((s, p) => s.replace(new RegExp('(^|\\s|,)' + loose(p) + '(?=$|\\s|,|\\.|!|\\?)', 'gi'), ' '), text);

  const P = {
    traffic: ['traffic', 'go-slow', 'go slow', 'hold up', 'holdup', 'hold-up', 'stuck', 'sun-kere', 'sunkere', 'okporo uzo', 'cunkoso', 'embouteillage', 'bouchon'],
    late: ['running late', "i'm late", 'im late', 'i am late', 'i dey late', 'i don late', 'late', 'na makara', 'ina makara', 'en retard', 'mo ti pe', 'abiala m n\'oge'],
    power: ['power cut', 'power is out', 'no power', 'no light', 'light don go', 'nepa', 'blackout', 'ina ti lo', 'ko si ina', 'oku anyuola', 'enweghi oku', 'babu wuta', 'wuta ta dauke', 'coupure', 'pas de courant', 'pas d\'electricite', 'delestage'],
    tired: ['tired', 'exhausted', 'body don tire', 'i don tire', 'i dey tire', 'o re mi', 'ike gwuru m', 'ike agwula m', 'na gaji', 'fatigue', 'epuise*'],
    emergency: ['emergency', 'family issue', 'hospital', 'wahala for house', 'pajawiri', 'ihe mberede', 'gaggawa', 'urgence'],
    focus: ['focus', 'do not disturb', "don't disturb", 'dont disturb', 'no disturb', 'deep work now', 'concentr*', 'ifokansi', 'tinye uche', 'mayar da hankali'],
    brief: ["what's my day", 'whats my day', 'my day', 'what do i have', 'what is next', "what's next", 'whats next', 'today', 'brief', 'agenda', 'wetin dey', 'wetin i get', 'lonii', 'kini o wa', 'ki lo wa', 'gini di', 'taa', 'me ke gare ni', 'yau', "aujourd'hui", 'ma journee', 'programme'],
    greet: ['hello', 'hi', 'hey', 'how far', 'good morning', 'good afternoon', 'good evening', 'bawo', 'e kaaro', 'e kaasan', 'kedu', 'ndewo', 'sannu', 'ina kwana', 'bonjour', 'salut', 'bonsoir'],
    add: ['remind me', 'reminder', 'add task', 'add a task', 'add', 'todo', 'to-do', 'to do', 'i need to', 'i have to', 'abeg', 'make i', 'ran mi leti', 'fi kun', 'chetara m', 'tinye', 'tunatar da ni', 'kara', 'rappelle-moi', 'rappelle moi', 'ajoute', 'je dois'],
    schedule: ['schedule', 'book', 'plan time', 'block time', 'set up a meeting', 'meeting', 'appointment', 'call with', 'fix am', 'seto', 'ipade', 'hazo', 'taro', 'planifie', 'reunion', 'rendez-vous', 'rdv'],
    message: ['tell ', 'message ', 'text ', 'whatsapp ', 'sms ', 'send a message', 'sọ fun', 'so fun ', 'gwa ', 'gaya wa', 'dis a ', 'ecris a '],
    sleek: ['sleek', 'artisan', 'plumber', 'mechanic', 'electrician', 'carpenter', 'cleaner', 'tailor', 'vulcanizer', 'mecanicien', 'plombier'],
    domestica: ['domestica', 'sweep', 'mop', 'clean the house', 'clean my room'],
    afrika: ['afrika i', 'farm', 'patrol', 'drone'],
  };

  const TOMORROW = ['tomorrow', 'tmrw', 'tmr', 'demain', 'lola', 'ni ola', 'echi', 'gobe'];
  const TODAY_WORDS = ['today', 'tonight', "aujourd'hui", 'ce soir', 'lonii', 'taa', 'yau', 'this morning', 'this afternoon', 'this evening'];

  /* Finds a clock time: "3pm", "15:30", "18h", "by 6", "at 7.30". Returns minutes or null. */
  function parseTime(n) {
    let m = n.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/);
    if (m) {
      let h = +m[1] % 12; if (m[3] === 'pm') h += 12;
      return { min: h * 60 + (+m[2] || 0), raw: m[0] };
    }
    m = n.match(/\b(\d{1,2})h(\d{2})?\b/); // French 18h / 18h30
    if (m && +m[1] < 24) return { min: +m[1] * 60 + (+m[2] || 0), raw: m[0] };
    m = n.match(/\b(?:at|by|for|around|a|vers|ni|na|da|on)\s+(\d{1,2})(?:[:.](\d{2}))?\b/);
    if (m && +m[1] < 24) {
      let h = +m[1];
      if (h >= 1 && h <= 6) h += 12; // "at 4" usually means 4 PM in daily life
      return { min: h * 60 + (+m[2] || 0), raw: m[0] };
    }
    m = n.match(/\b(\d{1,2}):(\d{2})\b/);
    if (m && +m[1] < 24) return { min: +m[1] * 60 + +m[2], raw: m[0] };
    return null;
  }

  function kindOf(n) {
    if (has(n, ['meeting', 'call with', 'meet with', 'interview', 'reunion', 'appel', 'ipade', 'taro', 'zoom', 'teams'])) return 'meeting';
    if (has(n, ['finish', 'write', 'work on', 'study', 'deck', 'report', 'proposal', 'design', 'code', 'read', 'prepare', 'rediger', 'travailler'])) return 'deep';
    if (has(n, ['buy', 'pick up', 'pickup', 'bank', 'market', 'diesel', 'fuel', 'petrol', 'shop', 'pay', 'acheter', 'marche', 'oja', 'ahia', 'kasuwa'])) return 'errand';
    return 'personal';
  }

  /* Pulls the "what" out of a request by removing trigger words, times and day words. */
  function extractTitle(text) {
    let s = text.normalize('NFD');
    s = strip(s, [...P.add, ...P.schedule.filter((p) => p !== 'meeting'), 'please', 'pls', 'abeg', 'for me', 'jowo', 'biko', 'don allah', 's\'il te plait', 'stp']);
    s = strip(s, [...TOMORROW, ...TODAY_WORDS]);
    s = s.replace(/\b(?:at|by|for|around|à|a|vers|ni|na|da|on)\s+\d{1,2}(?:[:.h]\d{2})?\s*(?:am|pm)?\b/gi, ' ')
      .replace(/\b\d{1,2}(?:[:.]\d{2})?\s*(?:am|pm)\b/gi, ' ')
      .replace(/\b\d{1,2}h\d{0,2}\b/gi, ' ');
    // Leading glue words ("to", "make I", "láti", "d'") and dangling prepositions left by the time ("at", "ní", "à").
    const LEAD = ['time to', 'time for', 'to', 'that', 'make i', 'say', 'i', 'de', 'lati', 'ka m', 'in', 'me'];
    for (let i = 0; i < 2; i++) {
      s = s.replace(new RegExp('^[\\s,:-]*(?:' + LEAD.map(loose).join('|') + ')\\s+', 'i'), ' ');
      s = s.replace(/^[\s,:-]*d'\s*/i, ' ');
    }
    s = s.replace(new RegExp('\\s+(?:' + ['at', 'by', 'on', 'for', 'a', 'vers', 'ni', 'na', 'da'].map(loose).join('|') + ')[\\s,.]*$', 'i'), '');
    s = s.normalize('NFC').replace(/\s+/g, ' ').replace(/^[\s,.:;-]+|[\s,.:;!?-]+$/g, '').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }

  function whenLabel(date, start, fmtTime) {
    const d0 = today();
    const day = date === d0 ? I18n.t('today') : date === addDays(d0, 1) ? I18n.t('tomorrow') : date;
    return start ? day + ', ' + fmtTime(start) : day;
  }

  /**
   * respond(text, state, helpers) -> { text, actions[], extra? }
   * Actions are plain objects the app can confirm and run: addTask, addEvent, reschedule, focus, draft.
   */
  function respond(text, state, h) {
    const n = norm(text);
    const name = state.profile.name || '';
    const out = (key, vars, actions, extra) => ({ text: I18n.t(key, vars), actions: actions || [], extra });

    // 1. Life happened: reschedule.
    for (const reason of ['emergency', 'power', 'traffic', 'tired', 'late']) {
      if (has(n, P[reason]) && !(reason === 'late' && has(n, ['later']))) {
        const result = Planner.computeReschedule(state, reason);
        if (!result.moves.length) return out('nothing');
        const action = { type: 'reschedule', reason, result };
        let extra = null;
        if (result.fixedSoon) {
          const mins = reason === 'traffic' ? 45 : 30;
          extra = { type: 'draft', text: `Hi, I'm running about ${mins} minutes late for "${result.fixedSoon.title}" because of ${reason === 'traffic' ? 'traffic' : 'a delay'}. Sorry, I'm on my way.` };
        }
        return out(reason, { n: result.moves.length }, [action], extra);
      }
    }

    // 2. Connected products (coming soon).
    if (has(n, P.sleek)) return out('connect', { name: 'Sleek' });
    if (has(n, P.domestica)) return out('connect', { name: 'Domestica I' });
    if (has(n, P.afrika)) return out('connect', { name: 'Afrika I' });

    // 3. Focus protection.
    if (has(n, P.focus)) {
      const m = n.match(/(\d{1,3})\s*(?:min|minutes|mins|m\b|iseju|nkeji|minti)/);
      const hr = n.match(/(\d)\s*(?:hour|hr|heure|wakati|awa|sa'?a)/);
      const mins = m ? Math.min(180, +m[1]) : hr ? Math.min(180, +hr[1] * 60) : state.settings.focusMins;
      return out('focus', { m: mins }, [{ type: 'focus', mins }]);
    }

    // 4. Draft a message to someone.
    const msg = text.match(/^\s*(?:please\s+)?(?:tell|message|text|whatsapp|sms)\s+([\p{L}'-]+)\s*(?:that\s+|say\s+|to\s+)?(.*)$/iu);
    if (msg) {
      const who = msg[1].charAt(0).toUpperCase() + msg[1].slice(1);
      let body = (msg[2] || '').trim().replace(/^i'?m\b/i, "I'm").replace(/^i\b/, 'I');
      body = body ? body.charAt(0).toUpperCase() + body.slice(1) : 'Just checking in.';
      if (!/[.!?]$/.test(body)) body += '.';
      return out('draft', null, [], { type: 'draft', text: `Hi ${who}, ${body}` });
    }

    // 5. Add a task or a plan.
    const wantsAdd = has(n, P.add) || has(n, P.schedule);
    if (wantsAdd) {
      const title = extractTitle(text);
      if (title) {
        const tm = parseTime(n);
        const date = has(n, TOMORROW) ? addDays(today(), 1) : today();
        const kind = kindOf(n);
        const isPlan = !!tm || has(n, P.schedule);
        if (isPlan) {
          const dur = kind === 'meeting' ? 60 : kind === 'deep' ? 90 : 30;
          const slot = tm ? { date, start: fromMin(tm.min) } : Planner.suggestSlot(state, kind, dur, date);
          const ev = { type: 'addEvent', title, date: slot.date, start: slot.start, dur, kind, needsPower: kind === 'meeting' || kind === 'deep' };
          return out('eventAdded', { title, when: whenLabel(slot.date, slot.start, h.fmtTime) }, [ev]);
        }
        return out('taskAdded', { title }, [{ type: 'addTask', title, date }]);
      }
    }

    // 6. What's my day?
    if (has(n, P.brief)) {
      const d0 = today();
      const evs = state.events.filter((e) => e.date === d0);
      const tks = state.tasks.filter((t) => !t.done && t.date <= d0);
      const next = evs.filter((e) => Store.date.toMin(e.start) >= nowMin()).sort((a, b) => a.start.localeCompare(b.start))[0];
      const lines = [I18n.t('brief', { e: evs.length, t: tks.length })];
      lines.push(next ? I18n.t('next', { title: next.title, time: h.fmtTime(next.start) }) : I18n.t('nonext'));
      return { text: lines.join(' '), actions: [] };
    }

    // 7. Greeting.
    if (has(n, P.greet) && n.length < 40) return out('greet', { name: name || '' });

    return out('help');
  }

  window.Agent = { respond, parseTime, extractTitle, norm };
})();
