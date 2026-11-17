# Ugent

**Ugent by Me AI**: a personal AI agent for real African life. It plans around traffic, power cuts, family and irregular work, learns your energy, works offline, speaks English, Pidgin, Yoruba, Igbo, Hausa and French, and takes real action.

Native app for iOS and Android, with a Next.js backend.

```
apps/mobile     Expo (React Native, TypeScript, expo-router) for the App Store and Google Play
apps/api        Next.js backend: accounts, sync, Claude-powered chat, subscriptions, teams
packages/core   Shared TypeScript: languages, planner, offline agent, API contract (used by both)
brand/          Logo source and the script that renders every icon and splash image
```

## How it fits together

- **Offline first.** Everything the user does is stored on the phone and works with no connection. The planner and a rule-based agent that understands all six languages run on the phone (`packages/core`).
- **Cloud when online.** Chat goes to `POST /api/chat`, where Claude reads the user's day and replies with text plus proposed actions as structured JSON. The shared planner works out the exact times. If Claude is unavailable, declines, or the daily allowance is used up, the same on-device agent answers, so chat never fails.
- **The user stays in control.** Ugent proposes actions (add a task, schedule, reschedule, move a plan, tick off a task, start focus, call someone, send a WhatsApp or SMS, get directions) and runs them only after **Yes, do it**, unless the user turns "Ask before taking actions" off. Every change can be undone.
- **Sync.** Tasks and plans sync both ways (`POST /api/sync`) with last-edit-wins. Team plans are shared with the team.

## Screens

1. Splash
2. Onboarding: welcome, language (with search), daily rhythm, hustle type, privacy choices
3. Home / Daily brief (Personal) or Team home (Team workspace)
4. Chat with Ugent
5. Voice mode (hands-free, replies spoken aloud)
6. Schedule: day and week views; Team calendar with everyone's shared plans
7. Add / edit plan (with place and Google Maps directions)
8. Tasks; Team tasks board (To do / Doing / Done, assignees)
9. Focus mode
10. Your week (analytics), with Team analytics on the Team plan
11. Me AI ecosystem: Sleek, Domestica I, Afrika I, ID'd (waitlists, plus a working scam check)
12. Connected apps
13. WhatsApp and WhatsApp Business
14. Location and maps
15. Plans: Pro $2 and Team $21
16. Team dashboard
17. Team admin: members, roles, invite code, removal
18. Profile
19. Settings
20. Privacy and data
21. Notifications
22. Language (with search)
23. Offline mode status
24. Help and support (FAQ, contact, report a problem)
25. Empty states throughout for new users

People on the Team plan get a **Personal / Team** switcher on Home, Schedule and Tasks. Pro accounts never see team elements.

Also: **Search** (tasks, plans, notes, people, chats and settings; works offline), **Memory and preferences** (edit or delete what Ugent learned, star people and routines, reply style), **Focus summary** after each session, and a friendly **error screen** if something breaks.

## Everyday features

- **Daily brief:** morning brief before 5 PM, evening wrap-up after. Shows clashes with a one-tap fix, a gentle energy note (your strongest hours and the important task to use them on), traffic and leave-by times, and routine suggestions.
- **Quick capture:** the round + button on Home, Plan and Tasks. Type or speak; Ugent shows whether it understood a task, a timed plan or a note before you save.
- **Smart reschedule:** clashes are flagged on Home and in the day view; *Fix it* moves the flexible plan to the next free slot. Fixed and imported plans never move. Every change can be undone.
- **Focus mode:** pick a length and what you're working on (or a task). Reminders are held and WhatsApp Business can auto-reply; the summary asks if you finished and lets you jot a note.
- **Ecosystem commands from chat:** "Find me a plumber tomorrow at 10am" (Sleek), "Domestica, mop the kitchen", "Afrika, patrol the farm tonight". Until each product launches, Ugent saves the request, joins you to the waitlist and, for Sleek, adds a reminder task. Requests are listed in *Me AI ecosystem*.
- **Insights:** *Your week* has "What Ugent noticed": plain sentences about when you get things done, your busiest day, streaks, focus time and evening reschedules.
- **Notifications:** *Urgent only* (fixed plans, meetings, places to be), *Smart* (default: your own plans plus a "leave now" alert for plans with a place) or *Everything*. Quiet hours and focus always hold them.
- **Offline:** a strip at the top of every screen says you're offline, that Ugent still works, and how many changes will sync. Tap it for details.
- **Undo:** toasts offer Undo, and the latest action Ugent took in chat keeps an Undo button.
- **Live ↔ chat:** *Type instead* in Live hands over to chat with the conversation intact.

