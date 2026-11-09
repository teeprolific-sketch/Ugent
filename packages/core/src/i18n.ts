/* Ugent copy in English, Pidgin, Yoruba, Igbo, Hausa and French.
 * Missing keys fall back to English. Have native speakers review yo/ig/ha/pcm before launch.
 */
import type { Lang } from './types';

export interface LangMeta { code: Lang; name: string; native: string; locale: string; speech: string; aliases: string[] }

export const LANG_META: LangMeta[] = [
  { code: 'en', name: 'English', native: 'English', locale: 'en-NG', speech: 'en-NG', aliases: ['english', 'oyinbo'] },
  { code: 'pcm', name: 'Pidgin', native: 'Naija Pidgin', locale: 'en-NG', speech: 'en-NG', aliases: ['pidgin', 'naija', 'broken english', 'pijin'] },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá', locale: 'yo-NG', speech: 'yo-NG', aliases: ['yoruba', 'yorouba'] },
  { code: 'ig', name: 'Igbo', native: 'Asụsụ Igbo', locale: 'ig-NG', speech: 'ig-NG', aliases: ['igbo', 'ibo'] },
  { code: 'ha', name: 'Hausa', native: 'Harshen Hausa', locale: 'ha-NG', speech: 'ha-NG', aliases: ['hausa', 'haoussa'] },
  { code: 'fr', name: 'French', native: 'Français', locale: 'fr-FR', speech: 'fr-FR', aliases: ['french', 'francais', 'français'] },
];

export const langMeta = (code: Lang): LangMeta => LANG_META.find((l) => l.code === code) ?? LANG_META[0];

const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
/** Languages matching a search ("pidgin", "yoruba", "franc"); every language for an empty query. */
export function searchLangs(query: string): LangMeta[] {
  const q = fold(query);
  if (!q) return LANG_META;
  return LANG_META.filter((l) => [l.name, l.native, l.code, ...l.aliases].some((x) => fold(x).includes(q)));
}

