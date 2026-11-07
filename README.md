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
- **The user stays in control.** Ugent proposes actions (add a task, schedule, reschedule, move a plan, tick off a task, start focus) and runs them only after **Yes, do it**, unless the user turns "Ask before taking actions" off. Every change can be undone.
- **Sync.** Tasks and plans sync both ways (`POST /api/sync`) with last-edit-wins. Team plans are shared with the team.

## Screens

Splash, Onboarding (3 steps), Home / Daily brief, Chat (text and voice), Schedule (with **Plans changed?** and smart **Add plan**), Tasks, Your week (analytics), Plans (pricing), Settings and privacy. Also Focus mode and Team management.

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

The smoke test runs against a live API and covers sign-in, sync and conflicts, privacy between users, chat fallback, the subscription webhook, teams and admin controls, plan limits, and account deletion.

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