## Live, voice and personalisation

- **Live** (Chat, top right): a hands-free conversation. Ugent listens, answers out loud and listens again until you end it or say "bye". Actions can be confirmed by voice ("yes", "oya", "bẹ́ẹ̀ni", "oui"…).
- **Without opening the app:** long-press the Ugent icon for *Talk to Ugent*, *Plans changed?* or *Add a task*. The link `ugent://live` opens straight into Live, so Siri Shortcuts ("Open URL") and Google Assistant routines can start it by voice.
- **Voice commands** (Live or Chat), handled on the phone: "open my tasks", "show my week", "switch to black theme", "turn on low data", "turn off reminders", "sync now", "remember that…", "what do you remember about me".
- **Background work:** about every 30 minutes, even when Ugent is closed, it syncs, refreshes imported calendars and Gmail, and re-plans reminders and the morning brief (`expo-background-task`; the phone decides the exact timing).
- **Personalisation:** Ugent learns from what you do: the people you call or message (and their numbers once found), places you go, weekly routines from your plans, your best time of day, and facts you ask it to remember. It uses these in the brief (routine suggestions), in on-device answers, and in the cloud AI's context. Everything is listed in *Privacy and memory* and can be deleted item by item.
- **Themes** (Settings, Appearance): White (the default, plain black-and-white) and Black for everyone, or match the phone. Pro and Team add Ugent Blue (the sky-blue brand look), Midnight, Ocean, Sunset, Forest, Royal and a custom theme.

## Connected apps

| App | How it connects | What Ugent does |
|---|---|---|
| WhatsApp | On the phone, no setup | Opens WhatsApp with the message ready (late notes, shared plans, "Tell Kemi I'm on my way"); the user presses send |
| SMS | On the phone | Opens the SMS composer with the text ready |
| Phone and contacts | Contacts permission | "Call Mum" finds the number and opens the dialer |
| Apple Calendar / phone calendar | Calendar permission | Shows the next 7 days of events in the plan, read-only, never moved |
| Google Maps | Location permission | Directions, "leave by" times; live traffic needs `GOOGLE_MAPS_API_KEY` on the API |
| Google Calendar, Gmail, Google Tasks | Google sign-in through the API (read-only) | Calendar events in the plan, important unread emails in the brief, import open tasks |
| WhatsApp Business | Meta Cloud API through the API | Auto-replies to customers while the owner is in Focus mode; customer inbox |
| Notion | Later | |
| Sleek, Domestica I, Afrika I, ID'd | Me AI products | Waitlists today; ID'd scam check works now, on the phone |

To switch on the cloud connections, set the variables in `apps/api/.env.example`:
- **Google:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `PUBLIC_URL` (redirect `${PUBLIC_URL}/api/integrations/google/callback`).
- **Live traffic:** `GOOGLE_MAPS_API_KEY`, for the Routes API.
- **WhatsApp Business:** `META_WA_TOKEN`, `WA_APP_SECRET` and `WA_VERIFY_TOKEN` (webhook `${PUBLIC_URL}/api/webhooks/whatsapp`).

Until they are set, the app shows these connections as "Being set up by Me AI".

## Run it locally