const T: Record<Lang, Record<string, string>> = {
    en: {
      'nav.home': 'Home', 'nav.chat': 'Chat', 'nav.schedule': 'Plan', 'nav.tasks': 'Tasks', 'nav.more': 'More',
      morning: 'Good morning', afternoon: 'Good afternoon', evening: 'Good evening',
      'home.brief': 'Your brief', 'home.next': 'Next up', 'home.tasks': 'Top tasks', 'home.talk': 'Talk to Ugent',
      'home.focus': 'Start focus', 'home.energy': 'How is your energy?', 'chat.placeholder': 'Message Ugent',
      'energy.low': 'Low', 'energy.ok': 'Okay', 'energy.high': 'High',

      greet: 'Hi {name}. How can I help today?',
      brief: 'Today you have {e} plans and {t} tasks.',
      next: 'Next up: {title} at {time}.',
      nonext: 'Nothing else is scheduled today.',
      taskAdded: 'Added to your tasks: {title}.',
      eventAdded: 'Scheduled: {title}, {when}.',
      traffic: 'Traffic happens. I can move {n} plans back 45 minutes.',
      power: 'Power is out. I can move {n} plans that need power to later.',
      late: 'No wahala. I can push {n} plans back 30 minutes.',
      tired: 'Rest matters. I can move {n} heavy plans to your best time tomorrow.',
      emergency: 'Family first. I can move the rest of today, {n} plans, to tomorrow.',
      nothing: 'There is nothing left to move today.',
      focus: 'Focus mode for {m} minutes. I will hold your notifications.',
      connect: '{name} is coming soon. I will tell you when you can connect it.',
      draft: 'Here is a message you can send:',
      help: 'Try: "Remind me to call Mum at 6pm", "I\'m stuck in traffic" or "What\'s my day?"',
      confirm: 'Shall I do this?',
      done: 'Done.',
      cancelled: 'Okay, I won\'t do that.',
      headsTraffic: 'Evening traffic builds after 4 PM. Leave 45 minutes early for {title} at {time}.',
      headsPower: 'Charge your laptop and power bank before {title} at {time}, in case power goes.',
      headsPeak: 'Your best energy is in the {peak}. I keep that time for important work.',
      'peak.morning': 'morning', 'peak.afternoon': 'afternoon', 'peak.evening': 'evening',
      callAction: 'I can call {name} for you.',
      messageAction: 'I wrote a message for {name}. I will open {app} so you can send it.',
      directionsAction: 'I can open directions to {place}.',
      rememberAction: 'Got it. I will remember: {fact}.',
      ecosystemSleek: 'Sleek is not live yet. I can save your request for a {trade} and add a reminder to arrange one.',
      ecosystemDevice: '{name} is not connected yet. I can save "{command}" and run it when you connect it.',
      today: 'today', tomorrow: 'tomorrow',
    },
    pcm: {
      'nav.home': 'Home', 'nav.chat': 'Talk', 'nav.schedule': 'Plan', 'nav.tasks': 'Work', 'nav.more': 'More',
      morning: 'Good morning o', afternoon: 'Good afternoon o', evening: 'Good evening o',
      'home.brief': 'Your brief', 'home.next': 'Wetin dey next', 'home.tasks': 'Main work', 'home.talk': 'Talk to Ugent',
      'home.focus': 'Start focus', 'home.energy': 'How your body dey?', 'chat.placeholder': 'Talk to Ugent',
      'energy.low': 'E don tire', 'energy.ok': 'I dey okay', 'energy.high': 'I strong',

      greet: 'How far {name}? Wetin I fit do for you today?',
      brief: 'Today you get {e} plan and {t} work wey you go do.',
      next: 'Next one na {title} by {time}.',
      nonext: 'Nothing remain for today schedule.',
      taskAdded: 'I don add am to your work: {title}.',
      eventAdded: 'I don fix am: {title}, {when}.',
      traffic: 'Traffic na normal thing. I fit push {n} plan go back by 45 minutes.',
      power: 'Light don go. I fit move {n} plan wey need light go later.',
      late: 'No wahala. I fit push {n} plan back by 30 minutes.',
      tired: 'Rest dey important. I fit move {n} heavy plan go tomorrow when your body go strong.',
      emergency: 'Family first. I fit move the {n} plan wey remain today go tomorrow.',
      nothing: 'Nothing remain wey I fit move today.',
      focus: 'Focus mode for {m} minutes. I go hold your notifications.',
      connect: '{name} dey come soon. I go tell you when you fit connect am.',
      draft: 'See message wey you fit send:',
      help: 'Try talk: "Remind me make I call Mama by 6pm", "Traffic don hold me" or "Wetin dey my day?"',
      confirm: 'Make I do am?',
      done: 'E don do.',
      cancelled: 'Okay, I no go do am.',
      headsTraffic: 'Traffic go heavy after 4 PM. Comot 45 minutes early for {title} by {time}.',
      headsPower: 'Charge your laptop and power bank before {title} by {time}, in case light go.',
      headsPeak: 'Your body dey strong pass for {peak}. I keep that time for important work.',
      'peak.morning': 'morning', 'peak.afternoon': 'afternoon', 'peak.evening': 'evening',
      callAction: 'I fit call {name} for you.',
      messageAction: 'I don write message for {name}. I go open {app} make you send am.',
      directionsAction: 'I fit show you road go {place}.',
      rememberAction: 'I don hear. I go remember: {fact}.',
      ecosystemSleek: 'Sleek never start yet. I fit save your request for {trade} and remind you make you arrange one.',
      ecosystemDevice: '{name} never connect yet. I fit save "{command}" and do am when you connect am.',
      today: 'today', tomorrow: 'tomorrow',
    },
    yo: {
      'nav.home': 'Ilé', 'nav.chat': 'Ọ̀rọ̀', 'nav.schedule': 'Ètò', 'nav.tasks': 'Iṣẹ́', 'nav.more': 'Míràn',
      morning: 'Ẹ kú àárọ̀', afternoon: 'Ẹ kú ọ̀sán', evening: 'Ẹ kú ìrọ̀lẹ́',
      'home.brief': 'Àkópọ̀ ọjọ́ rẹ', 'home.next': 'Èyí tó kàn', 'home.tasks': 'Iṣẹ́ pàtàkì', 'home.talk': 'Bá Ugent sọ̀rọ̀',
      'home.focus': 'Bẹ̀rẹ̀ ìfọkànsí', 'home.energy': 'Báwo ni agbára rẹ?', 'chat.placeholder': 'Kọ̀wé sí Ugent',
      'energy.low': 'Ó rẹ̀ mí', 'energy.ok': 'Mo wà dáadáa', 'energy.high': 'Mo lágbára',

      greet: 'Báwo ni {name}? Kí ni mo lè ṣe fún ọ lónìí?',
      brief: 'Lónìí, o ní ètò {e} àti iṣẹ́ {t}.',
      next: 'Èyí tó kàn: {title} ní {time}.',
      nonext: 'Kò sí ètò mìíràn lónìí.',
      taskAdded: 'Mo ti fi kún iṣẹ́ rẹ: {title}.',
      eventAdded: 'Mo ti ṣètò rẹ̀: {title}, {when}.',
      traffic: 'Sún-kẹrẹ-fà-kẹrẹ ni. Mo lè sún ètò {n} sí ìṣẹ́jú 45 lẹ́yìn.',
      power: 'Iná ti lọ. Mo lè sún ètò {n} tó nílò iná sí ìgbà mìíràn.',
      late: 'Kò sí wàhálà. Mo lè sún ètò {n} sí ìṣẹ́jú 30 lẹ́yìn.',
      tired: 'Ìsinmi ṣe pàtàkì. Mo lè gbé ètò {n} tó le sí ọ̀la.',
      emergency: 'Ìdílé ló ṣáájú. Mo lè gbé ètò {n} tó kù sí ọ̀la.',
      nothing: 'Kò sí ohun tí mo lè sún lónìí.',
      focus: 'Ìfọkànsí fún ìṣẹ́jú {m}. Màá dá ìfitónilétí rẹ dúró.',
      connect: '{name} ń bọ̀ láìpẹ́. Màá sọ fún ọ nígbà tó bá ṣetán.',
      draft: 'Èyí ni ọ̀rọ̀ tí o lè fi ránṣẹ́:',
      help: 'Gbìyànjú: "Rán mi létí láti pe Màmá ní 6pm" tàbí "Kí ló wà fún mi lónìí?"',
      confirm: 'Ṣé kí n ṣe é?',
      done: 'Ó ti parí.',
      cancelled: 'Ó dáa, mi ò ní ṣe é.',
      headsTraffic: 'Ọ̀nà máa ń dí lẹ́yìn agogo mẹ́rin. Kúrò ní ìṣẹ́jú 45 ṣáájú fún {title} ní {time}.',
      headsPower: 'Gba iná sí kọ̀ǹpútà àti power bank rẹ ṣáájú {title} ní {time}, bí iná bá lọ.',
      headsPeak: 'Agbára rẹ ga jù ní {peak}. Mo pa àkókò yẹn mọ́ fún iṣẹ́ pàtàkì.',
      'peak.morning': 'àárọ̀', 'peak.afternoon': 'ọ̀sán', 'peak.evening': 'ìrọ̀lẹ́',
      callAction: 'Mo lè pe {name} fún ọ.',
      messageAction: 'Mo ti kọ ọ̀rọ̀ fún {name}. Màá ṣí {app} kí o lè fi ránṣẹ́.',
      directionsAction: 'Mo lè fi ọ̀nà sí {place} hàn ọ́.',
      rememberAction: 'Ó yé mi. Màá rántí: {fact}.',
      ecosystemSleek: 'Sleek kò tíì bẹ̀rẹ̀. Mo lè fi ìbéèrè rẹ fún {trade} pamọ́, kí n sì rán ọ létí.',
      ecosystemDevice: 'A kò tíì so {name} pọ̀. Mo lè fi "{command}" pamọ́ fún ìgbà tí o bá so ó pọ̀.',
      today: 'lónìí', tomorrow: 'lọ́la',
    },
    ig: {
      'nav.home': 'Ụlọ', 'nav.chat': 'Mkparịta', 'nav.schedule': 'Usoro', 'nav.tasks': 'Ọrụ', 'nav.more': 'Ndị ọzọ',
      morning: 'Ụtụtụ ọma', afternoon: 'Ehihie ọma', evening: 'Mgbede ọma',
      'home.brief': 'Nchịkọta gị', 'home.next': 'Nke na-esote', 'home.tasks': 'Ọrụ ndị bụ isi', 'home.talk': 'Gwa Ugent okwu',
      'home.focus': 'Malite itinye uche', 'home.energy': 'Kedu ka ike gị dị?', 'chat.placeholder': 'Deere Ugent ozi',
      'energy.low': 'Ike gwụrụ m', 'energy.ok': 'Ọ dị mma', 'energy.high': 'Enwere m ike',

      greet: 'Kedu {name}? Gịnị ka m ga-emere gị taa?',
      brief: 'Taa, ị nwere atụmatụ {e} na ọrụ {t}.',
      next: 'Nke na-esote: {title} na {time}.',
      nonext: 'Ọ dịghị atụmatụ ọzọ taa.',
      taskAdded: 'Etinyere m ya n\'ọrụ gị: {title}.',
      eventAdded: 'Edobere m ya: {title}, {when}.',
      traffic: 'Okporo ụzọ jupụtara. Enwere m ike ibugharị atụmatụ {n} nkeji 45.',
      power: 'Ọkụ anyụọla. Enwere m ike ibugharị atụmatụ {n} chọrọ ọkụ gaa n\'oge ọzọ.',
      late: 'Nsogbu adịghị. Enwere m ike ibugharị atụmatụ {n} nkeji 30.',
      tired: 'Izu ike dị mkpa. Enwere m ike ibugharị atụmatụ {n} siri ike gaa echi.',
      emergency: 'Ezinụlọ bụ ụzọ. Enwere m ike ibugharị atụmatụ {n} fọdụrụ gaa echi.',
      nothing: 'Ọ dịghị ihe fọdụrụ m ga-ebugharị taa.',
      focus: 'Itinye uche maka nkeji {m}. M ga-ejide ozi gị.',
      connect: '{name} na-abịa n\'oge na-adịghị anya.',
      draft: 'Nke a bụ ozi ị nwere ike iziga:',
      help: 'Nwalee: "Chetara m ịkpọ Mama na 6pm" ma ọ bụ "Gịnị dị taa?"',
      confirm: 'Ka m mee ya?',
      done: 'Emechaala m ya.',
      cancelled: 'Ọ dị mma, agaghị m eme ya.',
      headsTraffic: 'Okporo ụzọ na-ejupụta mgbe elekere anọ gachara. Pụọ nkeji 45 tupu {title} na {time}.',
      headsPower: 'Chaja laptọọpụ gị na power bank tupu {title} na {time}, ma ọkụ anyụọ.',
      headsPeak: 'Ike gị kachasị n\'{peak}. Ana m edobe oge ahụ maka ọrụ dị mkpa.',
      'peak.morning': 'ụtụtụ', 'peak.afternoon': 'ehihie', 'peak.evening': 'mgbede',
      callAction: 'Enwere m ike ịkpọ {name} maka gị.',
      messageAction: 'Edeela m ozi maka {name}. M ga-emeghe {app} ka ị zipu ya.',
      directionsAction: 'Enwere m ike igosi gị ụzọ gaa {place}.',
      rememberAction: 'Aghọtala m. M ga-echeta: {fact}.',
      ecosystemSleek: 'Sleek amalitebeghị. Enwere m ike idowe arịrịọ gị maka {trade} ma chetara gị.',
      ecosystemDevice: 'Ejikọbeghị {name}. Enwere m ike idowe "{command}" ruo mgbe ị jikọrọ ya.',
      today: 'taa', tomorrow: 'echi',
    },
    ha: {
      'nav.home': 'Gida', 'nav.chat': 'Hira', 'nav.schedule': 'Jadawali', 'nav.tasks': 'Ayyuka', 'nav.more': 'Ƙari',
      morning: 'Barka da safiya', afternoon: 'Barka da rana', evening: 'Barka da yamma',
      'home.brief': 'Taƙaitawarka', 'home.next': 'Na gaba', 'home.tasks': 'Manyan ayyuka', 'home.talk': 'Yi magana da Ugent',
      'home.focus': 'Fara mayar da hankali', 'home.energy': 'Yaya ƙarfinka?', 'chat.placeholder': 'Rubuta wa Ugent',
      'energy.low': 'Na gaji', 'energy.ok': 'Lafiya lau', 'energy.high': 'Ina da ƙarfi',

      greet: 'Sannu {name}! Me zan iya yi maka yau?',
      brief: 'Yau kana da shirye-shirye {e} da ayyuka {t}.',
      next: 'Na gaba: {title} da {time}.',
      nonext: 'Babu wani shiri da ya rage yau.',
      taskAdded: 'Na ƙara shi cikin ayyukanka: {title}.',
      eventAdded: 'Na tsara shi: {title}, {when}.',
      traffic: 'Akwai cunkoso a hanya. Zan iya matsar da shirye-shirye {n} da minti 45.',
      power: 'Wuta ta ɗauke. Zan iya matsar da shirye-shirye {n} da ke buƙatar wuta zuwa gaba.',
      late: 'Ba damuwa. Zan iya matsar da shirye-shirye {n} da minti 30.',
      tired: 'Hutu yana da muhimmanci. Zan iya matsar da shirye-shirye {n} masu nauyi zuwa gobe.',
      emergency: 'Iyali farko. Zan iya matsar da shirye-shirye {n} da suka rage zuwa gobe.',
      nothing: 'Babu abin da ya rage don matsawa yau.',
      focus: 'Mayar da hankali na minti {m}. Zan riƙe sanarwarka.',
      connect: '{name} na zuwa nan ba da daɗewa ba.',
      draft: 'Ga saƙon da za ka iya aikawa:',
      help: 'Gwada: "Tunatar da ni in kira Mama da 6pm" ko "Me ke gare ni yau?"',
      confirm: 'In yi shi?',
      done: 'An gama.',
      cancelled: 'To, ba zan yi shi ba.',
      headsTraffic: 'Cunkoso yana ƙaruwa bayan ƙarfe huɗu. Ka tashi minti 45 da wuri don {title} da {time}.',
      headsPower: 'Ka caji kwamfuta da power bank kafin {title} da {time}, idan wuta ta ɗauke.',
      headsPeak: 'Ƙarfinka ya fi yawa da {peak}. Na ajiye wannan lokaci don muhimman ayyuka.',
      'peak.morning': 'safe', 'peak.afternoon': 'rana', 'peak.evening': 'yamma',
      callAction: 'Zan iya kiran {name} maka.',
      messageAction: 'Na rubuta saƙo don {name}. Zan buɗe {app} don ka aika.',
      directionsAction: 'Zan iya nuna maka hanyar zuwa {place}.',
      rememberAction: 'Na ji. Zan tuna: {fact}.',
      ecosystemSleek: 'Sleek bai fara aiki ba tukuna. Zan iya ajiye buƙatarka ta {trade} in tunatar da kai.',
      ecosystemDevice: 'Ba a haɗa {name} ba tukuna. Zan iya ajiye "{command}" har sai ka haɗa shi.',
      today: 'yau', tomorrow: 'gobe',
    },
    fr: {
      'nav.home': 'Accueil', 'nav.chat': 'Discuter', 'nav.schedule': 'Agenda', 'nav.tasks': 'Tâches', 'nav.more': 'Plus',
      morning: 'Bonjour', afternoon: 'Bon après-midi', evening: 'Bonsoir',
      'home.brief': 'Votre résumé', 'home.next': 'À suivre', 'home.tasks': 'Tâches principales', 'home.talk': 'Parler à Ugent',
      'home.focus': 'Mode concentration', 'home.energy': 'Comment est votre énergie ?', 'chat.placeholder': 'Écrire à Ugent',
      'energy.low': 'Faible', 'energy.ok': 'Correcte', 'energy.high': 'Élevée',

      greet: 'Bonjour {name}. Comment puis-je vous aider aujourd\'hui ?',
      brief: 'Aujourd\'hui : {e} activités et {t} tâches.',
      next: 'Ensuite : {title} à {time}.',
      nonext: 'Plus rien de prévu aujourd\'hui.',
      taskAdded: 'Ajouté à vos tâches : {title}.',
      eventAdded: 'Planifié : {title}, {when}.',
      traffic: 'Embouteillages. Je peux décaler {n} activités de 45 minutes.',
      power: 'Coupure de courant. Je peux reporter {n} activités qui ont besoin d\'électricité.',
      late: 'Pas de souci. Je peux décaler {n} activités de 30 minutes.',
      tired: 'Le repos compte. Je peux déplacer {n} activités exigeantes à demain.',
      emergency: 'La famille d\'abord. Je peux déplacer les {n} activités restantes à demain.',
      nothing: 'Il n\'y a plus rien à déplacer aujourd\'hui.',
      focus: 'Concentration pendant {m} minutes. Je retiens vos notifications.',
      connect: '{name} arrive bientôt. Je vous préviendrai.',
      draft: 'Voici un message que vous pouvez envoyer :',
      help: 'Essayez : « Rappelle-moi d\'appeler Maman à 18h » ou « Qu\'est-ce que j\'ai aujourd\'hui ? »',
      confirm: 'Je le fais ?',
      done: 'C\'est fait.',
      cancelled: 'D\'accord, je ne le fais pas.',
      headsTraffic: 'La circulation se densifie après 16 h. Partez 45 minutes plus tôt pour {title} à {time}.',
      headsPower: 'Chargez votre ordinateur et votre batterie avant {title} à {time}, en cas de coupure.',
      headsPeak: 'Votre énergie est au plus haut le {peak}. Je garde ce moment pour l\'essentiel.',
      'peak.morning': 'matin', 'peak.afternoon': 'après-midi', 'peak.evening': 'soir',
      callAction: 'Je peux appeler {name} pour vous.',
      messageAction: 'J\'ai rédigé un message pour {name}. J\'ouvre {app} pour que vous l\'envoyiez.',
      directionsAction: 'Je peux ouvrir l\'itinéraire vers {place}.',
      rememberAction: 'Compris. Je retiens : {fact}.',
      ecosystemSleek: 'Sleek n\'est pas encore disponible. Je peux enregistrer votre demande de {trade} et vous le rappeler.',
      ecosystemDevice: '{name} n\'est pas encore connecté. Je peux garder « {command} » pour quand il le sera.',
      today: 'aujourd\'hui', tomorrow: 'demain',
    },
  };


