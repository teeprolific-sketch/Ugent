# Ugent

**Ugent by Me AI** is a personal AI agent that understands real African life: traffic, power cuts, family and irregular work. It learns you, manages your time, works offline, speaks local languages and takes real action.

This repository is the mobile app: an installable, offline-first web app (PWA). It has no build step and no dependencies, and the whole app is about 120 KB.

## Run it

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080 on your phone or in a browser's phone view. To install it, use **Add to Home screen** on Android or iOS. After the first visit it opens and works with no data connection.

To make a single-file preview for sharing:

```bash
node scripts/build-preview.mjs
```

## Screens

| Screen | What it does |
|---|---|
| Splash | Ugent wordmark, by Me AI |
| Onboarding | 3 steps: welcome, name and language, best time of day (plus an optional sample day) |
| Home / Daily brief | Greeting, a short brief with one heads-up (traffic, power or energy), energy check-in, next plan, top 3 tasks |
| Chat | Text and voice, 6 languages, action cards Ugent asks you to confirm, message drafts for WhatsApp |
| Schedule | 7-day strip, timeline with a "Now" line, **Plans changed?** for automatic rescheduling, smart "Add plan" |
| Tasks | Quick add, Today / All / Done, "Find time for this", move to tomorrow |
| Your week (Analytics) | 3 numbers, tasks done per day, when you get things done |
| Plans (Pricing) | Pro $2/month, Team $21/month |
| Settings and privacy | Language, voice, low data, focus length, learning, ask-before-acting, see / copy / delete your data |
| Focus | Countdown timer that holds Ugent's reminders and logs focus time |

## How the features work

- **Languages**: English, Pidgin, Yoruba, Igbo, Hausa and French for the main UI labels and all of Ugent's replies (`js/i18n.js`). Ugent understands requests in any of them, with or without tone marks (`js/agent.js`).
- **Takes action**: chat requests become real changes: add tasks, schedule plans, reschedule, start focus, draft a message. "Ask before taking actions" (on by default) shows a card and waits for **Yes, do it**; every change can be undone.
- **Automatic rescheduling** (`js/planner.js`): traffic (+45 min), running late (+30 min), power out (moves plans that need power), tired (moves heavy work to your best time tomorrow), family emergency (moves the rest of today). Fixed-time plans never move; Ugent offers a "running late" message for them instead.
- **Learns your energy**: Ugent records when you finish tasks. After 8 or more in two weeks, it uses your real best time of day instead of the one you picked.
- **Offline and low data**: a service worker (`sw.js`) caches the whole app. All logic runs on the phone. Data lives in `localStorage` on the device only.
- **Me AI family**: Sleek, Domestica I and Afrika I appear under More as "Coming soon", and Ugent recognises requests for them (for example "I need a plumber").

## Not built yet

- **Payments**: choosing Pro or Team switches the plan for testing only. Nothing is charged.
- **Cloud AI model**: the on-device agent handles common requests with rules. A Me AI Labs model can be plugged in behind `Agent.respond()` for open-ended conversation when online.
- **Sync, team features, and connections** to Sleek, Domestica I and Afrika I.
- **Translations**: the Yoruba, Igbo, Hausa and Pidgin copy should be reviewed by native speakers before launch.
- **Voice input** uses the browser's speech recognition. Support for Yoruba, Igbo and Hausa varies by phone.

## Project layout

```
index.html            app shell
css/app.css           design tokens (sky #0EA5E9, white, deep blue #0B3D91) and all styles, light and dark
js/i18n.js            languages and copy
js/store.js           on-device data and the sample day
js/planner.js         energy learning, free-time finder, rescheduling
js/agent.js           understands requests and turns them into actions
js/app.js             screens, navigation, chat, focus mode
sw.js                 offline cache
manifest.webmanifest  install settings
scripts/build-preview.mjs  single-file preview bundle
```