Needs Node 20+ and Postgres.

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env.local
```

Fill in `DATABASE_URL` and `AUTH_SECRET` (and `ANTHROPIC_API_KEY` for cloud chat), then create the tables and start the API:

```bash
npm run db:migrate -w @ugent/api
```

```bash
npm run dev -w @ugent/api
```

Start the app. It needs a development build because it uses native modules (voice, notifications, purchases):

```bash
cp apps/mobile/.env.example apps/mobile/.env
```

```bash
npm run build:dev -w @ugent/mobile
```

```bash
npm run start -w @ugent/mobile
```

Leave `EXPO_PUBLIC_API_URL` empty to run the app fully offline with no backend.

### Checks

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run smoke -w @ugent/api
```

The smoke test runs against a live API (20 checks): sign-in, sync and conflicts, privacy between users, chat fallback, the subscription webhook, teams, task board, shared updates, team analytics, roles, connected-service status, signed WhatsApp webhooks with auto-reply during focus, waitlists, support requests, plan limits and account deletion.

## Release to the App Store and Google Play

1. **Expo account and EAS.** Run `npx eas-cli@latest init` in `apps/mobile` (fills `extra.eas.projectId`). Bundle ID and package are `ai.meai.ugent`; change them in `app.json` first if you want a different one, because they cannot change after release.
2. **Deploy the API.** Any Node host works (Vercel, Render, Fly). Use a managed Postgres (Neon, Supabase, RDS) and run `npm run db:migrate -w @ugent/api` against it. Set `DATABASE_URL`, `AUTH_SECRET`, `ANTHROPIC_API_KEY`, `REVENUECAT_WEBHOOK_AUTH` and `PRIVACY_CONTACT_EMAIL`. Put the API URL in `apps/mobile/eas.json` (`EXPO_PUBLIC_API_URL`, currently a placeholder).
3. **Subscriptions.** In App Store Connect and Google Play Console, create two monthly subscriptions: Pro ($2) and Team ($21). In RevenueCat, add both apps, create entitlements named `pro` and `team`, attach the products, and put them in the current offering with identifiers containing `pro` and `team`. Copy the public SDK keys to `EXPO_PUBLIC_RC_IOS_KEY` and `EXPO_PUBLIC_RC_ANDROID_KEY`. Add a webhook to `https://<api>/api/webhooks/revenuecat` with the same Authorization value as `REVENUECAT_WEBHOOK_AUTH`.
4. **Store listings.** Privacy policy URL: `https://<api>/privacy`. Account deletion is in Settings and privacy (both stores require it). Data collected: name, plans, tasks, chat messages and usage times, linked to the user and not used for tracking.
5. **Build and submit.**

   ```bash
   npm run build:store -w @ugent/mobile
   ```

   ```bash
   npm run submit -w @ugent/mobile
   ```

## Brand

The wordmark is traced from the Outfit typeface: sky blue letters (`#0EA5E9`) with a deep blue (`#0B3D91`) cursor bar under the "t". To change it, edit `brand/build-logo.mjs` and run `node brand/build-logo.mjs`; it regenerates the SVGs, app icon, Android adaptive icon layers, splash images, favicon and the in-app logo paths. In the app, Outfit is used for English, Pidgin and French, and Noto Sans for Yoruba, Igbo and Hausa, whose stacked tone marks Outfit cannot position.

## Before launch

- Native speakers should review the Yoruba, Igbo, Hausa and Pidgin copy in `packages/core/src/i18n.ts`. Labels beyond the main navigation, brief and chat replies are English for now.
- Voice input uses the phone's speech recognition. Support for Yoruba, Igbo and Hausa varies by device; Ugent tells the user when a language is not available.
- Sign-in is per install (a device secret in secure storage). Add phone-number sign-in to move an account to a new phone.
- Sleek, Domestica I and Afrika I appear as "Coming soon". Ugent recognises requests for them.