// Singular forms for counts of 1 ("1 plan", not "1 plans").
const SING: Partial<Record<Lang, Record<string, string>>> = {
    en: { plans: 'plan', tasks: 'task' },
    fr: { 'activités': 'activité', 'tâches': 'tâche' },
    ha: { 'shirye-shirye': 'shiri', ayyuka: 'aiki' },
  };


export type Vars = Record<string, string | number>;

/** Translate `key` into `lang`, filling {placeholders}. An empty value drops its leading space. */
export function t(lang: Lang, key: string, vars?: Vars): string {
  let s = T[lang]?.[key] ?? T.en[key] ?? key;
  const sing = SING[lang];
  if (vars && sing) {
    for (const k of Object.keys(vars)) {
      if (vars[k] !== 1) continue;
      for (const [pl, sg] of Object.entries(sing)) s = s.replace(`{${k}} ${pl}`, `{${k}} ${sg}`).replace(`${pl} {${k}}`, `${sg} {${k}}`);
    }
  }
  if (vars) {
    s = s.replace(/\s*\{(\w+)\}/g, (m, k: string) => (vars[k] === '' ? '' : vars[k] !== undefined ? m.replace(/\{\w+\}/, String(vars[k])) : m));
  }
  return s;
}

export const hasKey = (key: string) => key in T.en;
